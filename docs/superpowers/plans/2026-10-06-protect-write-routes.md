# Protect Write Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (the workflow's `implement` step runs inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block cross-site writes, DNS-rebound hosts and oversized bodies before any route handler runs, bind the server to loopback by default, and validate `specOverride`.

**Architecture:** One plain module, `src/server/request-guard.ts`, holds every rule as pure functions. `src/proxy.ts` (Next 16's renamed middleware) reads the request, calls the guard, and answers 403 or 413 or lets the request through. `next.config.ts` raises Next's proxy body cap to 2 MB so the guard's 1 MB body check sees through truncation. The PATCH route checks `specOverride` with a pure helper in `route-helpers.ts`.

**Tech Stack:** Next 16 (`proxy.ts`, `NextRequest`, `NextResponse`), TypeScript, Vitest (node environment), `node:net`.

**Spec:** `docs/superpowers/specs/2026-10-05-protect-write-routes-design.md`. The spec wins where this plan disagrees.

## Global Constraints

- Body limit: `BODY_LIMIT = 1_048_576` bytes. `experimental.proxyClientMaxBodySize: '2mb'`.
- Error texts, exact: `Unknown host.` (403), `Cross-site requests are not allowed.` (403), `Request body is too large.` (413), `Unknown spec for this class.` (400, via `UserError`).
- Allowed hosts: hostname `localhost` or an IP literal (`net.isIP` non-zero), brackets stripped from IPv6.
- Origin and body rules apply only to `/api` and `/api/*` with a method other than `GET` or `HEAD`, compared case-insensitively.
- Scripts: `next dev -H 127.0.0.1`, `next start -H 127.0.0.1`. LAN opt-in is `npm run dev -- -H 0.0.0.0`.
- Proxy matcher: `'/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)'`.
- `src/core` stays untouched. Errors checked with `isUserError`, never `instanceof`.
- Commits: `type: lowercase imperative summary`, terse body saying why, no AI attribution (AGENTS.md).
- Never run `npm run build` while `npm run dev` serves this folder.

## Review Focus

1. **Host header shapes:** a bare `localhost` (no port), `LOCALHOST:3000`, `[::1]:3000` and a LAN IP pass. `localhost@evil.example` and `localhost/evil` must not be read as `localhost`. Tests in Task 2.
2. **Origin normalization:** `HTTP://LOCALHOST:3000` matches `Host: localhost:3000`. An `Origin` on another localhost port fails. Tests in Task 2.
3. **The exact body limit across chunk boundaries:** 1,048,576 bytes split across 64 KB chunks pass, and one more byte fails, both in `bodyExceeds` and through `proxy()`. Tests in Tasks 2 and 3.
4. **A priority-only PATCH when Blizzard is down:** it must still save, because specs load only when `specOverride` is in the body. Covered by the route's code shape in Task 4 and hand check 9 in Task 6.
5. **A pass-through request keeps its body:** after the proxy reads its copy, the route must still get the full body. Hand check 4's exact-limit PATCH in Task 6 proves it against the running server.

---

### Task 1: Keep the lint gate on tracked code

Local scratch folders `.cache/` and `output/` are untracked, and ESLint's flat config doesn't read `.gitignore`. The spec review found `npm run lint` failing with 544 errors from `.cache/`. Ignore both folders so the gate reflects the repo.

**Files:**
- Modify: `eslint.config.mjs` (the `globalIgnores` line; check the real extension with `ls eslint.config.*`)

- [ ] **Step 1: Add the ignores**

Change:

```js
  globalIgnores(['.next/**', 'drizzle/**', 'next-env.d.ts']),
```

to:

```js
  globalIgnores(['.next/**', 'drizzle/**', 'next-env.d.ts', '.cache/**', 'output/**']),
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore: ignore local scratch folders in lint" -m "Untracked .cache/ and output/ broke npm run lint locally; flat config
ignores .gitignore."
```

---

### Task 2: Request guard

**Files:**
- Create: `src/server/request-guard.ts`
- Test: `src/server/request-guard.test.ts`

**Interfaces:**
- Produces:
  - `BODY_LIMIT: 1048576`
  - `interface GuardInput { method: string; pathname: string; host: string | null; origin: string | null; secFetchSite: string | null; contentLength: string | null }`
  - `interface GuardFailure { status: 403 | 413; error: string }`
  - `BODY_TOO_LARGE: GuardFailure` (status 413)
  - `isApiWrite(method: string, pathname: string): boolean`
  - `checkRequest(input: GuardInput): GuardFailure | null`
  - `bodyExceeds(body: ReadableStream<Uint8Array> | null, limit: number): Promise<boolean>`

- [ ] **Step 1: Write the failing tests**

`src/server/request-guard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BODY_LIMIT, bodyExceeds, checkRequest, isApiWrite, type GuardInput } from './request-guard';

const base: GuardInput = {
  method: 'POST',
  pathname: '/api/season/sync',
  host: 'localhost:3000',
  origin: null,
  secFetchSite: null,
  contentLength: null,
};
const check = (patch: Partial<GuardInput>) => checkRequest({ ...base, ...patch });
const UNKNOWN_HOST = { status: 403, error: 'Unknown host.' };
const CROSS_SITE = { status: 403, error: 'Cross-site requests are not allowed.' };
const TOO_LARGE = { status: 413, error: 'Request body is too large.' };

describe('checkRequest: host', () => {
  it.each(['localhost:3000', 'localhost', 'LOCALHOST:3000', '127.0.0.1:3000', '[::1]:3000', '192.168.1.20:3000'])('allows %s', (host) => {
    expect(check({ host })).toBeNull();
  });

  it.each(['evil.example:3000', 'mypc.local:3000', 'localhost@evil.example', 'localhost/evil', 'local host', ''])('rejects %s', (host) => {
    expect(check({ host })).toEqual(UNKNOWN_HOST);
  });

  it('rejects a missing host', () => {
    expect(check({ host: null })).toEqual(UNKNOWN_HOST);
  });

  it('rejects a rebound name on a page GET too', () => {
    expect(check({ method: 'GET', pathname: '/characters/1', host: 'evil.example:3000' })).toEqual(UNKNOWN_HOST);
  });
});

describe('checkRequest: Sec-Fetch-Site', () => {
  it('allows same-origin', () => {
    expect(check({ secFetchSite: 'same-origin' })).toBeNull();
  });

  it.each(['same-site', 'cross-site', 'none'])('rejects %s', (secFetchSite) => {
    expect(check({ secFetchSite })).toEqual(CROSS_SITE);
  });

  it('wins over a foreign Origin when present', () => {
    expect(check({ secFetchSite: 'same-origin', origin: 'http://evil.example' })).toBeNull();
  });
});

describe('checkRequest: Origin', () => {
  it.each([
    ['http://localhost:3000', 'localhost:3000'],
    ['HTTP://LOCALHOST:3000', 'localhost:3000'],
    ['http://192.168.1.20:3000', '192.168.1.20:3000'],
  ])('allows %s on host %s', (origin, host) => {
    expect(check({ origin, host })).toBeNull();
  });

  it.each(['http://evil.example', 'http://localhost:5173', 'null', 'not a url'])('rejects %s', (origin) => {
    expect(check({ origin })).toEqual(CROSS_SITE);
  });

  it('allows a write with neither header', () => {
    expect(check({})).toBeNull();
  });
});

describe('checkRequest: methods and paths', () => {
  it.each(['GET', 'HEAD', 'get'])('lets %s to /api through with a foreign Origin', (method) => {
    expect(check({ method, origin: 'http://evil.example' })).toBeNull();
  });

  it.each(['POST', 'PATCH', 'DELETE', 'post'])('rejects %s to /api with a foreign Origin', (method) => {
    expect(check({ method, origin: 'http://evil.example' })).toEqual(CROSS_SITE);
  });

  it('applies only the host rule to a page path', () => {
    expect(check({ pathname: '/characters/1', origin: 'http://evil.example', contentLength: '99999999' })).toBeNull();
  });
});

describe('checkRequest: Content-Length', () => {
  it.each([[String(BODY_LIMIT), null], [String(BODY_LIMIT + 1), TOO_LARGE], [null, null], ['abc', null]])(
    'Content-Length %s gives %o',
    (contentLength, expected) => {
      expect(check({ contentLength })).toEqual(expected);
    },
  );
});

describe('isApiWrite', () => {
  it.each([
    ['POST', '/api', true],
    ['DELETE', '/api/characters/1', true],
    ['patch', '/api/characters/1', true],
    ['GET', '/api/search', false],
    ['HEAD', '/api/search', false],
    ['POST', '/apiary', false],
    ['POST', '/characters/1', false],
  ])('%s %s gives %s', (method, pathname, expected) => {
    expect(isApiWrite(method, pathname)).toBe(expected);
  });
});

const CHUNK = 65_536;

function streamOf(total: number): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent >= total) return controller.close();
      const size = Math.min(CHUNK, total - sent);
      sent += size;
      controller.enqueue(new Uint8Array(size));
    },
  });
}

describe('bodyExceeds', () => {
  it('is false for no body', async () => {
    expect(await bodyExceeds(null, BODY_LIMIT)).toBe(false);
  });

  it('is false at exactly the limit across chunks', async () => {
    expect(await bodyExceeds(streamOf(BODY_LIMIT), BODY_LIMIT)).toBe(false);
  });

  it('is true one byte over the limit', async () => {
    expect(await bodyExceeds(streamOf(BODY_LIMIT + 1), BODY_LIMIT)).toBe(true);
  });

  it('stops reading once over the limit', async () => {
    const endless = new ReadableStream<Uint8Array>({ pull: (controller) => controller.enqueue(new Uint8Array(CHUNK)) });
    expect(await bodyExceeds(endless, BODY_LIMIT)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/server/request-guard.test.ts`
Expected: FAIL, `Failed to resolve import "./request-guard"`.

- [ ] **Step 3: Write the guard**

`src/server/request-guard.ts`:

```ts
import { isIP } from 'node:net';

// Rules for every request the proxy sees. The app has no login, so these keep other websites
// (cross-site writes, DNS rebinding) and oversized bodies away from the route handlers.

export const BODY_LIMIT = 1_048_576;

export interface GuardInput {
  method: string;
  pathname: string;
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
  contentLength: string | null;
}

export interface GuardFailure {
  status: 403 | 413;
  error: string;
}

const UNKNOWN_HOST: GuardFailure = { status: 403, error: 'Unknown host.' };
const CROSS_SITE: GuardFailure = { status: 403, error: 'Cross-site requests are not allowed.' };
export const BODY_TOO_LARGE: GuardFailure = { status: 413, error: 'Request body is too large.' };

/** `host:port` as the URL parser normalizes it, or null when the value isn't a plain host. */
function normalHost(host: string): URL | null {
  if (!host || /[\s/\\@?#]/.test(host)) return null;
  try {
    return new URL(`http://${host}`);
  } catch {
    return null;
  }
}

// A DNS-rebinding page arrives under its own DNS name. An IP literal can't be rebound,
// so only `localhost` and IP literals are served. LAN use by IP keeps working.
function isLocalHost(host: string | null): boolean {
  const url = host === null ? null : normalHost(host);
  if (!url) return false;
  const name = url.hostname.replace(/^\[|\]$/g, '');
  return name === 'localhost' || isIP(name) !== 0;
}

function sameOrigin(origin: string, host: string): boolean {
  const expected = normalHost(host);
  try {
    return expected !== null && new URL(origin).host === expected.host;
  } catch {
    return false;
  }
}

export function isApiWrite(method: string, pathname: string): boolean {
  const upper = method.toUpperCase();
  return upper !== 'GET' && upper !== 'HEAD' && (pathname === '/api' || pathname.startsWith('/api/'));
}

export function checkRequest(input: GuardInput): GuardFailure | null {
  if (!isLocalHost(input.host)) return UNKNOWN_HOST;
  if (!isApiWrite(input.method, input.pathname)) return null;
  // Sec-Fetch-Site is exact when present; same-site still covers other ports on localhost.
  if (input.secFetchSite !== null) {
    if (input.secFetchSite !== 'same-origin') return CROSS_SITE;
  } else if (input.origin !== null && !sameOrigin(input.origin, input.host!)) {
    return CROSS_SITE;
  }
  // Neither header: not a browser. The loopback bind keeps those on this machine.
  const length = input.contentLength;
  if (length !== null && /^\d+$/.test(length) && Number(length) > BODY_LIMIT) return BODY_TOO_LARGE;
  return null;
}

/** Reads a body until it passes `limit`. Next cuts the proxy's copy silently, so the limit sits below its cap. */
export async function bodyExceeds(body: ReadableStream<Uint8Array> | null, limit: number): Promise<boolean> {
  if (!body) return false;
  const reader = body.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return false;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return true;
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/server/request-guard.test.ts`
Expected: PASS. If `'local host'` or `''` doesn't reach `UNKNOWN_HOST`, fix `normalHost`, not the test.

- [ ] **Step 5: Commit**

```bash
git add src/server/request-guard.ts src/server/request-guard.test.ts
git commit -m "fix: add request guard for host, origin and body size" -m "No login, so any visited site could post to api writes, and a
rebound DNS name passes an Origin == Host check. Pure rules, tested
without Next. Refs #82."
```

---

### Task 3: Proxy and body cap

**Files:**
- Create: `src/proxy.ts`
- Modify: `next.config.ts`
- Test: `src/proxy.test.ts`

**Interfaces:**
- Consumes: `BODY_LIMIT`, `BODY_TOO_LARGE`, `bodyExceeds`, `checkRequest`, `isApiWrite` from `@/server/request-guard`.
- Produces: `proxy(request: NextRequest): Promise<NextResponse>` and `config.matcher`.

- [ ] **Step 1: Write the failing tests**

`src/proxy.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from './proxy';

const CHUNK = 65_536;
const encoder = new TextEncoder();

/** A chunked body with no Content-Length: `head`, then spaces up to `total` bytes. */
function padded(head: string, total: number): ReadableStream<Uint8Array> {
  const first = encoder.encode(head);
  let headSent = false;
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (!headSent) {
        headSent = true;
        sent = first.byteLength;
        return controller.enqueue(first);
      }
      if (sent >= total) return controller.close();
      const size = Math.min(CHUNK, total - sent);
      sent += size;
      controller.enqueue(new Uint8Array(size).fill(0x20));
    },
  });
}

function request(path: string, init: { method?: string; headers?: Record<string, string>; body?: ReadableStream<Uint8Array> } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? 'GET',
    headers: { host: 'localhost:3000', ...init.headers },
    body: init.body,
    duplex: 'half',
  } as ConstructorParameters<typeof NextRequest>[1]);
}

const passedThrough = (res: Response) => res.headers.get('x-middleware-next') === '1';
const SPEC = '{"specOverride":"Feral"}';

describe('proxy', () => {
  it('rejects valid JSON padded past the limit without Content-Length', async () => {
    const res = await proxy(request('/api/characters/1', { method: 'PATCH', body: padded(SPEC, SPEC.length + 1_048_577) }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Request body is too large.' });
  });

  it('passes the same JSON padded to exactly the limit', async () => {
    const res = await proxy(request('/api/characters/1', { method: 'PATCH', body: padded(SPEC, 1_048_576) }));
    expect(passedThrough(res)).toBe(true);
  });

  it('rejects an oversized body on a route that ignores its body', async () => {
    const res = await proxy(request('/api/characters/1/sync', { method: 'POST', body: padded('', 1_048_577) }));
    expect(res.status).toBe(413);
  });

  it('rejects a foreign Origin', async () => {
    const res = await proxy(request('/api/season/sync?region=eu', { method: 'POST', headers: { origin: 'http://evil.example' } }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Cross-site requests are not allowed.' });
  });

  it('rejects a page under a rebound name', async () => {
    const res = await proxy(request('/characters/1', { headers: { host: 'evil.example:3000' } }));
    expect(res.status).toBe(403);
  });

  it('lets a same-origin write and a page GET through', async () => {
    expect(passedThrough(await proxy(request('/api/characters/1', { method: 'DELETE', headers: { 'sec-fetch-site': 'same-origin' } })))).toBe(true);
    expect(passedThrough(await proxy(request('/characters/1')))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/proxy.test.ts`
Expected: FAIL, `Failed to resolve import "./proxy"`.

- [ ] **Step 3: Write the proxy**

`src/proxy.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { BODY_LIMIT, BODY_TOO_LARGE, bodyExceeds, checkRequest, isApiWrite, type GuardFailure } from '@/server/request-guard';

const reject = ({ error, status }: GuardFailure) => NextResponse.json({ error }, { status });

// Runs before every page and route. The rules live in request-guard.ts.
export async function proxy(request: NextRequest) {
  const { method } = request;
  const { pathname } = request.nextUrl;
  const failure = checkRequest({
    method,
    pathname,
    host: request.headers.get('host'),
    origin: request.headers.get('origin'),
    secFetchSite: request.headers.get('sec-fetch-site'),
    contentLength: request.headers.get('content-length'),
  });
  if (failure) return reject(failure);
  // Content-Length is absent on chunked bodies, so measure the body itself.
  if (isApiWrite(method, pathname) && (await bodyExceeds(request.body, BODY_LIMIT))) return reject(BODY_TOO_LARGE);
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)'],
};
```

- [ ] **Step 4: Raise Next's proxy body cap above the limit**

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Next cuts the proxy's copy of a body at this cap without an error. Keeping it above the
    // proxy's 1 MB limit means an oversized body still shows the proxy more than 1 MB.
    proxyClientMaxBodySize: '2mb',
  },
};

export default nextConfig;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/proxy.test.ts src/server/request-guard.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors. The test casts its init to `ConstructorParameters<typeof NextRequest>[1]` because `duplex` is missing from the DOM `RequestInit` type.

- [ ] **Step 7: Commit**

```bash
git add src/proxy.ts src/proxy.test.ts next.config.ts
git commit -m "fix: reject cross-site and oversized api writes in proxy" -m "Next's proxy body cap truncates silently, so padded JSON still parsed
and bodyless routes still ran. Proxy measures body at 1 MB; cap at
2 MB keeps truncation from hiding overflow. Refs #82."
```

---

### Task 4: Validate `specOverride`

**Files:**
- Modify: `src/server/route-helpers.ts`
- Modify: `src/app/api/characters/[id]/route.ts` (the `PATCH` handler)
- Test: `src/server/route-helpers.test.ts` (create)

**Interfaces:**
- Consumes: `UserError`, `isUserError` from `@/core/errors`; `services.blizzard.getClasses(region): Promise<{ id: number; name: string; specs: string[] }[]>`.
- Produces: `parseSpecOverride(value: unknown, specs: readonly string[]): string | null | undefined`.

- [ ] **Step 1: Write the failing tests**

`src/server/route-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isUserError } from '@/core/errors';
import { parseSpecOverride } from './route-helpers';

const SPECS = ['Balance', 'Feral', 'Guardian', 'Restoration'];

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

describe('parseSpecOverride', () => {
  it('leaves the field alone when absent', () => {
    expect(parseSpecOverride(undefined, SPECS)).toBeUndefined();
  });

  it.each([null, ''])('clears the override for %o', (value) => {
    expect(parseSpecOverride(value, SPECS)).toBeNull();
  });

  it('returns a listed spec', () => {
    expect(parseSpecOverride('Feral', SPECS)).toBe('Feral');
  });

  it.each(['Nonsense', 'feral', 42, 'x'.repeat(10_000)])('rejects %o with a UserError', (value) => {
    const err = thrown(() => parseSpecOverride(value, SPECS));
    expect(isUserError(err)).toBe(true);
    expect((err as Error).message).toBe('Unknown spec for this class.');
  });

  it('accepts only clearing with an empty list', () => {
    expect(parseSpecOverride(null, [])).toBeNull();
    expect(parseSpecOverride('', [])).toBeNull();
    expect(isUserError(thrown(() => parseSpecOverride('Feral', [])))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/server/route-helpers.test.ts`
Expected: FAIL, `parseSpecOverride is not a function` or a missing-export error.

- [ ] **Step 3: Add `parseSpecOverride`**

In `src/server/route-helpers.ts`, add `import { UserError, isUserError } from '@/core/errors';` (replacing the existing `isUserError` import line) and add after `parseId`:

```ts
/** undefined: leave the override alone. null: clear it. Otherwise one of the class's specs. */
export function parseSpecOverride(value: unknown, specs: readonly string[]): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'string' && specs.includes(value)) return value;
  throw new UserError('Unknown spec for this class.');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/server/route-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in the PATCH route**

In `src/app/api/characters/[id]/route.ts`, change the import to:

```ts
import { errorResponse, parseId, parseSpecOverride } from '@/server/route-helpers';
```

and replace the `PATCH` body's `try` block with:

```ts
  try {
    const { db, blizzard } = await getServices();
    const character = await getCharacter(db, id);
    if (!character) return NextResponse.json({ error: 'Unknown character' }, { status: 404 });
    const body = (await request.json()) as { specOverride?: unknown; priorityList?: unknown };
    const patch: Parameters<typeof updateCharacter>[2] = {};
    // Specs load only when the override changes, so a priority-only change works without Blizzard.
    if (body.specOverride !== undefined) {
      const classes = await blizzard.getClasses(character.region);
      const specs = classes.find((cls) => cls.name === character.className)?.specs ?? [];
      patch.specOverride = parseSpecOverride(body.specOverride, specs) ?? null;
    }
    if (body.priorityList === 'mythicPlus' || body.priorityList === 'overall') patch.priorityList = body.priorityList;
    await updateCharacter(db, id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
```

- [ ] **Step 6: Typecheck and run the suite**

Run: `npm run typecheck && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/server/route-helpers.ts src/server/route-helpers.test.ts "src/app/api/characters/[id]/route.ts"
git commit -m "fix: check spec override against class specs" -m "PATCH stored any string of any length as specOverride. Unknown spec
now 400, nothing stored. Specs load only when override is sent, so
priority-only changes don't need Blizzard. Refs #82."
```

---

### Task 5: Loopback by default, and docs

**Files:**
- Modify: `package.json` (`dev` and `start` scripts)
- Modify: `README.md` (Scripts table, plus a note after it)
- Modify: `AGENTS.md` ("Errors and HTTP" section; "Commands" table row for `npm run dev`)

- [ ] **Step 1: Bind to loopback**

In `package.json`:

```json
    "dev": "next dev -H 127.0.0.1",
```

```json
    "start": "next start -H 127.0.0.1",
```

- [ ] **Step 2: README**

Change the Scripts row to:

```markdown
| `npm run dev` | Starts the app on http://localhost:3000, reachable from this computer only |
```

and add after the table:

```markdown
### Using the app from your phone

`npm run dev -- -H 0.0.0.0` opens the app to your network, so a phone on the same Wi-Fi can use `http://<your-pc's-ip>:3000`. Use the IP address: the app refuses other host names. The app has no login, so anyone on that network can add, change and remove characters while it runs this way. Don't do it on public Wi-Fi.
```

- [ ] **Step 3: AGENTS.md**

In "Commands", change the `npm run dev` row to:

```markdown
| `npm run dev` | Starts the app on http://localhost:3000, bound to 127.0.0.1. `npm run dev -- -H 0.0.0.0` opens it to the LAN |
```

In "Errors and HTTP", add as the first bullet:

```markdown
- **`src/proxy.ts` guards every request.** It serves only `localhost` and IP-literal hosts, which stops DNS rebinding. On `/api` writes it rejects other origins (`Sec-Fetch-Site`, else `Origin`) and bodies over 1 MB, measured from the body itself because Next truncates the proxy's copy silently. The rules live in `src/server/request-guard.ts`. New write routes get them automatically. Never write on `GET`: the guard lets every `GET` through.
```

- [ ] **Step 4: Check the bind**

Run `npm run dev` in the background, then `netstat -an | findstr :3000`.
Expected: `127.0.0.1:3000` LISTENING only, no `0.0.0.0:3000` or `[::]:3000`. Stop dev.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md AGENTS.md
git commit -m "fix: listen on loopback by default" -m "next dev/start bound 0.0.0.0, so anyone on the network could call every
route, DELETE included. LAN use is now opt-in with -H 0.0.0.0. Closes
the issue's network half. Refs #82."
```

---

### Task 6: Gate and hand checks

**Files:** none changed unless a check fails.

- [ ] **Step 1: Full gate**

Make sure `npm run dev` is not running in this folder, then run:
`npm run typecheck && npm run lint && npm test && npm run build`
Expected: all clean. Record the test count for the pull request.

- [ ] **Step 2: Hand checks against `npm run dev`**

Use Git Bash. Pick a character id from the app (`<id>`) and note its spec, another valid spec for its class (`<spec>`), and its last sync time first.

1. Foreign origin, every write route; each answers 403 `{"error":"Cross-site requests are not allowed."}`:
   ```sh
   O='-H Origin:http://evil.example -H Content-Type:text/plain'
   curl -s -w ' %{http_code}\n' -X POST $O "http://localhost:3000/api/season/sync?region=eu"
   curl -s -w ' %{http_code}\n' -X POST $O -d '{}' http://localhost:3000/api/characters
   curl -s -w ' %{http_code}\n' -X POST $O "http://localhost:3000/api/characters/<id>/sync?force=1"
   curl -s -w ' %{http_code}\n' -X POST $O -d '{}' http://localhost:3000/api/characters/<id>/simc
   curl -s -w ' %{http_code}\n' -X PATCH $O -d '{}' http://localhost:3000/api/characters/<id>
   curl -s -w ' %{http_code}\n' -X DELETE $O http://localhost:3000/api/characters/<id>
   ```
2. The season sync from check 1 without `Origin` answers 200.
3. `curl -s -w ' %{http_code}\n' -H "Host: evil.example:3000" http://127.0.0.1:3000/` answers 403 `{"error":"Unknown host."}`.
4. Body size:
   ```sh
   node -e "require('fs').writeFileSync('big.json', JSON.stringify({specOverride:'<spec>'}) + ' '.repeat(1048577))"
   node -e "require('fs').writeFileSync('exact.json', (s => s + ' '.repeat(1048576 - s.length))(JSON.stringify({specOverride:'<spec>'})))"
   curl -s -w ' %{http_code}\n' -X PATCH --data-binary @big.json http://localhost:3000/api/characters/<id>
   curl -s -w ' %{http_code}\n' -X PATCH -H "Transfer-Encoding: chunked" --data-binary @big.json http://localhost:3000/api/characters/<id>
   curl -s -w ' %{http_code}\n' -X POST -H "Transfer-Encoding: chunked" --data-binary @big.json "http://localhost:3000/api/characters/<id>/sync?force=1"
   curl -s -w ' %{http_code}\n' -X PATCH -H "Transfer-Encoding: chunked" --data-binary @exact.json http://localhost:3000/api/characters/<id>
   rm big.json exact.json
   ```
   Expected: 413, 413, 413, then 200. After the three 413s the spec and last sync time are unchanged, and the server log shows no sync. After the 200 the character page shows `<spec>`, which proves the route still got the full body. Set the spec back in the UI.
5. `netstat -an | findstr :3000` shows `127.0.0.1:3000` only. Repeat with `npm start` after the build.
6. In the browser at http://localhost:3000: add a character, refresh it, paste SimC, change spec and priority list, remove it, and sync the season. None fail.
7. `npm run dev -- -H 0.0.0.0`, then from a phone on the LAN open `http://<lan-ip>:3000` and change a setting. Owner check if no phone is at hand.
8. `curl -s -w ' %{http_code}\n' -X PATCH -d '{"specOverride":"Nonsense"}' http://localhost:3000/api/characters/<id>` answers 400 `{"error":"Unknown spec for this class."}`, and the page still shows the old spec.
9. With `.env`'s `BLIZZARD_CLIENT_SECRET` temporarily wrong and dev restarted, change only the priority list in the UI. It saves. Restore `.env` and restart.

- [ ] **Step 3: Record results**

Note each check's result for the pull request's Testing section. Name the gaps: Next's body cloning, the 2 MB cap and the matcher are covered only by hand checks 1 to 4. The phone check is the owner's if not done here.
