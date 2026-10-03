# Plan 3b: Group Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/group` page that shows up to five same-region characters side by side by slot, ranks the season's dungeons for the whole group, and lists each member's Great Vault choices.

**Architecture:** Members are identity keys (`eu.argent-dawn.birkibjörn`) in the URL, parsed by a pure core module that also does the region rule, the cap, and the cookie encoding. A new loader, `getGroupPage`, reuses per-character loading extracted from the character page loader into `member.ts`, aligns rows by evaluated slot, and feeds eligible members to the existing `rankDungeons`. Server components render the grid, priority and vault; small client components edit the URL, remember the group in a cookie, and track characters.

**Tech Stack:** TypeScript, Next.js 16 App Router, React 19, Drizzle over libsql, Tailwind v4, Vitest in a Node environment.

**Spec:** `docs/superpowers/specs/2026-10-03-plan-3b-group-page-design.md`. Its parents, `2026-09-26-gear-tracker-design.md` and `2026-09-30-plan-3a-dungeon-priority-design.md`, stay the authority for scoring.

## Global Constraints

- **Read `AGENTS.md` first. It is binding.** The rules this plan leans on most:
  - `src/core` never imports `next`, `react`, or anything from `src/app`, `src/components` or `src/server`.
  - Every database write goes through `withWriteLock`. Database work in one code path runs in sequence, never in parallel with a write.
  - Check errors with `isHttpError` / `isUserError` / `isMissingConfigError`, never `instanceof`.
  - Every component lives in its own kebab-case directory. Branching logic goes in a plain `.ts` beside it, with tests. `.tsx` holds JSX.
  - Pages receive view types, never database rows. Pages and route handlers stay thin.
  - Use semantic Tailwind tokens (`bg-surface`, `border-line`, `text-muted`, `text-gold`, `text-crest`, `text-vault`, `text-bags`). Don't hardcode new hex values.
  - Color is never the only signal: every dimmed or tinted state has words beside it.
- **Next.js 16:** `searchParams` and `cookies()` are async. Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` and `.../redirect.md` before Task 11.
- **Tests first.** Write the failing test, watch it fail for the right reason, then implement.
- Tests are `src/**/*.test.ts` in a Node environment with no DOM. Server components are tested with `renderToStaticMarkup`. Components using hooks are not unit-tested; their logic lives in tested `.ts` files.
- Fixtures use made-up names: Birkibjörn, Hrafnhildur, Sólrún, Gnúpur; realms `argent-dawn` ("Argent Dawn") and `azjol-nerub`. Never real players.
- **Never run `npm run build` while `npm run dev` serves this folder.**
- Gate before each task's commit: `npm run typecheck && npm run lint && npm test`, with lint printing nothing. Also `npm run build` when pages or components changed.
- Commit subjects: `type: lowercase imperative summary`, no period. Prose bodies saying why. **No AI attribution in commits or the PR.**
- Group size cap: `5`. Cookie name: `group`. Cookie attributes: `path=/; max-age=31536000; SameSite=Lax`.
- On-screen copy, verbatim from the spec:
  - "Pick up to five characters to compare their gear and rank dungeons for the group."
  - "Group is full (5)"
  - "<name> (<REGION>) dropped: group members must share a region."
  - "Dungeon priority needs at least one member with gear and a BiS list."
  - "Covers <names>. Left out: <name> (<reason>)."
  - "No season dungeon drops anything the group still needs."
  - "Nothing anyone needs from: …"
  - "Split dungeon: loot shown for the whole instance."
  - "No SimC paste yet." / "No item choices in the vault in the last paste." / "from SimC pasted <age>"
  - "Not tracked", "Syncing…", "No BiS list", "Blizzard can't find this character", "Couldn't sync: <error>"

## Deviations from the spec, decided while planning

These keep the spec's behavior and change only where code lives. The spec's intent wins if one of them turns out wrong.

- **Identity lookup** is a pure match (`findByMemberKey`) over `listCharacters`, which the loader reads anyway for the dropdown, instead of a new SQL query. Same test as the spec's "identity lookup".
- **Key arithmetic** (`addMember`, `removeMember`, `groupHref`) lives in the core module `src/core/characters/member-key.ts`, not `group-members/member-keys.ts`, because three components use it and the server redirect does too.
- **Search reuse:** rather than moving `use-character-search.ts` and `SearchResults.tsx`, `AddCharacterBar` gains two optional props (`lockedRegion`, `onAdded`) and the group page renders it. That reuses the manual realm fallback too, with less code.
- **Method fetches during a group render run in sequence**, one per distinct spec, because database work must not run in parallel with a write. Cold-cache cost is one Method request per spec, once a day.

## Before Task 1

Create the implementation branch from the branch holding the spec and this plan: `git checkout docs/group-page-spec && git checkout -b feat/group-page`. Every task commits there.

## Review Focus

- **A URL or cookie value that is junk, half-encoded, or hand-typed with capitals and `ö`.** Expected: valid keys survive, case-folded; the rest are ignored; nothing throws. Tests in Tasks 2 and 4.
- **The only member is removed.** Expected: URL becomes `/group?chars=`, the cookie becomes empty, and the nav link opens an empty group instead of bouncing back. Tests in Task 4 (no redirect for an empty parameter) and Task 2 (an empty group's cookie decodes to no keys).
- **A character is deleted from the Characters page while it's in the remembered group.** Expected: its column becomes "Not tracked" with a Track button, nothing crashes. Test in Task 7.
- **A member whose BiS list is unavailable next to members that are fine.** Expected: that column says "No BiS list", the ranking covers the others and names who was left out. Test in Task 7.
- **The Track button for a key Blizzard can't find.** Expected: the route's `UserError` message shows under the button with a Remove from group button. No automated test (client component); listed in the PR's hand checks.

---

### Task 1: Failure backoff for `ensureBisLists`

**Files:**
- Modify: `src/core/sync/reference-sync.ts:32-47`
- Test: `src/core/sync/reference-sync.test.ts`

**Interfaces:**
- Produces: `ensureBisLists` keeps its signature and `BisResult` type. New exported constant `BIS_RETRY_MS = 3_600_000`.

- [ ] **Step 1: Write the failing tests**

Add inside the existing `describe('ensureBisLists', ...)` in `src/core/sync/reference-sync.test.ts`, and add `BIS_RETRY_MS` to the import from `./reference-sync`:

```ts
  it('after a failure with a cache, serves the cache and the error for an hour without asking again', async () => {
    const db = await openTestDb();
    await ensureBisLists({ db, source: source(async () => lists).s, now: 1000 }, 'guardian-druid');
    const down = source(async () => { throw new Error('down'); });
    const expired = 1000 + DAY_MS;
    const failed = { lists, fetchedAt: 1000, error: 'BiS list couldn’t be updated' };
    expect(await ensureBisLists({ db, source: down.s, now: expired }, 'guardian-druid')).toEqual(failed);
    expect(await ensureBisLists({ db, source: down.s, now: expired + BIS_RETRY_MS - 1 }, 'guardian-druid')).toEqual(failed);
    expect(down.calls()).toBe(1);
    await ensureBisLists({ db, source: down.s, now: expired + BIS_RETRY_MS }, 'guardian-druid');
    expect(down.calls()).toBe(2);
  });

  it('keeps a cold-cache 404 message during the backoff, and recovers after it', async () => {
    const db = await openTestDb();
    const missing = source(async () => { throw new HttpError(404, 'u', ''); });
    const noPage = { lists: null, fetchedAt: null, error: 'Fake has no gearing page for "nope-nope"' };
    expect(await ensureBisLists({ db, source: missing.s, now: 1 }, 'nope-nope')).toEqual(noPage);
    expect(await ensureBisLists({ db, source: missing.s, now: 2 }, 'nope-nope')).toEqual(noPage);
    expect(missing.calls()).toBe(1);
    const back = source(async () => lists);
    expect(await ensureBisLists({ db, source: back.s, now: 1 + BIS_RETRY_MS }, 'nope-nope')).toEqual({ lists, fetchedAt: 1 + BIS_RETRY_MS, error: null });
  });

  it('backs off per spec, so one failing spec does not stop another', async () => {
    const db = await openTestDb();
    await ensureBisLists({ db, source: source(async () => { throw new Error('down'); }).s, now: 1 }, 'guardian-druid');
    const other = source(async () => lists);
    expect((await ensureBisLists({ db, source: other.s, now: 2 }, 'feral-druid')).error).toBeNull();
    expect(other.calls()).toBe(1);
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: FAIL. `BIS_RETRY_MS` is not exported, and once it is, `down.calls()` is 2 instead of 1.

- [ ] **Step 3: Implement the backoff**

In `src/core/sync/reference-sync.ts`, below `DAY_MS`:

```ts
export const BIS_RETRY_MS = 60 * 60 * 1000;
// One entry per spec: the value is the error message, so a skipped retry can repeat it.
const bisFailedKey = (specSlug: string) => `bis.${specSlug}.failed`;
```

Replace `ensureBisLists` with:

```ts
/** Refreshes a spec's BiS lists daily. On failure keeps what it has, and retries that spec at most hourly. */
export async function ensureBisLists(deps: { db: Db; source: BisSource; now: number }, specSlug: string): Promise<BisResult> {
  const { db, source, now } = deps;
  const cached = await getBisLists(db, specSlug);
  if (cached && now - cached.fetchedAt < DAY_MS) return { lists: cached.lists, fetchedAt: cached.fetchedAt, error: null };
  const failed = await getMeta(db, bisFailedKey(specSlug));
  if (failed && now - failed.updatedAt < BIS_RETRY_MS) {
    return { lists: cached?.lists ?? null, fetchedAt: cached?.fetchedAt ?? null, error: failed.value };
  }
  try {
    const lists = await source.fetchLists(specSlug);
    if (lists.overall.length + lists.raid.length + lists.mythicPlus.length === 0) throw new Error('No BiS tables found');
    await replaceBisLists(db, specSlug, lists, now);
    return { lists, fetchedAt: now, error: null };
  } catch (err) {
    const error = isHttpError(err) && err.status === 404 && !cached
      ? `${source.name} has no gearing page for "${specSlug}"`
      : 'BiS list couldn’t be updated';
    await setMeta(db, bisFailedKey(specSlug), error, now);
    return { lists: cached?.lists ?? null, fetchedAt: cached?.fetchedAt ?? null, error };
  }
}
```

- [ ] **Step 4: Run the file and the whole suite**

Run: `npx vitest run src/core/sync/reference-sync.test.ts` → PASS. Then the gate: `npm run typecheck && npm run lint && npm test` → all green.

- [ ] **Step 5: Commit**

```bash
git add src/core/sync/reference-sync.ts src/core/sync/reference-sync.test.ts
git commit -m "fix: retry a failed method fetch at most hourly" -m "While Method was down, every page load waited for the request to fail,
up to ten seconds. The group page asks for up to five specs at once,
so a failed spec now serves its cache and stored error for an hour,
as the Raidbots data already does."
```

---

### Task 2: Member keys

**Files:**
- Create: `src/core/characters/member-key.ts`
- Test: `src/core/characters/member-key.test.ts`

**Interfaces:**
- Produces, all exported from `@/core/characters/member-key`:

```ts
export interface MemberKey { region: Region; realmSlug: string; nameKey: string }
export const MAX_GROUP_SIZE = 5;
export const GROUP_COOKIE = 'group';
export function memberKeyOf(c: { region: Region; realmSlug: string; name: string }): MemberKey;
export function formatMemberKey(key: MemberKey): string;            // "eu.argent-dawn.birkibjörn"
export function parseMemberKey(raw: string): MemberKey | null;
export function parseMemberKeys(raw: string): MemberKey[];          // drops junk and repeats, no cap
export function selectGroup(keys: MemberKey[]): { members: MemberKey[]; dropped: MemberKey[] };
export function findByMemberKey<T extends { region: Region; realmSlug: string; name: string }>(rows: readonly T[], key: MemberKey): T | undefined;
export function addMember(keys: readonly string[], key: string): string[];
export function removeMember(keys: readonly string[], key: string): string[];
export function groupHref(keys: readonly string[]): string;         // "/group?chars=…"
export function encodeGroupCookie(keys: readonly string[]): string;
export function decodeGroupCookie(value: string | undefined): MemberKey[];
```

- [ ] **Step 1: Write the failing tests**

`src/core/characters/member-key.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addMember, decodeGroupCookie, encodeGroupCookie, findByMemberKey, formatMemberKey, groupHref,
  memberKeyOf, parseMemberKey, parseMemberKeys, removeMember, selectGroup, type MemberKey,
} from './member-key';

const birki: MemberKey = { region: 'eu', realmSlug: 'argent-dawn', nameKey: 'birkibjörn' };
const key = (region: 'eu' | 'us', name: string): MemberKey => ({ region, realmSlug: 'argent-dawn', nameKey: name });

describe('member keys', () => {
  it('builds a key from a character, folding the name', () => {
    expect(memberKeyOf({ region: 'eu', realmSlug: 'argent-dawn', name: 'Birkibjörn' })).toEqual(birki);
    expect(formatMemberKey(birki)).toBe('eu.argent-dawn.birkibjörn');
  });

  it('parses a hand-typed key with capitals and ö', () => {
    expect(parseMemberKey('EU.Argent-Dawn.BIRKIBJÖRN')).toEqual(birki);
    expect(parseMemberKey(' eu.argent-dawn.birkibjörn ')).toEqual(birki);
  });

  it('rejects keys that are not region, realm slug and a name of letters', () => {
    for (const bad of ['', 'eu.argent-dawn', 'xx.argent-dawn.birki', 'eu.argent dawn.birki', 'eu.argent-dawn.birki2', 'eu.-dawn.birki', 'eu.a.b.c']) {
      expect(parseMemberKey(bad)).toBeNull();
    }
  });

  it('parses a list, dropping junk and repeats but keeping order', () => {
    expect(parseMemberKeys('eu.argent-dawn.hrafnhildur,junk,,EU.argent-dawn.Hrafnhildur,eu.argent-dawn.birkibjörn'))
      .toEqual([key('eu', 'hrafnhildur'), birki]);
  });

  it('applies the region rule before the cap', () => {
    const keys = [key('eu', 'a'), key('us', 'b'), key('us', 'c'), key('us', 'd'), key('us', 'e'),
      key('eu', 'f'), key('eu', 'g'), key('eu', 'h'), key('eu', 'i'), key('eu', 'j')];
    const { members, dropped } = selectGroup(keys);
    expect(members.map((k) => k.nameKey)).toEqual(['a', 'f', 'g', 'h', 'i']);
    expect(dropped.map((k) => k.nameKey)).toEqual(['b', 'c', 'd', 'e']);
    expect(selectGroup([])).toEqual({ members: [], dropped: [] });
  });

  it('finds a tracked character by region, realm slug and folded name', () => {
    const rows = [
      { region: 'eu' as const, realmSlug: 'azjol-nerub', name: 'Birkibjörn', id: 1 },
      { region: 'eu' as const, realmSlug: 'argent-dawn', name: 'Birkibjörn', id: 2 },
    ];
    expect(findByMemberKey(rows, birki)?.id).toBe(2);
    expect(findByMemberKey(rows, key('us', 'birkibjörn'))).toBeUndefined();
  });

  it('adds without repeats or going past five, and removes', () => {
    expect(addMember(['a'], 'b')).toEqual(['a', 'b']);
    expect(addMember(['a', 'b'], 'a')).toEqual(['a', 'b']);
    expect(addMember(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(removeMember(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('builds a group link that round-trips through the URL', () => {
    const href = groupHref([formatMemberKey(birki), 'eu.argent-dawn.hrafnhildur']);
    expect(href).toBe('/group?chars=eu.argent-dawn.birkibj%C3%B6rn,eu.argent-dawn.hrafnhildur');
    const chars = new URL(href, 'http://localhost').searchParams.get('chars')!;
    expect(parseMemberKeys(chars)).toEqual([birki, key('eu', 'hrafnhildur')]);
    expect(groupHref([])).toBe('/group?chars=');
  });

  it('round-trips the cookie, and treats a malformed one as empty', () => {
    expect(decodeGroupCookie(encodeGroupCookie([formatMemberKey(birki)]))).toEqual([birki]);
    expect(decodeGroupCookie('eu.argent-dawn.birkibjörn')).toEqual([birki]); // already decoded by Next
    expect(decodeGroupCookie('%E0%A4%A')).toEqual([]);
    expect(decodeGroupCookie(undefined)).toEqual([]);
    expect(decodeGroupCookie(encodeGroupCookie([]))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/core/characters/member-key.test.ts`
Expected: FAIL, "Failed to resolve import ./member-key".

- [ ] **Step 3: Implement the module**

`src/core/characters/member-key.ts`:

```ts
import { REGIONS, type Region } from '../types';
import { nameKeyOf } from './name-key';

/**
 * A group member named by who it is rather than by database row, so a group link works on any install
 * and survives a character being removed and tracked again. Realm slugs always come from a stored
 * character (Blizzard's profile), never from a realm display name or a Raider.IO slug.
 */
export interface MemberKey { region: Region; realmSlug: string; nameKey: string }

export const MAX_GROUP_SIZE = 5;
export const GROUP_COOKIE = 'group';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAME = /^\p{L}+$/u;

export function memberKeyOf(c: { region: Region; realmSlug: string; name: string }): MemberKey {
  return { region: c.region, realmSlug: c.realmSlug, nameKey: nameKeyOf(c.name) };
}

export const formatMemberKey = (key: MemberKey) => `${key.region}.${key.realmSlug}.${key.nameKey}`;

export function parseMemberKey(raw: string): MemberKey | null {
  const parts = raw.trim().split('.');
  if (parts.length !== 3) return null;
  const region = parts[0]!.toLowerCase();
  const realmSlug = parts[1]!.toLowerCase();
  const name = parts[2]!;
  if (!(REGIONS as readonly string[]).includes(region) || !SLUG.test(realmSlug) || !NAME.test(name)) return null;
  return { region: region as Region, realmSlug, nameKey: nameKeyOf(name) };
}

/** A comma-separated list of keys. Keys that don't parse, and repeats, are dropped. */
export function parseMemberKeys(raw: string): MemberKey[] {
  const seen = new Set<string>();
  const keys: MemberKey[] = [];
  for (const part of raw.split(',')) {
    const key = parseMemberKey(part);
    if (!key || seen.has(formatMemberKey(key))) continue;
    seen.add(formatMemberKey(key));
    keys.push(key);
  }
  return keys;
}

/** Members share the first key's region, so keys from another region are dropped before the cap. */
export function selectGroup(keys: MemberKey[]): { members: MemberKey[]; dropped: MemberKey[] } {
  const region = keys[0]?.region;
  return {
    members: keys.filter((k) => k.region === region).slice(0, MAX_GROUP_SIZE),
    dropped: keys.filter((k) => k.region !== region),
  };
}

export function findByMemberKey<T extends { region: Region; realmSlug: string; name: string }>(rows: readonly T[], key: MemberKey): T | undefined {
  const wanted = formatMemberKey(key);
  return rows.find((row) => formatMemberKey(memberKeyOf(row)) === wanted);
}

export function addMember(keys: readonly string[], key: string): string[] {
  return keys.includes(key) || keys.length >= MAX_GROUP_SIZE ? [...keys] : [...keys, key];
}

export const removeMember = (keys: readonly string[], key: string) => keys.filter((k) => k !== key);

/** Commas stay readable; each key is encoded on its own so `ö` survives. */
export const groupHref = (keys: readonly string[]) => `/group?chars=${keys.map(encodeURIComponent).join(',')}`;

export const encodeGroupCookie = (keys: readonly string[]) => encodeURIComponent(keys.join(','));

/** Keys never contain `%`, so decoding a value Next already decoded changes nothing. A value that won't decode is no group. */
export function decodeGroupCookie(value: string | undefined): MemberKey[] {
  if (!value) return [];
  try {
    return parseMemberKeys(decodeURIComponent(value));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run the tests and the gate**

Run: `npx vitest run src/core/characters/member-key.test.ts` → PASS. Then `npm run typecheck && npm run lint && npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/core/characters/member-key.ts src/core/characters/member-key.test.ts
git commit -m "feat: name group members by region, realm and name" -m "A database ID means nothing on another install, and a deleted character
leaves nothing to search with. An identity key survives both, can be
typed by hand, and carries the region the group rule needs."
```

---

### Task 3: The add route returns the member key

**Files:**
- Modify: `src/core/characters/add-character.ts:23-54`
- Test: `src/core/characters/add-character.test.ts`

**Interfaces:**
- Consumes: `memberKeyOf`, `formatMemberKey` from Task 2.
- Produces: `addCharacter(...)` now resolves to `{ id: number; created: boolean; key: string }`. `POST /api/characters` returns the same JSON, since its route passes the result through unchanged.

- [ ] **Step 1: Write the failing tests**

In `src/core/characters/add-character.test.ts`, change the profile in `deps()` to a multi-word realm with a display name that isn't its slug:

```ts
    getRealms: async () => [{ id: 503, name: 'Argent Dawn', slug: 'argent-dawn' }],
    getProfile: profileImpl ?? (async (ref: CharacterRef) => {
      asked.push(ref);
      return { name: 'Birkibjörn', realmId: 503, realmSlug: 'argent-dawn', realmName: 'Argent Dawn', className: 'Druid', specName: 'Guardian' };
    }),
```

Replace `azjol-nerub` with `argent-dawn` and `Azjol-Nerub` with `Argent Dawn` throughout the file. In the first test, add:

```ts
    expect(result.key).toBe('eu.argent-dawn.birkibjörn');
```

In "returns the existing character without syncing again", replace the `toEqual` line with:

```ts
    expect(second).toEqual({ id: first.id, created: false, key: 'eu.argent-dawn.birkibjörn' });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/core/characters/add-character.test.ts`
Expected: FAIL, `result.key` is `undefined`.

- [ ] **Step 3: Return the key**

In `src/core/characters/add-character.ts`, import `{ formatMemberKey, memberKeyOf } from './member-key'`, change the return type to `Promise<{ id: number; created: boolean; key: string }>`, and replace the last two lines with:

```ts
  if (result.created) await syncer.sync(result.id, { force: true });
  // The slug and name come from Blizzard's profile, the same values the stored row holds.
  return { ...result, key: formatMemberKey(memberKeyOf({ region: input.region, realmSlug: profile.realmSlug, name: profile.name })) };
```

- [ ] **Step 4: Run the tests and the gate**

Run: `npx vitest run src/core/characters/add-character.test.ts` → PASS. Then `npm run typecheck && npm run lint && npm test`. `AddCharacterBar` reads only `id`, so its behavior doesn't change.

- [ ] **Step 5: Commit**

```bash
git add src/core/characters/add-character.ts src/core/characters/add-character.test.ts
git commit -m "feat: return the member key when adding a character" -m "A search result has a Blizzard realm ID and a display name but no slug,
so the group page can't build a member key from it. The route answers
with the key built from Blizzard's profile, for a new character and an
already tracked one alike."
```

---

### Task 4: Group request parameters

**Files:**
- Create: `src/server/views/group-page-params.ts`
- Test: `src/server/views/group-page-params.test.ts`

**Interfaces:**
- Consumes: `parseMemberKeys`, `decodeGroupCookie`, `formatMemberKey`, `groupHref` from Task 2.
- Produces:

```ts
export type GroupRequest = { redirect: string } | { keys: MemberKey[] };
export function resolveGroupRequest(chars: string | string[] | undefined, cookie: string | undefined): GroupRequest;
```

- [ ] **Step 1: Write the failing tests**

`src/server/views/group-page-params.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { encodeGroupCookie } from '@/core/characters/member-key';
import { resolveGroupRequest } from './group-page-params';

const birki = { region: 'eu', realmSlug: 'argent-dawn', nameKey: 'birkibjörn' };

describe('resolveGroupRequest', () => {
  it('redirects to the remembered group when the link has no chars', () => {
    const cookie = encodeGroupCookie(['eu.argent-dawn.birkibjörn', 'eu.argent-dawn.hrafnhildur']);
    expect(resolveGroupRequest(undefined, cookie)).toEqual({ redirect: '/group?chars=eu.argent-dawn.birkibj%C3%B6rn,eu.argent-dawn.hrafnhildur' });
  });

  it('renders an empty group without a cookie, or with an empty or malformed one', () => {
    expect(resolveGroupRequest(undefined, undefined)).toEqual({ keys: [] });
    expect(resolveGroupRequest(undefined, '')).toEqual({ keys: [] });
    expect(resolveGroupRequest(undefined, '%E0%A4%A')).toEqual({ keys: [] });
  });

  it('never redirects when chars is present, even empty', () => {
    expect(resolveGroupRequest('', encodeGroupCookie(['eu.argent-dawn.birkibjörn']))).toEqual({ keys: [] });
  });

  it('parses chars, joining a repeated parameter', () => {
    expect(resolveGroupRequest('eu.argent-dawn.Birkibjörn', undefined)).toEqual({ keys: [birki] });
    expect(resolveGroupRequest(['eu.argent-dawn.birkibjörn', 'junk'], undefined)).toEqual({ keys: [birki] });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/server/views/group-page-params.test.ts`
Expected: FAIL, "Failed to resolve import ./group-page-params".

- [ ] **Step 3: Implement**

`src/server/views/group-page-params.ts`:

```ts
import { decodeGroupCookie, formatMemberKey, groupHref, parseMemberKeys, type MemberKey } from '@/core/characters/member-key';

export type GroupRequest = { redirect: string } | { keys: MemberKey[] };

/**
 * `/group` with no `chars` reopens the remembered group. `chars` present, even empty, is taken as it is:
 * removing the last member lands on `?chars=`, and that must not bounce back to the old group.
 */
export function resolveGroupRequest(chars: string | string[] | undefined, cookie: string | undefined): GroupRequest {
  if (chars === undefined) {
    const saved = decodeGroupCookie(cookie);
    return saved.length > 0 ? { redirect: groupHref(saved.map(formatMemberKey)) } : { keys: [] };
  }
  return { keys: parseMemberKeys(Array.isArray(chars) ? chars.join(',') : chars) };
}
```

- [ ] **Step 4: Run the tests and the gate**

Run: `npx vitest run src/server/views/group-page-params.test.ts` → PASS. Then `npm run typecheck && npm run lint && npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/server/views/group-page-params.ts src/server/views/group-page-params.test.ts
git commit -m "feat: decide between reopening and rendering a group" -m "The page itself stays thin: this is the one place that reads the chars
parameter and the remembered cookie, and it never redirects an empty
parameter, so removing the last member doesn't bounce back."
```

---

### Task 5: Extract per-character loading into `member.ts`

A refactor: the character page's output must not change. Its existing tests in `src/server/views/views.test.ts` are the guard, so there is no new failing test; run them before and after.

**Files:**
- Create: `src/server/views/member.ts`
- Modify: `src/server/views/character-page.ts`

**Interfaces:**
- Produces, from `@/server/views/member`:

```ts
export interface MemberContext { db: Db; tracks: ReadonlyMap<number, Track>; bisFor: (specSlug: string) => Promise<BisResult> }
export interface MemberData {
  character: CharacterRow;
  summary: CharacterSummary;
  gear: GearContext;
  bis: BisResult;
  choice: { listType: PriorityListType; fellBack: boolean };
  /** Rows for the priority list in `choice`. */
  priorityRows: GearRow[];
  evaluate: (list: ListType) => GearRow[];
  vaultItems: SnapshotItemInput[];
}
export async function loadMember(ctx: MemberContext, character: CharacterRow, classIcons?: ReadonlyMap<string, string | null>): Promise<MemberData>;
export function rowView(row: GearRow, icons: ReadonlyMap<number, string | null>, costs: ReadonlyMap<number, CrestCost>, balances: ReadonlyMap<number, number>): GearRowView;
export function vaultChoicesFor(items: SnapshotItemInput[], listRows: BisRow[], icons: ReadonlyMap<number, string | null>, tracks: ReadonlyMap<number, Track>): VaultChoiceView[];
export function creditView(credit: Credit, icons: ReadonlyMap<number, string | null>): PriorityCreditView;
export function priorityCharacter(member: MemberData, tracks: ReadonlyMap<number, Track>): PriorityCharacter;
```

- [ ] **Step 1: Confirm the guard is green**

Run: `npx vitest run src/server/views/views.test.ts` → PASS.

- [ ] **Step 2: Create `src/server/views/member.ts`**

```ts
import type { Db } from '@/core/db/client';
import type { CharacterRow } from '@/core/db/queries/characters';
import type { SnapshotItemInput } from '@/core/db/queries/snapshots';
import type { CrestCost } from '@/core/gear/crests';
import { evaluateGear, type GearRow } from '@/core/gear/evaluate';
import { choosePriorityList, type PriorityListType } from '@/core/priority/list';
import type { Credit, PriorityCharacter } from '@/core/priority/rank';
import { decodeTrack } from '@/core/raidbots/tracks';
import type { BisResult } from '@/core/sync/reference-sync';
import type { BisRow, ListType, SlotType, Track } from '@/core/types';
import { itemView } from './item-view';
import { loadGear, summarize, upgradeFor, type GearContext } from './summarize';
import type { CharacterSummary, GearRowView, PriorityCreditView, VaultChoiceView } from './types';

export interface MemberContext {
  db: Db;
  tracks: ReadonlyMap<number, Track>;
  /** BiS lists for a spec; the group page shares one lookup per spec across members. */
  bisFor: (specSlug: string) => Promise<BisResult>;
}

export interface MemberData {
  character: CharacterRow;
  summary: CharacterSummary;
  gear: GearContext;
  bis: BisResult;
  choice: { listType: PriorityListType; fellBack: boolean };
  /** Rows for the priority list in `choice`. */
  priorityRows: GearRow[];
  evaluate: (list: ListType) => GearRow[];
  vaultItems: SnapshotItemInput[];
}

/** One character's gear, BiS lists and priority rows: what the character page and the group page both start from. */
export async function loadMember(ctx: MemberContext, character: CharacterRow, classIcons: ReadonlyMap<string, string | null> = new Map()): Promise<MemberData> {
  const gear = await loadGear(ctx.db, character.id);
  const summary = summarize(character, gear.current, classIcons);
  const bis = await ctx.bisFor(summary.specSlug);
  const evaluate = (list: ListType) => evaluateGear({ equipped: gear.equipped, bisRows: bis.lists?.[list] ?? [], tracks: ctx.tracks, bagItemIds: gear.bagItemIds });
  const choice = choosePriorityList(bis.lists, character.priorityList);
  return {
    character, summary, gear, bis, choice, evaluate,
    priorityRows: evaluate(choice.listType),
    vaultItems: gear.simc?.items.filter((i) => i.location === 'vault') ?? [],
  };
}

export function rowView(r: GearRow, icons: ReadonlyMap<number, string | null>, costs: ReadonlyMap<number, CrestCost>, balances: ReadonlyMap<number, number>): GearRowView {
  return {
    slotLabel: r.row.slotLabel,
    slot: r.slot,
    state: r.state,
    equipped: r.equipped && itemView(r.equipped, icons, r.track),
    bis: r.row.kind === 'item'
      ? {
          kind: 'item' as const,
          ...itemView({ itemId: r.row.itemId, name: r.row.name, itemLevel: null, quality: 'EPIC', bonusIds: r.row.bonusIds }, icons, null),
          isTier: r.row.isTier,
          isCatalyst: r.row.isCatalyst,
          source: r.row.source,
        }
      : { kind: 'any' as const, minItemLevel: r.row.minItemLevel, source: r.row.source },
    upgrade: upgradeFor(r, costs, balances),
  };
}

/** Vault choices, each flagged when it would fill a row of `listRows`. */
export function vaultChoicesFor(items: SnapshotItemInput[], listRows: BisRow[], icons: ReadonlyMap<number, string | null>, tracks: ReadonlyMap<number, Track>): VaultChoiceView[] {
  const isBis = (item: SnapshotItemInput) => listRows.some((r) => r.kind === 'any'
    ? r.slots.includes(item.slot as SlotType) && (item.itemLevel ?? 0) >= r.minItemLevel
    : r.itemId === item.itemId || (r.isTier && item.isTier && r.slots.includes(item.slot as SlotType)));
  return items.map((item) => ({ ...itemView(item, icons, decodeTrack(item.bonusIds, tracks)), isBis: isBis(item) }));
}

export function creditView(cr: Credit, icons: ReadonlyMap<number, string | null>): PriorityCreditView {
  return cr.kind === 'item'
    ? { kind: 'item', slotLabel: cr.slotLabel, weight: cr.weight,
        item: itemView({ itemId: cr.itemId, name: cr.name, itemLevel: null, quality: 'EPIC', bonusIds: cr.bonusIds }, icons, null) }
    : cr;
}

export const priorityCharacter = (m: MemberData, tracks: ReadonlyMap<number, Track>): PriorityCharacter => ({
  id: m.character.id, name: m.character.name, className: m.character.className, rows: m.priorityRows, equipped: m.gear.equipped, tracks,
});
```

- [ ] **Step 3: Rewrite `getCharacterPage` on top of it**

Replace the body of `src/server/views/character-page.ts` with this (imports trimmed to what it uses):

```ts
import { getCharacter } from '@/core/db/queries/characters';
import { crestCostsByGroup } from '@/core/gear/crests';
import type { GearRow } from '@/core/gear/evaluate';
import { rankDungeons } from '@/core/priority/rank';
import { ensureBisLists, ensureClassIcons, ensureItemIcons, ensureTracks } from '@/core/sync/reference-sync';
import { readSeason } from '@/core/sync/season-sync';
import { LIST_TYPES, type ListType } from '@/core/types';
import type { Services } from '../services';
import type { CharacterPageView } from './types';
import { crestView } from './summarize';
import { creditView, loadMember, priorityCharacter, rowView, vaultChoicesFor } from './member';

const bisCount = (rows: GearRow[]) => rows.filter((r) => r.matched).length;

export async function getCharacterPage(services: Services, id: number, listType?: ListType): Promise<CharacterPageView | null> {
  const { db, blizzard, bisSource, fetchRaidbots, now } = services;
  const character = await getCharacter(db, id);
  if (!character) return null;
  const time = now();
  const list = listType ?? character.priorityList;
  const fallbackSpec = character.specOverride || character.specName;

  const specsPromise = blizzard.getClasses(character.region)
    .then((classes) => classes.find((cls) => cls.name === character.className)?.specs ?? [fallbackSpec])
    .catch(() => [fallbackSpec]);
  // Database work runs in sequence: an in-memory libsql database can't serve a read while a write transaction is open.
  const { tracks, error: tracksError } = await ensureTracks({ db, fetchRaidbots, now: time });
  const member = await loadMember({ db, tracks, bisFor: (slug) => ensureBisLists({ db, source: bisSource, now: time }, slug) }, character);
  const { summary, gear, bis, choice } = member;
  const specs = await specsPromise;
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, character.region);
  const costs = crestCostsByGroup(tracks.values());

  const gearRows = list === choice.listType ? member.priorityRows : member.evaluate(list);
  const season = await readSeason(db, time);
  const ranks = rankDungeons([priorityCharacter(member, tracks)], season.dungeons);
  const creditItemIds = ranks.flatMap((d) => d.characters.flatMap((c) => c.credits.flatMap((cr) => (cr.kind === 'item' ? [cr.itemId] : []))));

  const iconIds = [...gear.equipped.map((g) => g.itemId), ...gearRows.flatMap((r) => (r.row.kind === 'item' ? [r.row.itemId] : [])), ...member.vaultItems.map((i) => i.itemId), ...creditItemIds];
  const icons = await ensureItemIcons({ db, blizzard, now: time }, character.region, iconIds);

  const rows = gearRows.map((r) => rowView(r, icons, costs, gear.balances));
  const counts = Object.fromEntries(LIST_TYPES.map((l) => {
    const evaluated = l === list ? gearRows : member.evaluate(l);
    return [l, { bis: bisCount(evaluated), total: evaluated.length }];
  })) as Record<ListType, { bis: number; total: number }>;

  return {
    ...summary,
    classIconUrl: classIcons.get(character.className) ?? null,
    listType: list,
    rows,
    vault: rows.filter((r) => r.state === 'belowMyth'),
    vaultChoices: vaultChoicesFor(member.vaultItems, bis.lists?.[list] ?? [], icons, tracks),
    vaultChoicesAt: gear.simc?.createdAt ?? null,
    crests: crestView(gear, costs),
    counts,
    bisFetchedAt: bis.fetchedAt,
    bisError: bis.error,
    tracksError,
    specs,
    priority: {
      listType: choice.listType,
      fellBack: choice.fellBack,
      season: season.status,
      needsSync: season.needsSync,
      approximate: tracksError !== null,
      dungeons: ranks.filter((d) => d.score > 0).map((d) => ({
        challengeModeId: d.challengeModeId,
        name: d.name,
        score: d.score,
        split: d.split,
        credits: d.characters.flatMap((c) => c.credits).map((cr) => creditView(cr, icons)),
      })),
      nothingFrom: ranks.filter((d) => d.score === 0).map((d) => d.name),
    },
  };
}
```

- [ ] **Step 4: Run the guard and the gate**

Run: `npx vitest run src/server/views/views.test.ts` → PASS, unchanged. Then `npm run typecheck && npm run lint && npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/server/views/member.ts src/server/views/character-page.ts
git commit -m "chore: move per-character loading out of the character page view" -m "The group page loads the same things for each of its members: gear,
BiS lists, priority rows, row views and vault choices. Moving them into
member.ts lets both loaders share them instead of copying them. The
character page's output doesn't change."
```

---

### Task 6: Grid alignment and member states

**Files:**
- Create: `src/server/views/group-grid.ts`
- Test: `src/server/views/group-grid.test.ts`
- Modify: `src/server/views/types.ts` (add group types)

**Interfaces:**
- Consumes: `GearRowView`, `CharacterSummary`, `CrestView`, `VaultChoiceView`, `PriorityCreditView` from `./types`.
- Produces, in `src/server/views/types.ts`:

```ts
export type GroupMemberState = 'untracked' | 'notFound' | 'syncing' | 'noGear' | 'ready';
export interface GroupMemberView {
  /** The formatted member key, as in the URL. */
  key: string;
  /** The character's name, or the key's folded name when it isn't tracked here. */
  name: string;
  realmSlug: string;
  character: CharacterSummary | null;
  state: GroupMemberState;
  syncError: string | null;
  bisError: string | null;
  /** Ready but without rows: no BiS list to compare against. */
  hasRows: boolean;
  listType: 'mythicPlus' | 'overall';
  fellBack: boolean;
  crests: CrestView | null;
}
export interface GroupGridRow { slot: SlotType; label: string; cells: (GearRowView | null)[] }
export interface GroupMemberCreditsView { key: string; name: string; className: string; avatarUrl: string | null; classIconUrl: string | null; credits: PriorityCreditView[] }
export interface GroupDungeonView { challengeModeId: number; name: string; score: number; split: boolean; members: GroupMemberCreditsView[] }
export interface GroupPriorityView {
  season: 'loading' | 'failed' | 'ready' | 'stale';
  approximate: boolean;
  covered: string[];
  excluded: { name: string; reason: string }[];
  fellBack: string[];
  /** Null when no member is eligible: the ranking is unavailable, which is not the same as nothing needed. */
  ranking: { dungeons: GroupDungeonView[]; nothingFrom: string[] } | null;
}
export interface GroupVaultView { key: string; name: string; pastedAt: number | null; choices: VaultChoiceView[] }
export interface GroupPageView {
  region: Region | null;
  keys: string[];
  members: GroupMemberView[];
  grid: GroupGridRow[];
  tracksKnown: boolean;
  priority: GroupPriorityView;
  needsSeasonSync: boolean;
  vault: GroupVaultView[];
  dropped: { name: string; region: Region }[];
  available: { key: string; label: string }[];
  tracked: { region: Region; realmId: number; name: string }[];
  staleIds: number[];
}
```

- Produces, in `src/server/views/group-grid.ts`:

```ts
export const SLOT_LABELS: Record<SlotType, string>;
export function alignGrid(columns: (GearRowView[] | null)[]): GroupGridRow[];
export function memberState(character: { status: 'ok' | 'notFound'; lastSyncedAt: number | null } | null, hasGear: boolean): GroupMemberState;
export const EXCLUSION_REASONS: Record<Exclude<GroupMemberState, 'ready'> | 'noList', string>;
export function exclusionReason(state: GroupMemberState, hasRows: boolean): string | null;  // null = eligible
```

- [ ] **Step 1: Add the types**

Append the group types above to `src/server/views/types.ts` exactly as listed. They have no behavior, so no test of their own.

- [ ] **Step 2: Write the failing tests**

`src/server/views/group-grid.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GearRowView } from './types';
import { alignGrid, exclusionReason, memberState } from './group-grid';

const cell = (slot: GearRowView['slot'], slotLabel: string, itemId: number): GearRowView => ({
  slotLabel, slot, state: 'missing', equipped: null, upgrade: null,
  bis: { kind: 'item', itemId, name: `Item ${itemId}`, itemLevel: null, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null, isTier: false, isCatalyst: false, source: '' },
});

describe('alignGrid', () => {
  it('puts differently named slots in one row, in slot order, with fixed labels', () => {
    const grid = alignGrid([
      [cell('MAIN_HAND', 'Weapon', 1), cell('HANDS', 'Gloves', 2)],
      [cell('HANDS', 'Hands', 3), cell('MAIN_HAND', 'Main Hand', 4)],
    ]);
    expect(grid.map((r) => r.label)).toEqual(['Gloves', 'Main Hand']);
    expect(grid[1]!.cells.map((c) => c?.bis.kind === 'item' && c.bis.itemId)).toEqual([1, 4]);
  });

  it('places rings and trinkets by the slot they evaluated to, not by list order', () => {
    // The first-listed ring matched in FINGER_2; the second fell back to FINGER_1.
    const grid = alignGrid([[cell('FINGER_2', 'Ring', 40), cell('FINGER_1', 'Ring', 41), cell('TRINKET_2', 'Trinket', 50), cell('TRINKET_1', 'Trinket', 51)]]);
    expect(grid.map((r) => [r.label, r.cells[0]?.bis.kind === 'item' && r.cells[0].bis.itemId]))
      .toEqual([['Ring 1', 41], ['Ring 2', 40], ['Trinket 1', 51], ['Trinket 2', 50]]);
  });

  it('leaves an empty cell for a missing off hand without moving other rows, and a null column empty', () => {
    const grid = alignGrid([
      [cell('MAIN_HAND', 'Weapon', 1), cell('OFF_HAND', 'Off Hand', 2)],
      [cell('MAIN_HAND', 'Weapon', 3)],
      null,
    ]);
    expect(grid.map((r) => r.label)).toEqual(['Main Hand', 'Off Hand']);
    expect(grid[1]!.cells.map((c) => c?.slot ?? null)).toEqual(['OFF_HAND', null, null]);
    expect(grid[0]!.cells[2]).toBeNull();
  });
});

describe('memberState', () => {
  it('tells untracked, not found, syncing, no gear and ready apart', () => {
    expect(memberState(null, false)).toBe('untracked');
    expect(memberState({ status: 'notFound', lastSyncedAt: 5 }, true)).toBe('notFound');
    expect(memberState({ status: 'ok', lastSyncedAt: null }, false)).toBe('syncing');
    expect(memberState({ status: 'ok', lastSyncedAt: 5 }, false)).toBe('noGear');
    expect(memberState({ status: 'ok', lastSyncedAt: 5 }, true)).toBe('ready');
  });
});

describe('exclusionReason', () => {
  it('gives a reason for every member the ranking leaves out, and none for an eligible one', () => {
    expect(exclusionReason('ready', true)).toBeNull();
    expect(exclusionReason('ready', false)).toBe('no BiS list');
    expect(exclusionReason('untracked', false)).toBe('not tracked');
    expect(exclusionReason('notFound', false)).toBe('not found by Blizzard');
    expect(exclusionReason('syncing', false)).toBe('syncing');
    expect(exclusionReason('noGear', false)).toBe('no gear yet');
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run src/server/views/group-grid.test.ts`
Expected: FAIL, "Failed to resolve import ./group-grid".

- [ ] **Step 4: Implement**

`src/server/views/group-grid.ts`:

```ts
import { SLOT_TYPES, type SlotType } from '@/core/types';
import type { GearRowView, GroupGridRow, GroupMemberState } from './types';

/** Method names one slot several ways ("Weapon", "Main Hand"), so the grid labels slots itself. */
export const SLOT_LABELS: Record<SlotType, string> = {
  HEAD: 'Head', NECK: 'Neck', SHOULDER: 'Shoulders', BACK: 'Cloak', CHEST: 'Chest', WRIST: 'Wrist', HANDS: 'Gloves',
  WAIST: 'Belt', LEGS: 'Legs', FEET: 'Boots', FINGER_1: 'Ring 1', FINGER_2: 'Ring 2', TRINKET_1: 'Trinket 1',
  TRINKET_2: 'Trinket 2', MAIN_HAND: 'Main Hand', OFF_HAND: 'Off Hand',
};

/**
 * One row per slot, keyed by the slot each row evaluated to. Rings and trinkets land where the
 * equipped item actually is, since evaluateGear lets an exact match claim either slot. A `null`
 * column is a member without rows; a slot no member has is left out.
 */
export function alignGrid(columns: (GearRowView[] | null)[]): GroupGridRow[] {
  return SLOT_TYPES
    .map((slot) => ({ slot, label: SLOT_LABELS[slot], cells: columns.map((rows) => rows?.find((r) => r.slot === slot) ?? null) }))
    .filter((row) => row.cells.some((c) => c !== null));
}

export function memberState(character: { status: 'ok' | 'notFound'; lastSyncedAt: number | null } | null, hasGear: boolean): GroupMemberState {
  if (!character) return 'untracked';
  if (character.status === 'notFound') return 'notFound';
  if (hasGear) return 'ready';
  return character.lastSyncedAt === null ? 'syncing' : 'noGear';
}

export const EXCLUSION_REASONS = {
  untracked: 'not tracked',
  notFound: 'not found by Blizzard',
  syncing: 'syncing',
  noGear: 'no gear yet',
  noList: 'no BiS list',
} as const;

/** Why the ranking leaves a member out, or null when the member counts. */
export function exclusionReason(state: GroupMemberState, hasRows: boolean): string | null {
  if (state === 'ready') return hasRows ? null : EXCLUSION_REASONS.noList;
  return EXCLUSION_REASONS[state];
}
```

- [ ] **Step 5: Run the tests and the gate, then commit**

Run: `npx vitest run src/server/views/group-grid.test.ts` → PASS. Then `npm run typecheck && npm run lint && npm test`.

```bash
git add src/server/views/types.ts src/server/views/group-grid.ts src/server/views/group-grid.test.ts
git commit -m "feat: align group gear by evaluated slot" -m "Method names the same slot differently across specs, and the first ring
row can evaluate to the second ring slot. Keying rows by the slot each
row evaluated to keeps every member's equipped item and target in the
row where the item really sits."
```

---

### Task 7: The group page loader

**Files:**
- Create: `src/server/views/group-page.ts`
- Test: `src/server/views/group-page.test.ts`

**Interfaces:**
- Consumes: `selectGroup`, `findByMemberKey`, `formatMemberKey`, `memberKeyOf`, `MemberKey` (Task 2); `loadMember`, `rowView`, `vaultChoicesFor`, `creditView`, `priorityCharacter`, `MemberData` (Task 5); `alignGrid`, `memberState`, `exclusionReason` (Task 6); `rankDungeons` (`@/core/priority/rank`); `readSeason` (`@/core/sync/season-sync`); `isStale` (`@/core/sync/character-sync`).
- Produces: `export async function getGroupPage(services: Services, keys: MemberKey[]): Promise<GroupPageView>`.

- [ ] **Step 1: Write the failing tests**

`src/server/views/group-page.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { openTestDb } from '@/test/db';
import type { Services } from '../services';
import type { BlizzardClient } from '@/core/blizzard/client';
import { insertCharacter, updateCharacter } from '@/core/db/queries/characters';
import { gearToSnapshotItems, saveSnapshotIfChanged } from '@/core/db/queries/snapshots';
import { replaceSeason } from '@/core/db/queries/season';
import { setMeta } from '@/core/db/queries/meta';
import { SEASON_META_KEY } from '@/core/sync/season-sync';
import { parseMemberKeys } from '@/core/characters/member-key';
import type { BisLists, BisRow, GearItem } from '@/core/types';
import { getGroupPage } from './group-page';

const item = (slotLabel: string, slots: BisRow['slots'], itemId: number, source = 'Alpha Hollow'): BisRow =>
  ({ kind: 'item', slotLabel, slots, itemId, name: `Item ${itemId}`, bonusIds: [], isTier: false, isCatalyst: false, source });
const worn = (slot: GearItem['slot'], itemId: number): GearItem =>
  ({ slot, itemId, name: `Worn ${itemId}`, itemLevel: 300, quality: 'EPIC', bonusIds: [], isTier: false });

// Guardian lists a "Weapon" and an off hand; Protection lists a "Main Hand" two-hander and no off hand.
const LISTS: Record<string, BisLists> = {
  'guardian-druid': { overall: [], raid: [], mythicPlus: [
    item('Ring', ['FINGER_1', 'FINGER_2'], 40), item('Ring', ['FINGER_1', 'FINGER_2'], 41),
    item('Weapon', ['MAIN_HAND'], 60), item('Off Hand', ['OFF_HAND'], 61),
  ] },
  'protection-warrior': { overall: [item('Main Hand', ['MAIN_HAND'], 70)], raid: [], mythicPlus: [] },
};

async function services() {
  const db = await openTestDb();
  const fetched: string[] = [];
  const blizzard = {
    getItemIconUrl: async (_r: string, id: number) => `https://i/${id}.jpg`,
    getClassIconUrl: async () => null,
    getClasses: async () => [],
  } as unknown as BlizzardClient;
  const s: Services = {
    db, blizzard,
    bisSource: { name: 'Fake', fetchLists: async (slug) => { fetched.push(slug); if (!LISTS[slug]) throw new Error('down'); return LISTS[slug]!; } },
    fetchRaidbots: async () => ({ tracks: [], qualities: [] }),
    syncer: { sync: async () => 'skipped' },
    now: () => 10_000_000,
    fetchFn: fetch,
  };
  return { s, fetched };
}

async function track(s: Services, name: string, className: string, specName: string, gear: GearItem[] | null, region: 'eu' | 'us' = 'eu') {
  const { id } = await insertCharacter(s.db, { region, realmId: 1, realmSlug: 'argent-dawn', realmName: 'Argent Dawn', name, className, specName }, 1);
  if (gear) {
    await saveSnapshotIfChanged(s.db, id, 'blizzard', gearToSnapshotItems(gear), 500);
    await updateCharacter(s.db, id, { lastSyncedAt: s.now() });
  }
  return id;
}

async function season(s: Services) {
  await replaceSeason(s.db, {
    slug: 'season-test',
    dungeons: [
      { challengeModeId: 501, name: 'Alpha Hollow', shortName: 'AH', journalInstanceId: 901, mapId: 11 },
      { challengeModeId: 502, name: 'Streets of Beta', shortName: 'SB', journalInstanceId: 902, mapId: 22 },
      { challengeModeId: 503, name: 'Gambit of Beta', shortName: 'GB', journalInstanceId: 902, mapId: 23 },
      { challengeModeId: 504, name: 'Delta Deep', shortName: 'DD', journalInstanceId: 904, mapId: 44 },
    ],
    loot: [
      { challengeModeId: 501, encounterId: 1, encounterName: 'Boss', itemId: 41, itemName: 'Item 41', inventoryType: 'FINGER', armorType: null },
      { challengeModeId: 501, encounterId: 1, encounterName: 'Boss', itemId: 70, itemName: 'Item 70', inventoryType: 'TWOHWEAPON', armorType: null },
      { challengeModeId: 502, encounterId: 2, encounterName: 'Boss', itemId: 61, itemName: 'Item 61', inventoryType: 'HOLDABLE', armorType: null },
      { challengeModeId: 503, encounterId: 2, encounterName: 'Boss', itemId: 61, itemName: 'Item 61', inventoryType: 'HOLDABLE', armorType: null },
    ],
  });
  await setMeta(s.db, SEASON_META_KEY, 'season-test', 10_000_000);
}

const keys = (...names: string[]) => parseMemberKeys(names.map((n) => `eu.argent-dawn.${n}`).join(','));

describe('getGroupPage', () => {
  it('aligns members by evaluated slot, with rings where they sit and an empty off hand', async () => {
    const { s } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('FINGER_1', 42), worn('FINGER_2', 40), worn('MAIN_HAND', 60)]);
    await track(s, 'Hrafnhildur', 'Warrior', 'Protection', [worn('MAIN_HAND', 71)]);
    const page = await getGroupPage(s, keys('birkibjörn', 'hrafnhildur'));
    const row = (label: string) => page.grid.find((r) => r.label === label)!;
    expect(page.grid.map((r) => r.label)).toEqual(['Ring 1', 'Ring 2', 'Main Hand', 'Off Hand']);
    expect(row('Ring 2').cells[0]).toMatchObject({ state: 'done', equipped: { itemId: 40 }, bis: { itemId: 40 } });
    expect(row('Ring 1').cells[0]).toMatchObject({ state: 'missing', equipped: { itemId: 42 }, bis: { itemId: 41 } });
    expect(row('Main Hand').cells.map((c) => c?.bis.kind === 'item' && c.bis.itemId)).toEqual([60, 70]);
    expect(row('Off Hand').cells[1]).toBeNull();
    expect(page.members.map((m) => [m.name, m.state, m.listType, m.fellBack])).toEqual([
      ['Birkibjörn', 'ready', 'mythicPlus', false],
      ['Hrafnhildur', 'ready', 'overall', true],
    ]);
  });

  it('ranks for the group with credits per member and keeps split dungeons marked', async () => {
    const { s } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('FINGER_1', 42), worn('FINGER_2', 40), worn('MAIN_HAND', 60)]);
    await track(s, 'Hrafnhildur', 'Warrior', 'Protection', [worn('MAIN_HAND', 71)]);
    await season(s);
    const { priority } = await getGroupPage(s, keys('birkibjörn', 'hrafnhildur'));
    expect(priority).toMatchObject({ season: 'ready', covered: ['Birkibjörn', 'Hrafnhildur'], excluded: [], fellBack: ['Hrafnhildur'] });
    const [first, ...rest] = priority.ranking!.dungeons;
    expect(first).toMatchObject({ name: 'Alpha Hollow', split: false });
    expect(first!.members.map((m) => [m.name, m.credits.map((c) => c.kind === 'item' && c.item.itemId)])).toEqual([
      ['Birkibjörn', [41]],
      ['Hrafnhildur', [70]],
    ]);
    expect(rest.map((d) => [d.name, d.split])).toEqual([['Gambit of Beta', true], ['Streets of Beta', true]]);
    expect(priority.ranking!.nothingFrom).toEqual(['Delta Deep']);
  });

  it('says the ranking is unavailable when no member is eligible, and names why', async () => {
    const { s } = await services();
    const id = await track(s, 'Sólrún', 'Druid', 'Guardian', null);
    await updateCharacter(s.db, id, { lastSyncedAt: 5, lastSyncError: 'Blizzard returned 503' });
    await season(s);
    const page = await getGroupPage(s, keys('sólrún', 'gnúpur'));
    expect(page.members.map((m) => [m.name, m.state, m.syncError])).toEqual([['Sólrún', 'noGear', 'Blizzard returned 503'], ['gnúpur', 'untracked', null]]);
    expect(page.priority.ranking).toBeNull();
    expect(page.priority.excluded).toEqual([{ name: 'Sólrún', reason: 'no gear yet' }, { name: 'gnúpur', reason: 'not tracked' }]);
  });

  it('ranks a partly eligible group and leaves out a member without a BiS list', async () => {
    const { s } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    await track(s, 'Hrafnhildur', 'Mage', 'Frost', [worn('MAIN_HAND', 80)]);
    await season(s);
    const page = await getGroupPage(s, keys('birkibjörn', 'hrafnhildur'));
    expect(page.members[1]).toMatchObject({ state: 'ready', hasRows: false, bisError: 'BiS list couldn’t be updated' });
    expect(page.priority.covered).toEqual(['Birkibjörn']);
    expect(page.priority.excluded).toEqual([{ name: 'Hrafnhildur', reason: 'no BiS list' }]);
    expect(page.priority.ranking).not.toBeNull();
  });

  it('gives an empty ranking, not a null one, when eligible members need nothing', async () => {
    const { s } = await services();
    await track(s, 'Hrafnhildur', 'Warrior', 'Protection', [worn('MAIN_HAND', 70)]);
    await season(s);
    const { priority } = await getGroupPage(s, keys('hrafnhildur'));
    expect(priority.ranking).toEqual({ dungeons: [], nothingFrom: ['Alpha Hollow', 'Delta Deep', 'Gambit of Beta', 'Streets of Beta'] });
  });

  it('drops other regions, lists available characters, and skips not-found members when syncing', async () => {
    const { s } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    const lost = await track(s, 'Sólrún', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    await updateCharacter(s.db, lost, { status: 'notFound', lastSyncedAt: 1 });
    const stale = await track(s, 'Hrafnhildur', 'Warrior', 'Protection', [worn('MAIN_HAND', 71)]);
    await updateCharacter(s.db, stale, { lastSyncedAt: 1 });
    await track(s, 'Gnúpur', 'Warrior', 'Protection', null);
    await track(s, 'Ylfa', 'Warrior', 'Protection', null, 'us');
    const page = await getGroupPage(s, parseMemberKeys('eu.argent-dawn.birkibjörn,us.argent-dawn.ylfa,eu.argent-dawn.sólrún,eu.argent-dawn.hrafnhildur'));
    expect(page.region).toBe('eu');
    expect(page.dropped).toEqual([{ name: 'Ylfa', region: 'us' }]);
    expect(page.keys).toEqual(['eu.argent-dawn.birkibjörn', 'eu.argent-dawn.sólrún', 'eu.argent-dawn.hrafnhildur']);
    expect(page.members[1]!.state).toBe('notFound');
    expect(page.staleIds).toEqual([stale]);
    expect(page.available).toEqual([{ key: 'eu.argent-dawn.gnúpur', label: 'Gnúpur – Argent Dawn (Protection)' }]);
  });

  it('asks Method once for two members of the same spec', async () => {
    const { s, fetched } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    await track(s, 'Sólrún', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    await getGroupPage(s, keys('birkibjörn', 'sólrún'));
    expect(fetched).toEqual(['guardian-druid']);
  });

  it('keeps the three vault states apart', async () => {
    const { s } = await services();
    await track(s, 'Birkibjörn', 'Druid', 'Guardian', [worn('MAIN_HAND', 60)]);
    const pasted = await track(s, 'Sólrún', 'Druid', 'Guardian', null);
    await saveSnapshotIfChanged(s.db, pasted, 'simc', [{ location: 'equipped', slot: 'MAIN_HAND', itemId: 60, name: 'Worn 60', itemLevel: 300, quality: 'EPIC', bonusIds: [], isTier: false }], 700);
    const chooser = await track(s, 'Gnúpur', 'Druid', 'Guardian', null);
    await saveSnapshotIfChanged(s.db, chooser, 'simc', [
      { location: 'equipped', slot: 'MAIN_HAND', itemId: 60, name: 'Worn 60', itemLevel: 300, quality: 'EPIC', bonusIds: [], isTier: false },
      { location: 'vault', slot: 'OFF_HAND', itemId: 61, name: 'Item 61', itemLevel: 330, quality: 'EPIC', bonusIds: [], isTier: false },
    ], 800);
    const { vault } = await getGroupPage(s, keys('birkibjörn', 'sólrún', 'gnúpur'));
    expect(vault.map((v) => [v.name, v.pastedAt, v.choices.map((c) => [c.itemId, c.isBis])])).toEqual([
      ['Birkibjörn', null, []],
      ['Sólrún', 700, []],
      ['Gnúpur', 800, [[61, true]]],
    ]);
  });

  it('is empty without keys', async () => {
    const { s } = await services();
    const page = await getGroupPage(s, []);
    expect(page).toMatchObject({ region: null, keys: [], members: [], grid: [], needsSeasonSync: false });
  });
});
```

Notes on the fixtures: a snapshot makes a member `ready`, whether it came from Blizzard or a SimC paste. Every BiS row here is a named item, and `rankDungeons` credits named items by item ID alone, so the loot's inventory types don't affect these tests.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/server/views/group-page.test.ts`
Expected: FAIL, "Failed to resolve import ./group-page".

- [ ] **Step 3: Implement the loader**

`src/server/views/group-page.ts`:

```ts
import { findByMemberKey, formatMemberKey, memberKeyOf, selectGroup, type MemberKey } from '@/core/characters/member-key';
import { listCharacters, type CharacterRow } from '@/core/db/queries/characters';
import { crestCostsByGroup } from '@/core/gear/crests';
import { rankDungeons } from '@/core/priority/rank';
import { isStale } from '@/core/sync/character-sync';
import { ensureBisLists, ensureClassIcons, ensureItemIcons, ensureTracks, type BisResult } from '@/core/sync/reference-sync';
import { readSeason } from '@/core/sync/season-sync';
import type { Services } from '../services';
import { alignGrid, exclusionReason, memberState } from './group-grid';
import { creditView, loadMember, priorityCharacter, rowView, vaultChoicesFor, type MemberData } from './member';
import { crestView } from './summarize';
import type { GroupMemberView, GroupPageView } from './types';

interface Loaded { key: MemberKey; character: CharacterRow | null; data: MemberData | null; view: GroupMemberView; reason: string | null }

export async function getGroupPage(services: Services, keys: MemberKey[]): Promise<GroupPageView> {
  const { db, blizzard, bisSource, fetchRaidbots, now } = services;
  const time = now();
  const { members: selected, dropped } = selectGroup(keys);
  const region = selected[0]?.region ?? null;

  // Database work runs in sequence: an in-memory libsql database can't serve a read while a write transaction is open.
  const { tracks, error: tracksError } = await ensureTracks({ db, fetchRaidbots, now: time });
  const costs = crestCostsByGroup(tracks.values());
  const all = await listCharacters(db);
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, region ?? 'eu');
  const bisBySlug = new Map<string, BisResult>();
  // ponytail: one Method request per distinct spec, in sequence; parallel needs reads kept apart from the cache writes.
  const bisFor = async (slug: string) => {
    if (!bisBySlug.has(slug)) bisBySlug.set(slug, await ensureBisLists({ db, source: bisSource, now: time }, slug));
    return bisBySlug.get(slug)!;
  };

  const loaded: Loaded[] = [];
  for (const key of selected) {
    const character = findByMemberKey(all, key) ?? null;
    const data = character ? await loadMember({ db, tracks, bisFor }, character, classIcons) : null;
    const state = memberState(character, data?.gear.current != null);
    const hasRows = (data?.priorityRows.length ?? 0) > 0;
    loaded.push({
      key, character, data,
      reason: exclusionReason(state, hasRows),
      view: {
        key: formatMemberKey(key),
        name: character?.name ?? key.nameKey,
        realmSlug: key.realmSlug,
        character: data?.summary ?? null,
        state,
        syncError: character?.lastSyncError ?? null,
        bisError: data?.bis.error ?? null,
        hasRows,
        listType: data?.choice.listType ?? 'mythicPlus',
        fellBack: data?.choice.fellBack ?? false,
        crests: data ? crestView(data.gear, costs) : null,
      },
    });
  }

  const eligible = loaded.filter((l) => l.reason === null && l.data);
  const season = await readSeason(db, time);
  const ranks = eligible.length > 0 ? rankDungeons(eligible.map((l) => priorityCharacter(l.data!, tracks)), season.dungeons) : null;

  const iconIds = loaded.flatMap(({ data }) => (data ? [
    ...data.gear.equipped.map((g) => g.itemId),
    ...data.priorityRows.flatMap((r) => (r.row.kind === 'item' ? [r.row.itemId] : [])),
    ...data.vaultItems.map((i) => i.itemId),
  ] : []));
  const creditIds = (ranks ?? []).flatMap((d) => d.characters.flatMap((c) => c.credits.flatMap((cr) => (cr.kind === 'item' ? [cr.itemId] : []))));
  const icons = await ensureItemIcons({ db, blizzard, now: time }, region ?? 'eu', [...iconIds, ...creditIds]);

  const byId = new Map(eligible.map((l) => [l.character!.id, l]));
  const selectedKeys = new Set(selected.map(formatMemberKey));

  return {
    region,
    keys: loaded.map((l) => l.view.key),
    members: loaded.map((l) => l.view),
    grid: alignGrid(loaded.map(({ data, view }) => (data && view.state === 'ready' && view.hasRows
      ? data.priorityRows.map((r) => rowView(r, icons, costs, data.gear.balances))
      : null))),
    tracksKnown: tracksError === null,
    priority: {
      season: season.status,
      approximate: tracksError !== null,
      covered: eligible.map((l) => l.view.name),
      excluded: loaded.filter((l) => l.reason !== null).map((l) => ({ name: l.view.name, reason: l.reason! })),
      fellBack: eligible.filter((l) => l.view.fellBack).map((l) => l.view.name),
      ranking: ranks && {
        dungeons: ranks.filter((d) => d.score > 0).map((d) => ({
          challengeModeId: d.challengeModeId,
          name: d.name,
          score: d.score,
          split: d.split,
          members: d.characters.map((c) => {
            const { view } = byId.get(c.characterId)!;
            return {
              key: view.key, name: view.name, className: view.character!.className,
              avatarUrl: view.character!.avatarUrl, classIconUrl: view.character!.classIconUrl,
              credits: c.credits.map((cr) => creditView(cr, icons)),
            };
          }),
        })),
        nothingFrom: ranks.filter((d) => d.score === 0).map((d) => d.name),
      },
    },
    needsSeasonSync: region !== null && season.needsSync,
    vault: loaded.flatMap(({ data, view }) => (data ? [{
      key: view.key,
      name: view.name,
      pastedAt: data.gear.simc?.createdAt ?? null,
      choices: vaultChoicesFor(data.vaultItems, data.bis.lists?.[data.choice.listType] ?? [], icons, tracks),
    }] : [])),
    dropped: dropped.map((k) => ({ name: findByMemberKey(all, k)?.name ?? k.nameKey, region: k.region })),
    available: all
      .filter((c) => (region === null || c.region === region) && !selectedKeys.has(formatMemberKey(memberKeyOf(c))))
      .map((c) => ({ key: formatMemberKey(memberKeyOf(c)), label: `${c.name} – ${c.realmName} (${c.specOverride || c.specName})` })),
    tracked: all.map((c) => ({ region: c.region, realmId: c.realmId, name: c.name })),
    staleIds: loaded.flatMap(({ character }) => (character && character.status === 'ok' && isStale(character.lastSyncedAt, time) ? [character.id] : [])),
  };
}
```

`rankDungeons` sorts zero-score dungeons by name after the scored ones, so `nothingFrom` comes out in name order.

- [ ] **Step 4: Run the tests and the gate**

Run: `npx vitest run src/server/views/group-page.test.ts` → PASS. Fix fixtures, not assertions, if a fixture detail (inventory type names, Overall fallback) differs from the core modules. Then `npm run typecheck && npm run lint && npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/server/views/group-page.ts src/server/views/group-page.test.ts
git commit -m "feat: load the group page view" -m "One loader resolves member keys to tracked characters, applies the
region rule and cap, aligns gear by slot, and ranks dungeons over the
members that have gear and a BiS list. Members it leaves out are named
with a reason, so an unavailable ranking never reads as nothing needed."
```

---

### Task 8: Shared priority copy, legend and nav

**Files:**
- Create: `src/components/shared/priority-copy.ts`
- Modify: `src/components/character-page/DungeonPriority.tsx`
- Create: `src/components/state-legend/StateLegend.tsx`
- Modify: `src/app/page.tsx` (use `StateLegend`)
- Create: `src/components/main-nav/MainNav.tsx`, `src/components/main-nav/active-link.ts`, `src/components/main-nav/active-link.test.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces:

```ts
// @/components/shared/priority-copy
export const SEASON_LOADING: string;   // 'Loading this season’s loot…'
export const SEASON_FAILED: string;    // 'This season’s loot couldn’t be loaded. It will retry within the hour.'
export const SEASON_STALE: string;     // 'Showing older loot data: the latest update couldn’t be loaded.'
export const APPROXIMATE: string;      // 'Weights are approximate while upgrade track data is unavailable.'
export const SPLIT_DUNGEON: string;    // 'Split dungeon: loot shown for the whole instance.'
// @/components/state-legend/StateLegend
export function StateLegend(): JSX.Element;
// @/components/main-nav/active-link
export function isActiveLink(href: string, pathname: string): boolean;
```

- [ ] **Step 1: Write the failing test**

`src/components/main-nav/active-link.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isActiveLink } from './active-link';

describe('isActiveLink', () => {
  it('marks Characters on the list and on a character page, and Group on the group page', () => {
    expect(isActiveLink('/', '/')).toBe(true);
    expect(isActiveLink('/', '/characters/12')).toBe(true);
    expect(isActiveLink('/', '/group')).toBe(false);
    expect(isActiveLink('/group', '/group')).toBe(true);
    expect(isActiveLink('/group', '/')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/main-nav/active-link.test.ts` → FAIL, module missing.

- [ ] **Step 3: Implement**

`src/components/main-nav/active-link.ts`:

```ts
/** The Characters link also covers a single character's page. */
export function isActiveLink(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/characters');
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

`src/components/main-nav/MainNav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActiveLink } from './active-link';

const LINKS = [{ href: '/', label: 'Characters' }, { href: '/group', label: 'Group' }] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-2">
      {LINKS.map(({ href, label }) => {
        const active = isActiveLink(href, pathname);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={`rounded-lg px-4 py-2.5 text-[15px] font-semibold no-underline ${active ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

In `src/app/layout.tsx`, replace the whole `<nav aria-label="Main" …>…</nav>` element with `<MainNav />` and import it from `@/components/main-nav/MainNav`.

`src/components/shared/priority-copy.ts`:

```ts
// One wording for the character page and the group page.
export const SEASON_LOADING = 'Loading this season’s loot…';
export const SEASON_FAILED = 'This season’s loot couldn’t be loaded. It will retry within the hour.';
export const SEASON_STALE = 'Showing older loot data: the latest update couldn’t be loaded.';
export const APPROXIMATE = 'Weights are approximate while upgrade track data is unavailable.';
export const SPLIT_DUNGEON = 'Split dungeon: loot shown for the whole instance.';
```

In `src/components/character-page/DungeonPriority.tsx`, import these and replace the matching literal strings (`Loading this season&rsquo;s loot&hellip;`, the failed sentence, `Weights are approximate…`, `Showing older loot data…`, `Split dungeon…`) with `{SEASON_LOADING}`, `{SEASON_FAILED}`, `{APPROXIMATE}`, `{SEASON_STALE}`, `{SPLIT_DUNGEON}`. `DungeonPriority.test.ts` must stay green unchanged.

`src/components/state-legend/StateLegend.tsx` (moved from `src/app/page.tsx`, gaining "BiS in bags"):

```tsx
const LEGEND = [
  ['bg-gold', 'Done: Myth max'],
  ['bg-crest', 'Upgrade with crests'],
  ['bg-vault', 'Great Vault target'],
  ['bg-bags', 'BiS in bags'],
  ['bg-line', 'Missing'],
] as const;

export function StateLegend() {
  return (
    <div className="flex flex-wrap gap-6 text-sm text-muted" aria-label="Legend">
      {LEGEND.map(([swatch, label]) => (
        <span key={label} className="flex items-center gap-2"><span className={`size-3 rounded-sm ${swatch}`} />{label}</span>
      ))}
    </div>
  );
}
```

In `src/app/page.tsx`, delete `LEGEND` and the legend `<div>`, and render `<StateLegend />` in its place.

- [ ] **Step 4: Run the tests and the gate, including the build**

Run: `npx vitest run src/components` → PASS. Then `npm run typecheck && npm run lint && npm test && npm run build` (dev server stopped).

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/priority-copy.ts src/components/character-page/DungeonPriority.tsx src/components/state-legend src/components/main-nav src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add a group link to the main nav" -m "The nav marks the current page with aria-current, so it needs the path
and becomes a small client component. The season messages and the state
legend move out of the character pages so the group page says the same
words. The legend gains BiS in bags, which the cards never showed."
```

---

### Task 9: Group grid components

**Files:**
- Create: `src/components/group-grid/GroupGrid.tsx`, `src/components/group-grid/GroupCell.tsx`, `src/components/group-grid/MemberHeader.tsx`, `src/components/group-grid/cell-note.ts`, `src/components/group-grid/cell-note.test.ts`, `src/components/group-grid/GroupGrid.test.ts`
- Create: `src/components/remove-from-group/RemoveFromGroupButton.tsx`
- Create: `src/components/track-button/TrackButton.tsx`

**Interfaces:**
- Consumes: `GroupMemberView`, `GroupGridRow`, `GearRowView` (Task 6); `removeMember`, `groupHref`, `parseMemberKey` (Task 2); `ItemCard`, `StateBadge`, `UpgradeBadge`, `CrestSummary`, `CharacterAvatar`, `RefreshButton`, `rowTone`, `ROW_TONE_STYLES`.
- Produces:

```ts
export function GroupGrid(props: { members: GroupMemberView[]; grid: GroupGridRow[]; keys: string[]; tracksKnown: boolean; now: number }): JSX.Element;
export function cellNote(state: GroupMemberState, hasRows: boolean): { text: string; dim: boolean } | null;   // null = show the cell
export function needText(cell: GearRowView): string | null;
export function RemoveFromGroupButton(props: { memberKey: string; name: string; keys: string[]; variant?: 'icon' | 'text' }): JSX.Element;
export function TrackButton(props: { memberKey: string; name: string; keys: string[] }): JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

`src/components/group-grid/cell-note.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GearRowView } from '@/server/views/types';
import { cellNote, needText } from './cell-note';

const row = (bis: GearRowView['bis'], state: GearRowView['state'] = 'missing'): GearRowView =>
  ({ slotLabel: 'Head', slot: 'HEAD', state, equipped: null, upgrade: null, bis });
const named = { kind: 'item' as const, itemId: 1, name: 'Greathelm', itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null, isTier: false, isCatalyst: false, source: '' };

describe('cellNote', () => {
  it('fills cells for members without rows, dimming the ones still waiting', () => {
    expect(cellNote('ready', true)).toBeNull();
    expect(cellNote('ready', false)).toEqual({ text: 'No BiS list', dim: false });
    expect(cellNote('untracked', false)).toEqual({ text: 'Not tracked', dim: true });
    expect(cellNote('syncing', false)).toEqual({ text: 'Syncing…', dim: true });
    expect(cellNote('noGear', false)).toEqual({ text: 'No gear yet', dim: true });
    expect(cellNote('notFound', false)).toEqual({ text: 'Not found', dim: true });
  });
});

describe('needText', () => {
  it('names what is still needed, and nothing once the BiS item is worn', () => {
    expect(needText(row(named))).toBe('Need: Greathelm');
    expect(needText(row({ ...named, isTier: true }))).toBe('Need: tier via catalyst');
    expect(needText(row({ kind: 'any', minItemLevel: 334, source: '' }))).toBe('Need: any item, level 334+');
    expect(needText(row(named, 'done'))).toBeNull();
    expect(needText(row(named, 'inBags'))).toBe('Need: Greathelm, in your bags');
  });
});
```

`src/components/group-grid/GroupGrid.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { GroupGridRow, GroupMemberView } from '@/server/views/types';
import { GroupGrid } from './GroupGrid';

// Client children need the App Router context, which a static render doesn't have. vi.mock is hoisted above the imports.
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const member = (over: Partial<GroupMemberView>): GroupMemberView => ({
  key: 'eu.argent-dawn.birkibjörn', name: 'Birkibjörn', realmSlug: 'argent-dawn', character: null, state: 'ready',
  syncError: null, bisError: null, hasRows: true, listType: 'mythicPlus', fellBack: false, crests: null, ...over,
});
const render = (members: GroupMemberView[], grid: GroupGridRow[]) =>
  renderToStaticMarkup(createElement(GroupGrid, { members, grid, keys: members.map((m) => m.key), tracksKnown: true, now: 0 })).replace(/<link[^>]*\/>/g, '');

describe('GroupGrid', () => {
  it('shows each member state in words', () => {
    const html = render([
      member({ key: 'eu.argent-dawn.gnúpur', name: 'gnúpur', state: 'untracked', hasRows: false }),
      member({ key: 'eu.argent-dawn.sólrún', name: 'Sólrún', state: 'noGear', hasRows: false, syncError: 'Blizzard returned 503' }),
      member({ key: 'eu.argent-dawn.ylfa', name: 'Ylfa', state: 'notFound', hasRows: false }),
    ], [{ slot: 'HEAD', label: 'Head', cells: [null, null, null] }]);
    expect(html).toContain('Not tracked');
    expect(html).toContain('Track');
    expect(html).toContain('Couldn’t sync: Blizzard returned 503');
    expect(html).toContain('Blizzard can’t find this character');
    expect(html).toContain('Remove from group');
  });

  it('names the list a member uses, and the fallback', () => {
    const html = render([member({ listType: 'overall', fellBack: true })], []);
    expect(html).toContain('Overall, Method has no Mythic+ list');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/group-grid` → FAIL, modules missing.

- [ ] **Step 3: Implement the logic**

`src/components/group-grid/cell-note.ts`:

```ts
import type { GearRowView, GroupMemberState } from '@/server/views/types';

/** What a member's cells say when there are no rows to show. Dimmed ones are waiting on something. */
export function cellNote(state: GroupMemberState, hasRows: boolean): { text: string; dim: boolean } | null {
  switch (state) {
    case 'ready': return hasRows ? null : { text: 'No BiS list', dim: false };
    case 'untracked': return { text: 'Not tracked', dim: true };
    case 'syncing': return { text: 'Syncing…', dim: true };
    case 'noGear': return { text: 'No gear yet', dim: true };
    case 'notFound': return { text: 'Not found', dim: true };
  }
}

/** The "Need:" line under a cell whose BiS item isn't worn yet. */
export function needText(cell: GearRowView): string | null {
  if (cell.state !== 'missing' && cell.state !== 'inBags') return null;
  if (cell.bis.kind === 'any') return `Need: any item, level ${cell.bis.minItemLevel}+`;
  if (cell.bis.isTier) return 'Need: tier via catalyst';
  return cell.state === 'inBags' ? `Need: ${cell.bis.name}, in your bags` : `Need: ${cell.bis.name}`;
}
```

- [ ] **Step 4: Implement the client buttons**

`src/components/remove-from-group/RemoveFromGroupButton.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { groupHref, removeMember } from '@/core/characters/member-key';

/** Membership is the URL, so removing a member is a navigation, not a request. */
export function RemoveFromGroupButton({ memberKey, name, keys, variant = 'icon' }: { memberKey: string; name: string; keys: string[]; variant?: 'icon' | 'text' }) {
  const router = useRouter();
  const remove = () => router.replace(groupHref(removeMember(keys, memberKey)));
  if (variant === 'text') {
    return <button type="button" onClick={remove} className="h-11 rounded-xl border border-line-strong bg-raised px-4 font-semibold">Remove from group</button>;
  }
  return (
    <button type="button" onClick={remove} aria-label={`Remove ${name} from group`}
      className="flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  );
}
```

`src/components/track-button/TrackButton.tsx`:

```tsx
'use client';

import { useApiAction } from '@/components/hooks/use-api-action';
import { RemoveFromGroupButton } from '@/components/remove-from-group/RemoveFromGroupButton';
import { parseMemberKey } from '@/core/characters/member-key';

/** Tracks a member named in the link but not on this install. Nothing is fetched until it's pressed. */
export function TrackButton({ memberKey, name, keys }: { memberKey: string; name: string; keys: string[] }) {
  const { busy, error, run } = useApiAction();
  const key = parseMemberKey(memberKey);
  if (!key) return null;
  const track = () => run('/api/characters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ region: key.region, name: key.nameKey, realmSlug: key.realmSlug }),
  }, { fallbackError: `Couldn’t track ${name}.` });
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={track} disabled={busy} className="h-11 rounded-xl border border-line-strong bg-raised px-4 font-semibold disabled:opacity-50">
        {busy ? 'Tracking…' : 'Track'}
      </button>
      {error && (
        <>
          <p role="alert" className="text-sm text-[#f3c9a2]">{error}</p>
          <RemoveFromGroupButton memberKey={memberKey} name={name} keys={keys} variant="text" />
        </>
      )}
    </div>
  );
}
```

(`text-[#f3c9a2]` is the existing error color used by `AddCharacterBar` and `DungeonPriority`; it isn't a new hex.)

- [ ] **Step 5: Implement the grid**

`src/components/group-grid/MemberHeader.tsx`:

```tsx
import Link from 'next/link';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { CrestSummary } from '@/components/crest-summary/CrestSummary';
import { RefreshButton } from '@/components/refresh-button/RefreshButton';
import { RemoveFromGroupButton } from '@/components/remove-from-group/RemoveFromGroupButton';
import { TrackButton } from '@/components/track-button/TrackButton';
import type { GroupMemberView } from '@/server/views/types';

const LIST_LABEL = (m: GroupMemberView) => (m.fellBack ? 'Overall, Method has no Mythic+ list' : m.listType === 'overall' ? 'Overall' : 'Mythic+');

export function MemberHeader({ member, keys, now }: { member: GroupMemberView; keys: string[]; now: number }) {
  const c = member.character;
  return (
    <div className="flex flex-col gap-2 p-3">
      <span className="flex items-center gap-2">
        {c && <CharacterAvatar name={c.name} className={c.className} avatarUrl={c.avatarUrl} classIconUrl={c.classIconUrl} size={32} />}
        {c ? <Link href={`/characters/${c.id}`} className="font-semibold">{c.name}</Link> : <span className="font-semibold">{member.name}</span>}
      </span>
      {member.state === 'untracked' && (
        <>
          <span className="text-sm text-muted">Not tracked · {member.realmSlug}</span>
          <TrackButton memberKey={member.key} name={member.name} keys={keys} />
        </>
      )}
      {member.state === 'notFound' && (
        <>
          <span role="alert" className="text-sm text-[#f3c9a2]">Blizzard can&rsquo;t find this character</span>
          <RemoveFromGroupButton memberKey={member.key} name={member.name} keys={keys} variant="text" />
        </>
      )}
      {c && member.state !== 'notFound' && (
        <>
          <span className="text-xs text-muted">{LIST_LABEL(member)}</span>
          {member.syncError && (
            <>
              <span role="alert" className="text-sm text-[#f3c9a2]">Couldn&rsquo;t sync: {member.syncError}</span>
              <RefreshButton id={c.id} />
            </>
          )}
          {member.bisError && <span className="text-sm text-[#f3c9a2]">{member.bisError}</span>}
          {member.crests
            ? <CrestSummary crests={member.crests} now={now} />
            : <span className="text-xs text-muted">Crests unknown. <Link href={`/characters/${c.id}`}>Paste SimC</Link> to see them.</span>}
        </>
      )}
    </div>
  );
}
```

`src/components/group-grid/GroupCell.tsx`:

```tsx
import { EmptySlotCard } from '@/components/empty-slot-card/EmptySlotCard';
import { ItemCard } from '@/components/item-card/ItemCard';
import { ROW_TONE_STYLES, rowTone } from '@/components/shared/row-tone';
import { StateBadge } from '@/components/state-badge/StateBadge';
import { UpgradeBadge } from '@/components/upgrade-badge/UpgradeBadge';
import type { GearRowView } from '@/server/views/types';
import { needText } from './cell-note';

export function GroupCell({ cell, tracksKnown }: { cell: GearRowView | null; tracksKnown: boolean }) {
  if (!cell) return <div className="p-2 text-muted">&mdash;</div>;
  const tone = rowTone(cell.state, tracksKnown);
  const need = needText(cell);
  return (
    <div className="m-1 flex flex-col gap-1.5 rounded-[10px] p-2" style={tone ? ROW_TONE_STYLES[tone] : undefined}>
      {cell.equipped ? (
        <ItemCard itemId={cell.equipped.itemId} name={cell.equipped.name} quality={cell.equipped.quality} iconUrl={cell.equipped.iconUrl}
          bonusIds={cell.equipped.bonusIds} itemLevel={cell.equipped.itemLevel}
          detail={[cell.equipped.trackLabel ?? 'no track', cell.equipped.itemLevel].filter(Boolean).join(' · ')} />
      ) : <EmptySlotCard />}
      <span className="flex flex-wrap items-center gap-2">
        <StateBadge state={cell.state} />
        {cell.upgrade && <UpgradeBadge upgrade={cell.upgrade} />}
      </span>
      {need && <span className="text-sm text-muted">{need}</span>}
    </div>
  );
}
```

`src/components/group-grid/GroupGrid.tsx`:

```tsx
import type { GroupGridRow, GroupMemberView } from '@/server/views/types';
import { cellNote } from './cell-note';
import { GroupCell } from './GroupCell';
import { MemberHeader } from './MemberHeader';

interface Props { members: GroupMemberView[]; grid: GroupGridRow[]; keys: string[]; tracksKnown: boolean; now: number }

export function GroupGrid({ members, grid, keys, tracksKnown, now }: Props) {
  const columns = { gridTemplateColumns: `110px repeat(${members.length}, minmax(220px, 1fr))` };
  const notes = members.map((m) => cellNote(m.state, m.hasRows));
  // A member without rows still gets a cell in every row, so the column reads as a column.
  const rows = grid.length > 0 ? grid : [{ slot: 'HEAD' as const, label: '', cells: members.map(() => null) }];
  return (
    <section aria-label="Gear by slot" className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div className="grid min-w-fit" style={columns}>
        <span className="sticky left-0 border-b border-line bg-surface p-3 text-[13px] font-semibold uppercase tracking-wider text-muted">Slot</span>
        {members.map((m) => <div key={m.key} className="border-b border-line"><MemberHeader member={m} keys={keys} now={now} /></div>)}
        {rows.map((row) => (
          <div key={row.slot} className="contents">
            <span className="sticky left-0 bg-surface p-3 font-semibold text-muted">{row.label}</span>
            {row.cells.map((cell, i) => {
              const note = notes[i];
              if (note) return <div key={i} className={`p-3 text-sm ${note.dim ? 'text-muted opacity-60' : 'text-muted'}`}>{note.text}</div>;
              return <GroupCell key={i} cell={cell} tracksKnown={tracksKnown} />;
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Run the tests and the gate, then commit**

Run: `npx vitest run src/components/group-grid` → PASS. If the `vi.mock` route doesn't satisfy a child (for example `next/link` needing context), mock that module the same way rather than changing the components. Then `npm run typecheck && npm run lint && npm test && npm run build`.

```bash
git add src/components/group-grid src/components/remove-from-group src/components/track-button
git commit -m "feat: show the group's gear side by side" -m "Each member gets a column with its list, crests and any sync trouble in
the header, and each cell says what is still needed. Members without
rows fill their cells with words rather than blanks, and dimming always
comes with text so the state never rests on opacity alone."
```

---

### Task 10: Group priority, vault, members and cookie

**Files:**
- Create: `src/components/group-priority/GroupPriority.tsx`, `src/components/group-priority/GroupPriority.test.ts`
- Create: `src/components/group-vault/GroupVault.tsx`, `src/components/group-vault/GroupVault.test.ts`
- Create: `src/components/group-members/GroupMembers.tsx`
- Create: `src/components/remember-group/RememberGroup.tsx`
- Modify: `src/components/add-character-bar/AddCharacterBar.tsx`, `src/components/add-character-bar/use-character-search.ts`

**Interfaces:**
- Consumes: `GroupPriorityView`, `GroupVaultView`, `GroupMemberView` (Task 6); priority copy (Task 8); `addMember`, `groupHref`, `encodeGroupCookie`, `GROUP_COOKIE`, `MAX_GROUP_SIZE` (Task 2); `RemoveFromGroupButton` (Task 9).
- Produces:

```ts
export function GroupPriority(props: { priority: GroupPriorityView }): JSX.Element;
export function GroupVault(props: { vault: GroupVaultView[]; now: number }): JSX.Element;
export function GroupMembers(props: { members: GroupMemberView[]; keys: string[]; region: Region | null; available: { key: string; label: string }[]; tracked: TrackedCharacter[] }): JSX.Element;
export function RememberGroup(props: { keys: string[] }): null;
// AddCharacterBar gains: lockedRegion?: Region | null; onAdded?: (added: { id: number; key: string }) => void
// useCharacterSearch gains: (lockedRegion?: Region | null)
```

- [ ] **Step 1: Write the failing render tests**

`src/components/group-priority/GroupPriority.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GroupPriorityView } from '@/server/views/types';
import { GroupPriority } from './GroupPriority';

const render = (priority: GroupPriorityView) =>
  renderToStaticMarkup(createElement(GroupPriority, { priority })).replace(/<link[^>]*\/>/g, '');
const base: GroupPriorityView = { season: 'ready', approximate: false, covered: ['Birkibjörn'], excluded: [], fellBack: [], ranking: { dungeons: [], nothingFrom: [] } };
const credits = { key: 'eu.argent-dawn.birkibjörn', name: 'Birkibjörn', className: 'Druid', avatarUrl: null, classIconUrl: null };

describe('GroupPriority', () => {
  it('ranks dungeons with each member’s needs, and marks only split ones', () => {
    const html = render({ ...base, ranking: { nothingFrom: ['Delta Deep'], dungeons: [
      { challengeModeId: 501, name: 'Alpha Hollow', score: 5, split: false, members: [{ ...credits, credits: [{ kind: 'tier', slotLabel: 'Chest', weight: 5 }] }] },
      { challengeModeId: 502, name: 'Streets of Beta', score: 3, split: true, members: [{ ...credits, credits: [{ kind: 'any', slotLabel: 'Boots', weight: 3, minItemLevel: 334 }] }] },
    ] } });
    expect(html).toContain('Alpha Hollow');
    expect(html).toContain('Tier via catalyst');
    expect(html).toContain('Any item, level 334+');
    expect(html.match(/Split dungeon/g)).toHaveLength(1);
    expect(html).toContain('Nothing anyone needs from: Delta Deep.');
  });

  it('says the ranking is unavailable when nobody is eligible, without claiming nothing is needed', () => {
    const html = render({ ...base, covered: [], excluded: [{ name: 'Sólrún', reason: 'no gear yet' }], ranking: null });
    expect(html).toContain('Dungeon priority needs at least one member with gear and a BiS list.');
    expect(html).toContain('Sólrún (no gear yet)');
    expect(html).not.toContain('still needs');
  });

  it('names who a partial ranking covers and who it leaves out', () => {
    const html = render({ ...base, covered: ['Birkibjörn', 'Hrafnhildur'], excluded: [{ name: 'Sólrún', reason: 'no gear yet' }] });
    expect(html).toContain('Covers Birkibjörn and Hrafnhildur. Left out: Sólrún (no gear yet).');
  });

  it('says the group needs nothing only when eligible members need nothing', () => {
    expect(render(base)).toContain('No season dungeon drops anything the group still needs.');
  });

  it('shows the season states, the fallback and approximate weights', () => {
    expect(render({ ...base, season: 'loading' })).toContain('Loading this season’s loot…');
    expect(render({ ...base, season: 'failed' })).toContain('It will retry within the hour.');
    const html = render({ ...base, season: 'stale', approximate: true, fellBack: ['Hrafnhildur'] });
    expect(html).toContain('Showing older loot data');
    expect(html).toContain('Weights are approximate');
    expect(html).toContain('Hrafnhildur uses the Overall list: Method has no Mythic+ list for that spec.');
  });
});
```

`src/components/group-vault/GroupVault.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GroupVault } from './GroupVault';

describe('GroupVault', () => {
  it('keeps no paste, an empty paste and choices apart, with the paste age', () => {
    const html = renderToStaticMarkup(createElement(GroupVault, { now: 3 * 86_400_000, vault: [
      { key: 'a', name: 'Birkibjörn', pastedAt: null, choices: [] },
      { key: 'b', name: 'Sólrún', pastedAt: 0, choices: [] },
      { key: 'c', name: 'Gnúpur', pastedAt: 0, choices: [{ itemId: 61, name: 'Item 61', itemLevel: 330, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null, isBis: true }] },
    ] })).replace(/<link[^>]*\/>/g, '');
    expect(html).toContain('No SimC paste yet.');
    expect(html).toContain('No item choices in the vault in the last paste.');
    expect(html).toContain('from SimC pasted');
    expect(html).toContain('>BiS<');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/group-priority src/components/group-vault` → FAIL, modules missing.

- [ ] **Step 3: Implement `GroupPriority`**

`src/components/group-priority/GroupPriority.tsx`:

```tsx
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { APPROXIMATE, SEASON_FAILED, SEASON_LOADING, SEASON_STALE, SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import { wowheadData } from '@/components/item-card/wowhead';
import type { GroupPriorityView, PriorityCreditView } from '@/server/views/types';

const names = (list: string[]) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);
const excludedText = (excluded: GroupPriorityView['excluded']) => excluded.map((e) => `${e.name} (${e.reason})`).join(', ');

function Credit({ credit }: { credit: PriorityCreditView }) {
  if (credit.kind === 'item') {
    return (
      <a href={`https://www.wowhead.com/item=${credit.item.itemId}`} data-wowhead={wowheadData(credit.item.itemId, credit.item.bonusIds, null)}
        target="_blank" rel="noreferrer" title={`${credit.slotLabel} · weight ${credit.weight}`}>{credit.item.name}</a>
    );
  }
  const what = credit.kind === 'tier' ? 'Tier via catalyst' : `Any item, level ${credit.minItemLevel}+`;
  return <span title={`weight ${credit.weight}`}>{credit.slotLabel}: {what}</span>;
}

function Ranking({ priority }: { priority: GroupPriorityView }) {
  if (priority.season === 'loading') return <p role="status" className="text-muted">{SEASON_LOADING}</p>;
  if (priority.season === 'failed') return <p role="alert" className="text-[#f3c9a2]">{SEASON_FAILED}</p>;
  if (!priority.ranking) {
    return (
      <p className="text-muted">
        Dungeon priority needs at least one member with gear and a BiS list.
        {priority.excluded.length > 0 && <> Left out: {excludedText(priority.excluded)}.</>}
      </p>
    );
  }
  const { dungeons, nothingFrom } = priority.ranking;
  if (dungeons.length === 0) return <p className="text-muted">No season dungeon drops anything the group still needs.</p>;
  return (
    <>
      <ol className="flex flex-col gap-4">
        {dungeons.map((d, i) => (
          <li key={d.challengeModeId} className="flex gap-3">
            <span className="w-6 shrink-0 font-mono text-muted">{i + 1}</span>
            <div className="flex grow flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{d.name}</span>
                <span className="font-mono text-gold">{d.score}</span>
              </div>
              {d.split && <span className="text-xs text-muted">{SPLIT_DUNGEON}</span>}
              {d.members.map((m) => (
                <div key={m.key} className="flex items-start gap-2 text-[15px]">
                  <CharacterAvatar name={m.name} className={m.className} avatarUrl={m.avatarUrl} classIconUrl={m.classIconUrl} size={24} />
                  <span className="font-semibold">{m.name}</span>
                  <span className="flex flex-wrap gap-x-2 text-muted">
                    {m.credits.map((c, j) => <Credit key={j} credit={c} />)}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {nothingFrom.length > 0 && <p className="text-sm text-muted">Nothing anyone needs from: {nothingFrom.join(', ')}.</p>}
    </>
  );
}

export function GroupPriority({ priority }: { priority: GroupPriorityView }) {
  const partial = priority.ranking && priority.excluded.length > 0;
  return (
    <section aria-label="Dungeon priority" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Dungeon priority</h2>
        <span className="text-sm text-muted">Score = weighted upgrades</span>
      </div>
      {partial && <p className="text-sm text-muted">Covers {names(priority.covered)}. Left out: {excludedText(priority.excluded)}.</p>}
      {priority.fellBack.map((n) => <p key={n} className="text-sm text-muted">{n} uses the Overall list: Method has no Mythic+ list for that spec.</p>)}
      {priority.approximate && <p className="text-sm text-muted">{APPROXIMATE}</p>}
      {priority.season === 'stale' && <p className="text-sm text-muted">{SEASON_STALE}</p>}
      <Ranking priority={priority} />
    </section>
  );
}
```

Check `wowheadData`'s actual signature in `src/components/item-card/wowhead.ts` and match it.

- [ ] **Step 4: Implement `GroupVault`**

`src/components/group-vault/GroupVault.tsx`:

```tsx
import { ItemCard } from '@/components/item-card/ItemCard';
import { formatAge } from '@/core/format';
import type { GroupVaultView } from '@/server/views/types';

export function GroupVault({ vault, now }: { vault: GroupVaultView[]; now: number }) {
  return (
    <section aria-label="Great Vault" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-2xl font-bold">Great Vault</h2>
      {vault.map((v) => (
        <div key={v.key} className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold">
            {v.name}{v.pastedAt !== null && <span className="font-normal text-muted"> · from SimC pasted {formatAge(v.pastedAt, now)}</span>}
          </h3>
          {v.pastedAt === null ? (
            <p className="text-sm text-muted">No SimC paste yet.</p>
          ) : v.choices.length === 0 ? (
            <p className="text-sm text-muted">No item choices in the vault in the last paste.</p>
          ) : v.choices.map((choice, i) => (
            <div key={`${choice.itemId}-${i}`} className="flex items-center gap-3">
              <div className="min-w-0 grow">
                <ItemCard itemId={choice.itemId} name={choice.name} quality={choice.quality} iconUrl={choice.iconUrl}
                  bonusIds={choice.bonusIds} itemLevel={choice.itemLevel}
                  detail={[choice.trackLabel, choice.itemLevel].filter(Boolean).join(' · ') || undefined} />
              </div>
              <span className={`w-20 shrink-0 text-sm font-bold ${choice.isBis ? 'text-bags' : 'text-muted'}`}>{choice.isBis ? 'BiS' : 'Not BiS'}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Run the render tests**

Run: `npx vitest run src/components/group-priority src/components/group-vault` → PASS.

- [ ] **Step 6: Let `AddCharacterBar` serve the group page**

In `src/components/add-character-bar/use-character-search.ts`, change the signature to `export function useCharacterSearch(lockedRegion: Region | null = null)` and, right after the `useState` for `region`, add:

```ts
  // A group locks the region to its members'; the user's own choice applies only when nothing locks it.
  const effectiveRegion = lockedRegion ?? region;
```

Use `effectiveRegion` instead of `region` in both fetch URLs and in both effects' dependency arrays, and return `region: effectiveRegion`.

In `src/components/add-character-bar/AddCharacterBar.tsx`:

```tsx
interface Props {
  trackedCharacters: TrackedCharacter[];
  /** Set by the group page: search only this region, and keep the select fixed on it. */
  lockedRegion?: Region | null;
  /** Set by the group page: what to do with the added character instead of opening its page. */
  onAdded?: (added: { id: number; key: string }) => void;
}

export function AddCharacterBar({ trackedCharacters, lockedRegion = null, onAdded }: Props) {
```

Pass `lockedRegion` to `useCharacterSearch(lockedRegion)`. In `add`, read `{ id?: number; key?: string }` from `run`, and replace `startTransition(() => router.push(`/characters/${id}`));` with:

```tsx
    const key = result.ok ? result.data?.key : undefined;
    startTransition(() => (onAdded && key ? onAdded({ id, key }) : router.push(`/characters/${id}`)));
```

Add `disabled={lockedRegion !== null}` to the region `<select>`.

- [ ] **Step 7: Implement `GroupMembers` and `RememberGroup`**

`src/components/remember-group/RememberGroup.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { encodeGroupCookie, GROUP_COOKIE } from '@/core/characters/member-key';

/** Remembers the group shown, so the nav link reopens it. An empty group is remembered as empty. */
export function RememberGroup({ keys }: { keys: string[] }) {
  const value = encodeGroupCookie(keys);
  useEffect(() => {
    document.cookie = `${GROUP_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
  }, [value]);
  return null;
}
```

`src/components/group-members/GroupMembers.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AddCharacterBar } from '@/components/add-character-bar/AddCharacterBar';
import type { TrackedCharacter } from '@/components/add-character-bar/tracked';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { RemoveFromGroupButton } from '@/components/remove-from-group/RemoveFromGroupButton';
import { LABEL_CLASS } from '@/components/shared/field-classes';
import { addMember, groupHref, MAX_GROUP_SIZE } from '@/core/characters/member-key';
import type { Region } from '@/core/types';
import type { GroupMemberView } from '@/server/views/types';

interface Props {
  members: GroupMemberView[];
  keys: string[];
  region: Region | null;
  available: { key: string; label: string }[];
  tracked: TrackedCharacter[];
}

export function GroupMembers({ members, keys, region, available, tracked }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const add = (key: string) => startTransition(() => router.replace(groupHref(addMember(keys, key))));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {members.map((m) => (
          <span key={m.key} className="flex h-12 items-center gap-2 rounded-full border border-line bg-surface-2 pl-1.5">
            {m.character && <CharacterAvatar name={m.character.name} className={m.character.className} avatarUrl={m.character.avatarUrl} classIconUrl={m.character.classIconUrl} size={32} />}
            <span className="font-semibold">{m.name}</span>
            {m.character && <span className="text-sm text-muted">{m.character.spec}</span>}
            <RemoveFromGroupButton memberKey={m.key} name={m.name} keys={keys} />
          </span>
        ))}
        {keys.length < MAX_GROUP_SIZE
          ? <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="h-12 rounded-full border border-line-strong bg-raised px-5 font-semibold">Add character</button>
          : <span className="text-sm text-muted">Group is full ({MAX_GROUP_SIZE})</span>}
        {pending && <span role="status" className="text-sm text-muted">Updating group…</span>}
      </div>
      {open && keys.length < MAX_GROUP_SIZE && (
        <div className="flex flex-col gap-3">
          {available.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="group-pick" className={LABEL_CLASS}>Tracked characters</label>
              <select id="group-pick" value="" onChange={(e) => e.target.value && add(e.target.value)}
                className="h-12 w-80 max-w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-ink">
                <option value="">Choose a character</option>
                {available.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </div>
          )}
          <AddCharacterBar trackedCharacters={tracked} lockedRegion={region} onAdded={({ key }) => add(key)} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run the gate and commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`.

```bash
git add src/components/group-priority src/components/group-vault src/components/group-members src/components/remember-group src/components/add-character-bar
git commit -m "feat: add the group's priority, vault and member controls" -m "The priority section keeps an unavailable ranking apart from a group
that needs nothing, and names who a partial ranking leaves out. Member
chips edit the URL directly, and the existing add bar serves the group
page with its region locked, adding to the group instead of opening the
new character."
```

---

### Task 11: The group page

**Files:**
- Create: `src/app/group/page.tsx`

**Interfaces:**
- Consumes: `resolveGroupRequest` (Task 4), `getGroupPage` (Task 7), `GROUP_COOKIE` (Task 2), every component from Tasks 8–10, `StaleSync`, `SeasonSync`, `SetupNotice`.

- [ ] **Step 1: Read the Next docs**

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` and `redirect.md`. Both `cookies()` and `searchParams` are async in this version.

- [ ] **Step 2: Write the page**

`src/app/group/page.tsx`:

```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GroupGrid } from '@/components/group-grid/GroupGrid';
import { GroupMembers } from '@/components/group-members/GroupMembers';
import { GroupPriority } from '@/components/group-priority/GroupPriority';
import { GroupVault } from '@/components/group-vault/GroupVault';
import { RememberGroup } from '@/components/remember-group/RememberGroup';
import { SeasonSync } from '@/components/season-sync/SeasonSync';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { StaleSync } from '@/components/stale-sync/StaleSync';
import { StateLegend } from '@/components/state-legend/StateLegend';
import { GROUP_COOKIE } from '@/core/characters/member-key';
import { isMissingConfigError } from '@/core/config';
import { getServices, type Services } from '@/server/services';
import { getGroupPage } from '@/server/views/group-page';
import { resolveGroupRequest } from '@/server/views/group-page-params';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ chars?: string | string[] }> };

export default async function GroupPage({ searchParams }: Props) {
  const [{ chars }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const request = resolveGroupRequest(chars, cookieStore.get(GROUP_COOKIE)?.value);
  if ('redirect' in request) redirect(request.redirect);

  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (isMissingConfigError(err)) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const view = await getGroupPage(services, request.keys);
  const now = services.now();

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-12 sm:px-16">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl font-bold tracking-wide">Group</h1>
        <GroupMembers members={view.members} keys={view.keys} region={view.region} available={view.available} tracked={view.tracked} />
        {view.dropped.map((d) => (
          <p key={`${d.region}-${d.name}`} className="text-sm text-muted">{d.name} ({d.region.toUpperCase()}) dropped: group members must share a region.</p>
        ))}
      </div>
      {view.members.length === 0 ? (
        <p className="text-muted">Pick up to five characters to compare their gear and rank dungeons for the group.</p>
      ) : (
        <>
          <StateLegend />
          <GroupGrid members={view.members} grid={view.grid} keys={view.keys} tracksKnown={view.tracksKnown} now={now} />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
            <GroupPriority priority={view.priority} />
            <GroupVault vault={view.vault} now={now} />
          </div>
        </>
      )}
      <RememberGroup keys={view.keys} />
      <StaleSync ids={view.staleIds} />
      {view.region && <SeasonSync region={view.region} needed={view.needsSeasonSync} />}
    </main>
  );
}
```

- [ ] **Step 3: Gate and build**

Stop `npm run dev` if it's running. Run `npm run typecheck && npm run lint && npm test && npm run build`. All green.

- [ ] **Step 4: Check by hand**

Start `npm run dev` and work through this list, with at least two tracked EU characters and one US character in `data/app.db`:

1. Nav shows Characters and Group; the current one is highlighted.
2. `/group` with no cookie shows the empty-group sentence and Add character.
3. Add from the dropdown, then by search; both stay on `/group` and add a column. The search region select is locked to the group's region.
4. Reload `/group` from the nav: it reopens the same group. Remove every member: `/group?chars=`, and the nav link now opens an empty group.
5. Hand-type `/group?chars=eu.<realm-slug>.<Name>` for a character not tracked: column says Not tracked; Track tracks it and fills the column. Type a misspelled name: Track shows Blizzard's error and Remove from group.
6. Add a US key to an EU group's URL: it's dropped with the region note.
7. Five members: Add character becomes "Group is full (5)".
8. At ~1000 px wide the grid scrolls sideways with the Slot column staying put; priority and vault stack below `lg`.
9. Hover an item: Wowhead tooltip shows.

- [ ] **Step 5: Commit**

```bash
git add src/app/group/page.tsx
git commit -m "feat: add the group page" -m "The page reopens the remembered group when its link has no members,
then renders the gear grid with dungeon priority and Great Vault below
it, and mounts the gear and season syncs for its members."
```

---

### Task 12: Follow-up issue and pull request

- [ ] **Step 1: File the follow-up issue**

```bash
gh issue create --title "Move Method and Raidbots refreshes off the render path" --label tech-debt --body "Pages still wait for a stale Method or Raidbots refresh before rendering. Since #44 a failed spec retries at most hourly, so an outage no longer slows every load, but the first load of the day still waits. Move the refresh behind a client-triggered route, as SeasonSync does for season loot, before hosting (#8)."
```

- [ ] **Step 2: Push and open the pull request**

```bash
git push -u origin feat/group-page
gh pr create --title "feat: add the group page" --body-file <file>
```

Body, following `AGENTS.md`:

- `Closes #44.`
- `## What changes`: one bolded bullet each for member keys, the add route's key, the Method backoff, the member extraction, the loader, the grid, priority and vault, member controls and cookie, the nav, and the page.
- `## Data`: no schema change. New `meta` entries `bis.<spec slug>.failed`. A new browser cookie, `group`.
- `## Testing`: the test count, typecheck, lint and build status, the hand checks from Task 11 Step 4, and the gap: "the project has no browser-level test setup yet (#35), so membership edits, the Track button, the cookie redirect, the locked region select and the sticky slot column have no automated test."
- `Spec: docs/superpowers/specs/2026-10-03-plan-3b-group-page-design.md`
- No AI attribution.
