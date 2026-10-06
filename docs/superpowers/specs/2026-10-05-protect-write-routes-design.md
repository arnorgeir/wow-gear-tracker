# Protect write routes and bind to loopback

Status: approved by the owner on 2026-10-05. The spec review's P2 finding (oversized bodies without `Content-Length`) is resolved in decision 2, "Body size", on 2026-10-06. The intended behavior is unchanged: the fix makes the approved 413 promise hold.
Date: 2026-10-05
Issue: #82 — Write routes accept cross-site requests, and the server listens on the whole network

## Goal

The app has no login, and its route handlers trust every request. Two things make that reachable from outside the owner's own browser tab:

1. **Any website the owner visits can call the write routes.** A cross-site `fetch` with `mode: 'no-cors'` and a `text/plain` body skips the CORS preflight, and `request.json()` parses it anyway. That reaches `POST /api/characters`, `POST /api/characters/<id>/sync?force=1` (which can be looped to burn Blizzard quota), `POST /api/characters/<id>/simc` and `POST /api/season/sync`.
2. **The server listens on every interface.** `next dev` and `next start` bind `0.0.0.0`, so anyone on the same network can call every route, `DELETE` included.

This change closes both: a request guard in front of the app, and a loopback bind by default. It also adds two smaller checks the issue names, a body-size cap and validation of `specOverride`. It is not authentication. Hosting (#8) still needs login (#49) first.

## What success looks like

- The issue's repro, `curl -X POST -H "Origin: http://evil.example" -H "Content-Type: text/plain" "http://localhost:3000/api/season/sync?region=eu"`, answers 403. So does every other write route with a foreign `Origin`.
- A page served under a DNS name that isn't `localhost`, such as a rebound `evil.example`, gets 403 on every route and page.
- `npm run dev` and `npm start` listen on `127.0.0.1:3000` only. `npm run dev -- -H 0.0.0.0` still serves the app to a phone on the LAN by IP address, and its writes work.
- Every UI flow works as before: add a character, refresh, paste SimC, change settings, remove a character, sync the season.
- A write body over 1 MB answers 413 before any route handler runs, with or without `Content-Length`. Nothing is stored, and no sync starts.
- `PATCH /api/characters/<id>` with a `specOverride` that isn't one of the character's class specs answers 400 and stores nothing.

## Decisions and reasons

### 1. One pure guard function, `checkRequest`

`src/server/request-guard.ts` exports:

```ts
export interface GuardInput {
  method: string;
  pathname: string;
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
  contentLength: string | null;
}

export function checkRequest(input: GuardInput): { status: 403 | 413; error: string } | null;
```

It returns `null` when the request may continue. The rules run in this order, and the first failure wins:

1. **Host, on every request.** Take the hostname from `Host` (`new URL('http://' + host).hostname`). Strip the brackets from an IPv6 literal. The request passes when the hostname is `localhost` or `net.isIP()` accepts it. A missing or unparsable `Host` fails. The status is 403, with the error `Unknown host.`
2. **The rest apply only to `/api/*` with a method other than `GET` or `HEAD`.** Method matching is case-insensitive.
   1. **`Sec-Fetch-Site` when present.** Only `same-origin` passes. `same-site` fails too, because another port on localhost is same-site but a different origin. The status is 403, with the error `Cross-site requests are not allowed.`
   2. **Otherwise `Origin` when present.** It passes when `new URL(origin).host` equals `Host`, compared case-insensitively. `null` or anything unparsable fails. The status and error are the same as in rule 2.1.
   3. **Neither header present:** pass. Browsers send `Origin` on every cross-origin POST, PATCH and DELETE, so only non-browser clients like curl or scripts arrive without both. The loopback bind (decision 3) keeps those on the owner's machine.
   4. **`Content-Length` over 1 MB (1,048,576 bytes):** fails with 413 and the error `Request body is too large.` A missing or non-numeric value passes this rule; the proxy then measures the body itself (decision 2, "Body size"). This rule is the cheap early answer when the header is honest.

**Why `localhost` or an IP literal.** Comparing `Origin` with `Host` alone fails against DNS rebinding: a page on `evil.example` re-points its DNS to `127.0.0.1`, and its requests become same-origin with `Host: evil.example:3000`. A rebinding attack needs a DNS name, and an IP literal can't be rebound, so allowing only `localhost` and IP literals closes it. LAN use by IP address still works. A custom LAN name such as `mypc.local` is blocked; that's a known limit, not worth a setting until someone asks for it.

**Why Host runs on pages too.** Page loads also call Blizzard, Method and Raidbots (`ensureBisLists`, `ensureItemIcons` and others), so a rebound page could burn quota by loading pages.

**Why it lives in `src/server`.** It's HTTP plumbing, not domain logic, and it sits beside `route-helpers.ts`. It imports only `node:net`, so it tests as a plain function.

### 2. `src/proxy.ts` wires the guard in

Next 16 renamed `middleware` to `proxy`, and it runs on the Node.js runtime by default (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`). `src/proxy.ts` exports a `proxy(request)` function. It reads `host`, `origin`, `sec-fetch-site` and `content-length` from `request.headers`, and the method and `request.nextUrl.pathname`. It calls `checkRequest` and returns `NextResponse.json({ error }, { status })` on a failure. For an `/api` write that passes, it then checks the body size ("Body size" below). Otherwise it returns `NextResponse.next()`. The file holds no rules of its own.

The matcher skips Next's static output and the app's icon files:

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)'],
};
```

**Body size.** The `Content-Length` rule alone doesn't hold: a chunked request has no `Content-Length`. Next's buffer cap doesn't reject anything either. With a proxy present, Next clones each request body for the proxy and the route, up to `experimental.proxyClientMaxBodySize` (10 MB by default). Past the cap it logs a warning and ends both copies early, dropping the chunk that crossed the cap. Nothing tells the proxy or the route that the body was cut (`node_modules/next/dist/server/body-streams.js`, `cloneBodyStream`). A route then runs on the cut body. Valid JSON followed by a megabyte of whitespace still parses, and the sync and DELETE routes never read their body at all.

So the proxy measures the body itself, against a limit set below Next's cap:

- `request-guard.ts` exports `BODY_LIMIT = 1_048_576` and `bodyExceeds(body: ReadableStream<Uint8Array> | null, limit: number): Promise<boolean>`. It reads chunks, adding up their byte lengths, and stops with `true` as soon as the total passes `limit`, cancelling the reader. A `null` body or one that ends within the limit gives `false`.
- After `checkRequest` passes an `/api` write, the proxy calls `bodyExceeds(request.body, BODY_LIMIT)`. It does this whether or not `Content-Length` is present, so there's one path to trust. `true` answers 413 with `Request body is too large.` The route never runs. Next keeps its own copy of the body for the route, so reading it in the proxy is allowed and costs no extra copy.
- `next.config.ts` sets `experimental.proxyClientMaxBodySize: '2mb'`. Truncation can only happen past 2 MB, and the chunk that crosses the cap is dropped, so the proxy's copy of a body over 2 MB still holds at least 2 MB minus one socket chunk. Socket chunks are 64 KB at most, far under the 1 MB gap, so every body over 1 MB shows the proxy more than 1 MB. The 2 MB cap also bounds memory per request. If a Next upgrade drops the option, the default 10 MB cap keeps the same guarantee, with more memory per request.

### 3. Loopback bind by default

`package.json`:

```json
"dev": "next dev -H 127.0.0.1",
"start": "next start -H 127.0.0.1",
```

`127.0.0.1` and not `localhost`: on recent Node, `localhost` can resolve to `::1` only, and then `http://127.0.0.1:3000` stops answering. Browsers opening `http://localhost:3000` fall back to `127.0.0.1`, so the README's URL keeps working.

Opting in to the LAN is `npm run dev -- -H 0.0.0.0`. Next's CLI takes the last `-H` it is given (a plain commander option), so no extra script is needed. The README documents it under the commands table, with a warning: the app has no login, so anyone on that network can change its data while the server is open.

### 4. Input validation scope

- **SimC body size:** the proxy's 1 MB body check covers it (decision 2). The route keeps its 200,000-character check and message, and changes nothing else.
- **`specOverride`:** `src/server/route-helpers.ts` gains a pure function:

  ```ts
  export function parseSpecOverride(value: unknown, specs: readonly string[]): string | null | undefined;
  ```

  It returns `undefined` when `value` is `undefined`, meaning leave the field alone. It returns `null` for `null` or `''`, meaning clear the override. It returns `value` when `value` is a string in `specs`. Anything else throws `UserError('Unknown spec for this class.')`, which `errorResponse` turns into a 400.

  The PATCH route calls it only when `body.specOverride !== undefined`. Blizzard is asked only when the request sets an override:

  | `specOverride` in the body | Blizzard lookup | Result |
  |---|---|---|
  | absent | none | field unchanged; a priority-only change works with Blizzard down |
  | `null` or `''` | none | override cleared; works with Blizzard down |
  | any other value | `services.blizzard.getClasses(character.region)`, class found by `character.className` | stored when it is one of the class's specs, otherwise 400 |

  Clearing needs no spec list, and the settings select sends `null` whenever the active spec is picked, so it must not depend on Blizzard. The `getClasses` result is cached in memory per region, which is what the character page's spec select already reads. When a lookup is needed and Blizzard can't be reached, the error goes through `errorResponse` as a logged 500, and nothing in the request is stored, including a `priorityList` sent with it. When the class isn't found, `specs` is empty, so setting any override answers 400.

  The PATCH route reads the character row today only to check that it exists. It now keeps the row for `region` and `className`.
- **Out of scope:** `POST /api/characters` needs no change, since Blizzard confirms the character before anything is stored. `priorityList` is already checked against its two values.

### 5. Docs

- **README:** the commands table says `npm run dev` listens on `127.0.0.1:3000`, and a short note describes the LAN opt-in and its warning.
- **AGENTS.md, "Errors and HTTP":** add a rule. `src/proxy.ts` checks `Host` on every request, and `Origin` or `Sec-Fetch-Site` plus body size on `/api` writes. New write routes get the checks automatically. Don't add a route that writes on `GET`, because the guard lets every `GET` through.

## Component boundaries

| Unit | Job | Depends on |
|---|---|---|
| `src/server/request-guard.ts` | Decides allow, 403 or 413 from plain header values, and measures a body stream against the limit | `node:net` |
| `src/proxy.ts` | Reads the request, calls the guard, answers | `next/server`, the guard |
| `src/server/route-helpers.ts` (`parseSpecOverride`) | Checks a spec value against a list | `@/core/errors` |
| `src/app/api/characters/[id]/route.ts` | Loads the class's specs and calls `parseSpecOverride` | services, route helpers |

## Acceptance tests

### Automated

`src/server/request-guard.test.ts`, as a table:

- **Host:** `localhost:3000`, `127.0.0.1:3000`, `[::1]:3000`, `192.168.1.20:3000` and `LOCALHOST:3000` pass. `evil.example:3000`, `mypc.local:3000`, a missing Host and an unparsable value get 403. A rebound name fails on a page `GET` too, such as `/characters/1`.
- **Sec-Fetch-Site on a POST to `/api/season/sync`:** `same-origin` passes. `same-site`, `cross-site` and `none` get 403. `same-origin` with a foreign `Origin` passes, because Sec-Fetch-Site wins when present.
- **Origin without Sec-Fetch-Site:** a matching `http://localhost:3000` passes, and a matching LAN IP origin passes. `http://evil.example`, `http://localhost:5173`, `null` and garbage get 403.
- **No headers:** a POST with neither header passes.
- **Methods:** a `GET` or `HEAD` to `/api/*` with a foreign Origin passes. `POST`, `PATCH`, `DELETE` and lowercase `post` with a foreign Origin get 403. A `POST` to a page path with a foreign Origin passes the origin rules, so only Host applies there.
- **Body size:** a `Content-Length` of `1048576` passes. `1048577` gets 413. Missing or `abc` passes.
- **`bodyExceeds`:** `null` gives `false`. Bodies of exactly `1048576` bytes and `1048577` bytes, each split across several chunks, give `false` and `true`. A stream that never ends after passing the limit still resolves `true`, which shows the reader stops early.

`src/proxy.test.ts` calls `proxy()` with a real `NextRequest` whose body is a chunked `ReadableStream` (`duplex: 'half'`) and no `Content-Length`:

- `PATCH /api/characters/1` with `{"specOverride":"Feral"}` followed by 1,048,577 spaces answers 413. The same JSON padded to exactly 1,048,576 bytes passes through.
- `POST /api/characters/1/sync` with a 1,048,577-byte body the route would ignore answers 413.
- A foreign `Origin` answers 403, and a `GET` to a page with `Host: evil.example:3000` answers 403. These check the wiring between `proxy()` and `checkRequest`.

A pass-through response carries Next's `x-middleware-next` header, so the tests tell it apart from a rejection. The proxy runs before any route handler, so a 413 means no database write and no sync. Hand check 4 confirms that against the running server.

`src/server/route-helpers.test.ts`, for `parseSpecOverride`: `undefined` gives `undefined`. `null` and `''` give `null`. A listed spec is returned. An unlisted string, a number and a listed spec with different casing throw a `UserError`, checked with `isUserError`. With an empty list, only `undefined`, `null` and `''` are accepted.

Full gate: `npm run typecheck && npm run lint && npm test`, and `npm run build`, since `next.config.ts` and the proxy change.

### By hand

1. The issue's curl repro answers 403 with `{"error":"Cross-site requests are not allowed."}`. Repeat it against `POST /api/characters`, `POST /api/characters/<id>/sync?force=1`, `POST /api/characters/<id>/simc`, `PATCH` and `DELETE /api/characters/<id>`.
2. The same curl requests without `Origin` succeed.
3. `curl -H "Host: evil.example:3000" http://127.0.0.1:3000/` answers 403.
4. Body size against the running server, with a character's spec and last sync noted first:
   - A PATCH whose `Content-Length` says 2 MB answers 413.
   - A chunked PATCH with no `Content-Length` (`curl -H "Transfer-Encoding: chunked" --data-binary @body.json`), holding `{"specOverride":"<another valid spec>"}` and 1,048,577 trailing spaces, answers 413. The spec is unchanged.
   - A chunked `POST /api/characters/<id>/sync?force=1` with a 1,048,577-byte body answers 413. The server log shows no sync, and the last sync time is unchanged.
   - The same chunked PATCH padded to exactly 1,048,576 bytes succeeds and changes the spec.
5. `netstat -an | findstr 3000` shows `127.0.0.1:3000` only, for both `npm run dev` and `npm start`.
6. In the browser, add a character, refresh it, paste SimC, change spec and priority list, remove it, and sync the season. None of them fail.
7. `npm run dev -- -H 0.0.0.0`, then open `http://<lan-ip>:3000` from a phone and change a setting.
8. A PATCH with `{"specOverride":"Nonsense"}` answers 400, and the character page still shows the old spec.
9. With Blizzard unreachable (a wrong `BLIZZARD_CLIENT_SECRET`), a priority-only PATCH and `{"specOverride":null}` both answer 200 and save. `{"specOverride":"<a valid spec>"}` answers 500 and stores nothing.

Gaps: the project has no HTTP-level test setup. Next's own body cloning, the 2 MB buffer cap and the matcher are covered only by hand checks 1 to 4. `src/proxy.test.ts` covers the proxy's own logic on a chunked stream, not Next's server around it.

## Risks

- **`proxyClientMaxBodySize` is experimental.** It could be renamed or removed in a Next upgrade. The body check still holds at the default 10 MB cap, with more memory per request. If an upgrade makes the cap reject bodies, or drops the clone the proxy reads, rerun hand check 4.
- **Next's cut-body behavior is undocumented internals.** The 1 MB margin under the cap assumes socket chunks stay far smaller than 1 MB. Node's are 64 KB at most.
- **A browser without Fetch Metadata, sending a write with no `Origin`.** Every current browser sends `Origin` on cross-origin non-GET requests, so this needs a browser more than five years old.
- **Running the app behind a reverse proxy changes `Host`.** That belongs to hosting (#8), which needs login anyway.

## Out of scope

- Login and sessions (#49), and hosting (#8).
- CORS headers. No other origin needs to call the API.
- An `ALLOWED_HOSTS` setting for custom LAN names.
- Rate limiting the sync routes.
