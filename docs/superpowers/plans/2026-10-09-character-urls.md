# Raider.IO-style Character URLs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline in one session, as `docs/workflow.md` (step 4, `implement`) says. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Character pages live at `/characters/<region>/<realm>/<name>`, find the character by identity, and add an untracked character from the client. No other site can frame the app.

**Architecture:** `src/core/characters/member-key.ts` gains `memberKeyFromParts`, `memberKeyFromPath` and `characterHref`, reusing the group page's identity rules. A new query `findCharacterByKey` backs `getCharacterPage(services, key, listType)`, which returns the page view or an `untracked` view. The route moves to `src/app/characters/[region]/[realm]/[name]/page.tsx`. An untracked view renders `AutoAddCharacter`, which POSTs to the existing guarded `/api/characters` on mount and refreshes. `summarize` puts `href` on every `CharacterSummary`, so components stop building paths from IDs. `next.config.ts` sends `frame-ancestors 'none'` and `X-Frame-Options: DENY` on every path.

**Tech Stack:** Next.js (non-standard version: read `node_modules/next/dist/docs/` before touching routes, pages or config), React server components, TypeScript, libsql with Drizzle, Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-09-character-urls-design.md`. The spec wins when this plan disagrees with it.

## Global Constraints

- `src/core` never imports `next`, `react`, or anything from `src/app`, `src/components` or `src/server`.
- Realm slugs come from the stored character (Blizzard), never from Raider.IO.
- Name folding is `nameKeyOf` only. Never call `toLowerCase` on a name directly.
- Never write on `GET`. The add happens only through `POST /api/characters`.
- API routes keep numeric IDs. Components that call them (`SimcPaste`, `CharacterSettings`, `RefreshButton`, `StaleSync`, `RemoveCharacterButton`) keep `id`.
- No schema change, no migration, no cache version bump.
- Exact headers: `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`, on `source: '/:path*'`.
- Exact copy: `Adding ${name} – ${realmSlug}…` (en dash `–`, ellipsis `…`). Fallback error: `Couldn’t add that character.` (curly `’`).
- Fixture names are made up, like `Birkibjörn` and `Rustý`. Never a real player's name.
- Commit subjects are `type: lowercase imperative summary`. Bodies are terse, wrap at 72 columns, and say why. **No AI attribution and no co-author trailers**: `AGENTS.md` overrides any default. After each commit, `git log -1 --format=%B | grep -iE 'co-authored-by|claude|anthropic|codex|openai|generated with'` must print nothing.
- The gate before calling a task done is `npm run typecheck && npm run lint && npm test`. Add the production build for tasks that touch pages or components, and never run it while `npm run dev` serves this folder. Stop dev first, or build in a separate worktree.

## Review Focus

1. **A hand-typed or shared path in another case or encoding** (`/characters/EU/Tarren-Mill/RUSTÝ`, `/characters/eu/tarren-mill/rust%C3%BD`). It must open the same tracked character, not auto-add a duplicate. Task 2's `memberKeyFromPath` tests pin the folding, and Task 3 pins that a folded key finds the stored row.
2. **A segment that won't decode** (`/characters/eu/tarren-mill/%E0%A4%A`). It should get 404, never 500. Task 2 pins it.
3. **The same name on two realms.** The path must open the one on its own realm. Task 3 pins it.
4. **A failed auto-add** (Blizzard 404, or Blizzard down). It should show the message once, store nothing and never retry in a loop. The ref guard holds across `router.refresh()`, because the component stays mounted. Task 5's hand check pins it; no browser tests exist.
5. **List tabs after the move** (`?list=raid`). Switching lists must stay on the new path and keep the selected tab. Task 4 changes `ListTabs`; Task 5's hand check pins it.

---

### Task 1: Block framing app-wide

Lands first, so the auto-add never exists without it.

**Files:**
- Create: `src/server/frame-headers.ts`
- Create: `src/server/frame-headers.test.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Produces: `FRAME_HEADERS: { key: string; value: string }[]`, used by `next.config.ts`.

- [ ] **Step 1: Read the docs.** Read `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` and confirm `headers()` takes `{ source, headers: [{ key, value }] }` and applies to page routes.

- [ ] **Step 2: Write the failing test** in `src/server/frame-headers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { FRAME_HEADERS } from './frame-headers';

describe('frame headers', () => {
  it('forbid every other site from framing the app', () => {
    expect(FRAME_HEADERS).toEqual([
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      { key: 'X-Frame-Options', value: 'DENY' },
    ]);
  });

  it('apply to every path', async () => {
    expect(await nextConfig.headers!()).toEqual([{ source: '/:path*', headers: FRAME_HEADERS }]);
  });
});
```

- [ ] **Step 3: Run it.** `npx vitest run src/server/frame-headers.test.ts`. Expected: FAIL, the module `./frame-headers` is missing.

- [ ] **Step 4: Implement.** Create `src/server/frame-headers.ts`:

```ts
// A framed page runs with the app's origin, so its writes pass the request guard as same-origin.
// Refusing every frame stops that before any script runs, and stops clickjacking on write buttons.
export const FRAME_HEADERS = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
];
```

Change `next.config.ts` to:

```ts
import type { NextConfig } from 'next';
import { FRAME_HEADERS } from './src/server/frame-headers';

const nextConfig: NextConfig = {
  experimental: {
    // Next cuts the proxy's copy of a body at this cap without an error. Keeping it above the
    // proxy's 1 MB limit means an oversized body still shows the proxy more than 1 MB.
    proxyClientMaxBodySize: '2mb',
  },
  headers: async () => [{ source: '/:path*', headers: FRAME_HEADERS }],
};

export default nextConfig;
```

- [ ] **Step 5: Run it.** `npx vitest run src/server/frame-headers.test.ts`. Expected: PASS. Then run the gate: `npm run typecheck && npm run lint && npm test`.

- [ ] **Step 6: Commit.**

```sh
git add src/server/frame-headers.ts src/server/frame-headers.test.ts next.config.ts
git commit -F - <<'EOF'
feat: refuse to be framed by other sites

Framed page runs same-origin, so its POSTs pass the request guard.
Needed before character paths auto-add; also stops clickjacking.
EOF
```

---

### Task 2: Character paths in member keys

**Files:**
- Modify: `src/core/characters/member-key.ts`
- Test: `src/core/characters/member-key.test.ts`

**Interfaces:**
- Produces:
  - `memberKeyFromParts(region: string, realmSlug: string, name: string): MemberKey | null`
  - `memberKeyFromPath(region: string, realm: string, name: string): MemberKey | null`: decodes each segment, then calls `memberKeyFromParts`. Null when a segment won't decode or doesn't validate.
  - `characterHref(c: { region: Region; realmSlug: string; name: string }): string`

- [ ] **Step 1: Write the failing tests.** Add `characterHref, memberKeyFromParts, memberKeyFromPath` to the import list in `member-key.test.ts`, and append:

```ts
describe('character paths', () => {
  const rusty: MemberKey = { region: 'eu', realmSlug: 'tarren-mill', nameKey: 'rustý' };

  it('links to the folded, encoded name', () => {
    expect(characterHref({ region: 'eu', realmSlug: 'tarren-mill', name: 'Rustý' })).toBe('/characters/eu/tarren-mill/rust%C3%BD');
  });

  it('builds a key from parts in any case', () => {
    expect(memberKeyFromParts('EU', 'Tarren-Mill', 'RUSTÝ')).toEqual(rusty);
    expect(memberKeyFromParts('eu', 'argent-dawn', 'Birkibjörn')).toEqual(birki);
  });

  it('rejects parts that are not region, realm slug and a name of letters', () => {
    expect(memberKeyFromParts('xx', 'tarren-mill', 'rustý')).toBeNull();
    expect(memberKeyFromParts('eu', 'tarren mill', 'rustý')).toBeNull();
    expect(memberKeyFromParts('eu', '-mill', 'rustý')).toBeNull();
    expect(memberKeyFromParts('eu', 'tarren-mill', 'rusty2')).toBeNull();
    expect(memberKeyFromParts('eu', 'tarren-mill', 'rus.ty')).toBeNull();
    expect(memberKeyFromParts('eu', 'tarren-mill', '')).toBeNull();
  });

  it('reads a path whether or not Next already decoded it', () => {
    expect(memberKeyFromPath('eu', 'tarren-mill', 'rust%C3%BD')).toEqual(rusty);
    expect(memberKeyFromPath('eu', 'tarren-mill', 'rustý')).toEqual(rusty);
    expect(memberKeyFromPath('EU', 'Tarren-Mill', 'RUST%C3%9D')).toEqual(rusty);
  });

  it('round-trips a link back to its key', () => {
    const [, , region, realm, name] = characterHref({ region: 'eu', realmSlug: 'tarren-mill', name: 'Rustý' }).split('/');
    expect(memberKeyFromPath(region!, realm!, name!)).toEqual(rusty);
  });

  it('treats a segment that will not decode as no key', () => {
    expect(memberKeyFromPath('eu', 'tarren-mill', '%E0%A4%A')).toBeNull();
  });
});
```

- [ ] **Step 2: Run them.** `npx vitest run src/core/characters/member-key.test.ts`. Expected: FAIL, the three functions aren't exported.

- [ ] **Step 3: Implement.** In `member-key.ts`, replace `parseMemberKey` with these, keeping its doc position:

```ts
export function memberKeyFromParts(region: string, realmSlug: string, name: string): MemberKey | null {
  const r = region.toLowerCase();
  const slug = realmSlug.toLowerCase();
  if (!(REGIONS as readonly string[]).includes(r) || !SLUG.test(slug) || !NAME.test(name)) return null;
  return { region: r as Region, realmSlug: slug, nameKey: nameKeyOf(name) };
}

export function parseMemberKey(raw: string): MemberKey | null {
  const parts = raw.trim().split('.');
  return parts.length === 3 ? memberKeyFromParts(parts[0]!, parts[1]!, parts[2]!) : null;
}

/** A character page's address. The name is folded, so links read lowercase, as Raider.IO's do. */
export const characterHref = (c: { region: Region; realmSlug: string; name: string }) =>
  `/characters/${c.region}/${c.realmSlug}/${encodeURIComponent(nameKeyOf(c.name))}`;

/**
 * Route segments, decoded once more. Names and slugs never contain `%`, so decoding a segment Next
 * already decoded changes nothing. A segment that won't decode is no key.
 */
export function memberKeyFromPath(region: string, realm: string, name: string): MemberKey | null {
  try {
    return memberKeyFromParts(decodeURIComponent(region), decodeURIComponent(realm), decodeURIComponent(name));
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run them.** `npx vitest run src/core/characters/member-key.test.ts`. Expected: PASS, the existing `parseMemberKey` tests included. Then run the gate.

- [ ] **Step 5: Commit.**

```sh
git add src/core/characters/member-key.ts src/core/characters/member-key.test.ts
git commit -m "feat: build and read character paths from member keys"
```

---

### Task 3: Find a character by key

**Files:**
- Modify: `src/core/db/queries/characters.ts`
- Test: `src/core/db/queries/characters.test.ts`

**Interfaces:**
- Consumes: `MemberKey` from `src/core/characters/member-key.ts`.
- Produces: `findCharacterByKey(db: Db, key: MemberKey): Promise<CharacterRow | undefined>`.

- [ ] **Step 1: Write the failing test.** Add `findCharacterByKey` to the import in `characters.test.ts` and append inside `describe('characters', …)`:

```ts
  it('finds a character by region, realm slug and folded name', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    await insertCharacter(db, { ...newCharacter, realmId: 1096, realmSlug: 'argent-dawn', realmName: 'Argent Dawn' }, 2);
    expect((await findCharacterByKey(db, { region: 'eu', realmSlug: 'tarren-mill', nameKey: 'birkibjörn' }))?.id).toBe(id);
    expect(await findCharacterByKey(db, { region: 'eu', realmSlug: 'silvermoon', nameKey: 'birkibjörn' })).toBeUndefined();
    expect(await findCharacterByKey(db, { region: 'us', realmSlug: 'tarren-mill', nameKey: 'birkibjörn' })).toBeUndefined();
  });
```

The key's `nameKey` is already folded: callers build keys with `memberKeyFromParts`, which is what makes an uppercase path match (Task 2 tests it).

- [ ] **Step 2: Run it.** `npx vitest run src/core/db/queries/characters.test.ts`. Expected: FAIL, `findCharacterByKey` isn't exported.

- [ ] **Step 3: Implement.** In `characters.ts`, add the type import and the query after `getCharacter`:

```ts
import type { MemberKey } from '../../characters/member-key';
```

```ts
// Blizzard realm slugs are unique within a region. The identity index is on realm_id, and a scan of a few dozen rows is fine.
export const findCharacterByKey = (db: Db, key: MemberKey) => db.select().from(characters)
  .where(and(eq(characters.region, key.region), eq(characters.realmSlug, key.realmSlug), eq(characters.nameKey, key.nameKey)))
  .get();
```

`member-key.ts` imports `name-key.ts` and `../types` only, so there's no import cycle.

- [ ] **Step 4: Run it.** Expected: PASS. Then run the gate.

- [ ] **Step 5: Commit.**

```sh
git add src/core/db/queries/characters.ts src/core/db/queries/characters.test.ts
git commit -m "feat: look up a character by member key"
```

---

### Task 4: Links use the character path

**Files:**
- Modify: `src/server/views/types.ts` (`CharacterSummary`)
- Modify: `src/server/views/summarize.ts` (`summarize`)
- Modify: `src/components/character-card/CharacterCard.tsx:28`
- Modify: `src/components/group-grid/MemberHeader.tsx:13,21`
- Modify: `src/components/character-page/ListTabs.tsx`
- Modify: `src/app/characters/[id]/page.tsx` (the `ListTabs` call only; Task 5 deletes this file)
- Modify: `src/components/group-grid/GroupGrid.test.ts` (fixture)
- Test: `src/server/views/views.test.ts`

**Interfaces:**
- Consumes: `characterHref` from Task 2.
- Produces: `CharacterSummary.href: string`. `ListTabs` props become `Pick<CharacterPageView, 'href' | 'listType' | 'counts'>`.

- [ ] **Step 1: Write the failing test.** In `views.test.ts`, in `describe('getCharacterCards', …)`, add:

```ts
  it('links each card to its character path', async () => {
    const s = await services();
    await seed(s);
    const { cards: [card] } = await getCharacterCards(s);
    expect(card!.href).toBe('/characters/eu/test-realm/birkibj%C3%B6rn');
  });
```

- [ ] **Step 2: Run it.** `npx vitest run src/server/views/views.test.ts`. Expected: FAIL, `href` is undefined.

- [ ] **Step 3: Implement.**
  - In `types.ts`, add to `CharacterSummary` after `id`:

    ```ts
      /** The character page's path, for example `/characters/eu/tarren-mill/rust%C3%BD`. */
      href: string;
    ```

  - In `summarize.ts`, import `characterHref` from `@/core/characters/member-key` and add `href: characterHref(c),` after `id: c.id,`.
  - In `CharacterCard.tsx`, change `href={`/characters/${card.id}`}` to `href={card.href}`.
  - In `MemberHeader.tsx`, change both `href={`/characters/${c.id}`}` to `href={c.href}`.
  - Change `ListTabs.tsx` to:

    ```tsx
    export function ListTabs({ href, listType, counts }: Pick<CharacterPageView, 'href' | 'listType' | 'counts'>) {
      return (
        <nav aria-label="BiS lists" className="flex gap-2 border-b border-line">
          {LIST_TYPES.map((l) => (
            <Link key={l} href={`${href}?list=${l}`} aria-current={l === listType ? 'page' : undefined}
    ```

    The rest of the file stays as it is.
  - In `src/app/characters/[id]/page.tsx`, change `<ListTabs id={view.id} …` to `<ListTabs href={view.href} …`.
  - In `GroupGrid.test.ts`, add `href: '/characters/eu/argent-dawn/birkibj%C3%B6rn',` to the `summary` fixture after `id, name,`.

- [ ] **Step 4: Run it.** Expected: PASS. Then run the gate. Check that `grep -rn '/characters/\${' src` lists only `/api/characters/` calls.

- [ ] **Step 5: Commit.**

```sh
git add src/server/views src/components/character-card src/components/group-grid src/components/character-page/ListTabs.tsx "src/app/characters/[id]/page.tsx"
git commit -m "feat: link characters by path instead of id"
```

---

### Task 5: Route by path, auto-add untracked characters

**Files:**
- Modify: `src/server/views/types.ts` (add `UntrackedCharacterView`)
- Modify: `src/server/views/character-page.ts`
- Test: `src/server/views/views.test.ts`
- Create: `src/components/auto-add-character/AutoAddCharacter.tsx`
- Create: `src/app/characters/[region]/[realm]/[name]/page.tsx`
- Delete: `src/app/characters/[id]/page.tsx`

**Interfaces:**
- Consumes: `MemberKey` and `memberKeyFromPath` from Task 2, `findCharacterByKey` from Task 3, `CharacterSummary.href` from Task 4.
- Produces:
  - `UntrackedCharacterView = { status: 'untracked'; region: Region; realmSlug: string; name: string }`
  - `getCharacterPage(services: Services, key: MemberKey, listType?: ListType): Promise<CharacterPageView | UntrackedCharacterView>`

- [ ] **Step 1: Read the docs.** Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` and `page.md`. Confirm nested dynamic segments arrive as `params: Promise<{ region: string; realm: string; name: string }>`. The docs don't say whether segments arrive decoded, which is why `memberKeyFromPath` decodes either way.

- [ ] **Step 2: Write the failing tests.** In `views.test.ts`, add `import type { MemberKey } from '@/core/characters/member-key';` and `import type { CharacterPageView } from './types';`, and under `seed`:

```ts
const BIRKI: MemberKey = { region: 'eu', realmSlug: 'test-realm', nameKey: 'birkibjörn' };
/** Birkibjörn's page. Every caller seeds Birkibjörn first, so the result is never `untracked`. */
const birkiPage = async (s: Services) => (await getCharacterPage(s, BIRKI)) as CharacterPageView;
```

Search `views.test.ts` for every `getCharacterPage(s, id)` and change it to `birkiPage(s)`. The `page!.` accesses stay valid. In tests that no longer use `id` afterwards, change `const id = await seed(s…)` to `await seed(s…)`, so lint doesn't flag an unused variable. Keep `const { id } = await insertCharacter(…)` where `saveSnapshotIfChanged` still needs it. Replace the `returns null for an unknown character` test with:

```ts
  it('links the page to its own path', async () => {
    const s = await services();
    await seed(s);
    await prime(s);
    expect((await birkiPage(s)).href).toBe('/characters/eu/test-realm/birkibj%C3%B6rn');
  });

  it('reports a character that isn’t tracked, by its key', async () => {
    const s = await services();
    await seed(s);
    expect(await getCharacterPage(s, { region: 'eu', realmSlug: 'test-realm', nameKey: 'rustý' }))
      .toEqual({ status: 'untracked', region: 'eu', realmSlug: 'test-realm', name: 'rustý' });
  });
```

- [ ] **Step 3: Run them.** `npx vitest run src/server/views/views.test.ts`. Expected: FAIL, since `getCharacterPage` still takes an ID.

- [ ] **Step 4: Implement the loader.**
  - In `types.ts`, after `CharacterPageView`:

    ```ts
    /** A character path that names no tracked character. `name` is the path's folded name. */
    export interface UntrackedCharacterView { status: 'untracked'; region: Region; realmSlug: string; name: string }
    ```

  - In `character-page.ts`, swap `getCharacter` for `findCharacterByKey`, import `type MemberKey` from `@/core/characters/member-key`, import `UntrackedCharacterView` from `./types`, and change the head of the function:

    ```ts
    export async function getCharacterPage(services: Services, key: MemberKey, listType?: ListType): Promise<CharacterPageView | UntrackedCharacterView> {
      const { db, blizzard, now } = services;
      const character = await findCharacterByKey(db, key);
      if (!character) return { status: 'untracked', region: key.region, realmSlug: key.realmSlug, name: key.nameKey };
    ```

    The rest stays as it is.

- [ ] **Step 5: Run them.** Expected: PASS. Typecheck still fails, because the old page passes a number; the next steps replace it.

- [ ] **Step 6: Create `src/components/auto-add-character/AutoAddCharacter.tsx`:**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { runApiAction } from '@/components/shared/api-action';
import type { UntrackedCharacterView } from '@/server/views/types';

/**
 * Tracks a character opened by path, then re-renders the same URL as its page. The add runs here,
 * through the guarded POST route, because a page render must never write on GET.
 */
export function AutoAddCharacter({ character }: { character: UntrackedCharacterView }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Strict Mode mounts twice in development; one POST is enough. A refresh keeps this mounted, so a failure never retries.
  const started = useRef(false);
  const { region, realmSlug, name } = character;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runApiAction(fetch, '/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, realmSlug, name }),
    }, 'Couldn’t add that character.').then((result) => {
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }, [region, realmSlug, name, router]);

  return error
    ? <p role="alert" className="text-[#f3c9a2]">{error}</p>
    : <p className="text-muted">Adding {name} – {realmSlug}…</p>;
}
```

- [ ] **Step 7: Create `src/app/characters/[region]/[realm]/[name]/page.tsx`.** Move the old page with `git mv "src/app/characters/[id]/page.tsx" "src/app/characters/[region]/[realm]/[name]/page.tsx"`, create the directories first, then change:

```tsx
import { AutoAddCharacter } from '@/components/auto-add-character/AutoAddCharacter';
import { memberKeyFromPath } from '@/core/characters/member-key';
```

```tsx
type Props = { params: Promise<{ region: string; realm: string; name: string }>; searchParams: Promise<{ list?: string }> };

export default async function CharacterPage({ params, searchParams }: Props) {
  const [{ region, realm, name }, { list }] = await Promise.all([params, searchParams]);
  const key = memberKeyFromPath(region, realm, name);
  if (!key) notFound();
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (isMissingConfigError(err)) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const listType = (LIST_TYPES as readonly string[]).includes(list ?? '') ? (list as ListType) : undefined;
  const view = await getCharacterPage(services, key, listType);
  if (view.status === 'untracked') {
    return (
      <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
        <Link href="/" className="text-sm">&larr; All characters</Link>
        <AutoAddCharacter character={view} />
      </main>
    );
  }
  const now = services.now();
```

The JSX for a tracked character stays as it is, `ListTabs href={view.href}` included. Confirm `src/app/characters/[id]/` no longer exists.

- [ ] **Step 8: Run the full gate and the build.** Stop `npm run dev` if it's serving this folder, then `npm run typecheck && npm run lint && npm test`, then the production build. Expected: all green, and the build's route list shows `/characters/[region]/[realm]/[name]` with no `/characters/[id]`.

- [ ] **Step 9: Commit.**

```sh
git add -A src/server/views "src/app/characters" src/components/auto-add-character
git commit -F - <<'EOF'
feat: open characters by region, realm and name

Path works on any install and survives a database rebuild.
Untracked path adds from the client through the guarded POST,
never on GET. Old /characters/<id> route removed: 404.
EOF
```

- [ ] **Step 10: Hand checks, for the PR's Testing section.** Run the production server (`npx next start -p 3001`) against a copy of `data/app.db`, or leave each check open in the PR for the owner:
  - Open a tracked character from a card, a group header and a list tab. Switch to `?list=raid` and back.
  - Open `/characters/EU/Tarren-Mill/<NAME IN CAPITALS>` for a tracked character: same page, no duplicate on the list.
  - Open an untracked path: "Adding … – …" appears, then the page fills in at the same URL.
  - Open a misspelled name: Blizzard's message shows once, the server log shows one `POST /api/characters`, nothing new on the list.
  - `/characters/2` gets 404.
  - **Foreign frame:** serve a page from `http://127.0.0.1:8080` whose only content is `<iframe src="http://localhost:3001/characters/eu/<realm>/<untracked name>"></iframe>`, for example with `node -e "require('http').createServer((q,s)=>s.end('<iframe src=\"http://localhost:3001/characters/eu/<realm>/<name>\"></iframe>')).listen(8080,'127.0.0.1')"`. The frame must not render. The console must report the `frame-ancestors` block. The server log must show no `POST /api/characters`, and the character must not appear on the list. `curl -sI http://localhost:3001/` shows both headers.
