# Character identity implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show character avatars, race and faction across the app, and class icons with faction badges in search results.

**Architecture:** The Blizzard client gains race, faction, avatar and class icon calls. The character syncer stores race, faction and avatar URL on the character row. A cached `class_media` table maps class names to icons. View models add an identity line and avatar data. Two shared components, `CharacterAvatar` and `FactionBadge`, render them on the character page, the character cards and the search results.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Drizzle ORM with libsql, Vitest, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-09-26-character-identity-design.md`

**Branch:** `feat/character-identity`, which already holds the approved spec.

## Global Constraints

- Everything in `AGENTS.md` applies. Every database write goes through `withWriteLock`, and `src/core` never imports Next.js or React.
- A failed avatar fetch never fails a sync, and never clears a stored avatar.
- The faction badge is decorative. The faction name always appears in text next to it.
- The identity line is race, spec and class joined by spaces, skipping missing parts.
- Commit messages and pull request descriptions never mention AI tools.

## Review Focus

1. **Characters synced before this change** have no race, faction or avatar until their next sync. They must show the class icon fallback and "Guardian Druid", not "null Guardian Druid". Pinned in Tasks 5 and 6.
2. **Blizzard has no avatar,** for a new or long-inactive character: the character media call returns 404. The sync must still succeed. Pinned in Tasks 1 and 3.
3. **A search result for a class the icon cache doesn't know,** or with no faction: it must still render, with the initial and no badge. Pinned in Task 7.
4. **The Compare as override:** the identity line must use the override spec, for example "Troll Feral Druid". Pinned in Task 5.

---

### Task 1: Blizzard client: race, faction, avatar and class icons

**Files:**
- Modify: `src/core/blizzard/client.ts`
- Test: `src/core/blizzard/client.test.ts`, `src/core/sync/character-sync.test.ts` (fake client only)

**Interfaces:**
- Produces:
  - `CharacterProfile` gains `raceName: string` and `faction: Faction | null`
  - `type Faction = 'HORDE' | 'ALLIANCE'`, exported from `src/core/types.ts`
  - `BlizzardClient.getCharacterMedia(ref): Promise<string | null>`, the avatar URL, or `null` on 404 or no avatar
  - `BlizzardClient.getClassIconUrl(region, classId): Promise<string | null>`

- [ ] **Step 1: Add the Faction type**

In `src/core/types.ts`, add after `SnapshotSource`:

```ts
export type Faction = 'HORDE' | 'ALLIANCE';
```

- [ ] **Step 2: Write the failing tests**

In `src/core/blizzard/client.test.ts`:

1. Replace the `profile` constant:

```ts
const profile = {
  name: 'Birkibjörn',
  realm: { id: 1306, name: 'Tarren Mill', slug: 'tarren-mill' },
  character_class: { name: 'Druid' },
  active_spec: { name: 'Guardian' },
  race: { name: 'Troll' },
  faction: { type: 'HORDE' },
};
```

2. In `it('maps the profile', ...)`, replace the expected object with:

```ts
    expect(await api.getProfile(ref)).toEqual({
      name: 'Birkibjörn', realmId: 1306, realmSlug: 'tarren-mill', realmName: 'Tarren Mill',
      className: 'Druid', specName: 'Guardian', raceName: 'Troll', faction: 'HORDE',
    });
```

3. Add inside the `describe`:

```ts
  it('treats a missing race and an unknown faction as empty', async () => {
    const { api } = client([on('/character/tarren-mill/', () => json({ ...profile, race: undefined, faction: { type: 'NEUTRAL' } }))]);
    expect(await api.getProfile(ref)).toMatchObject({ raceName: '', faction: null });
  });

  it('returns the character’s avatar URL, or null when Blizzard has none', async () => {
    const { api, calls } = client([
      on('/tarren-mill/birkibj%C3%B6rn/character-media', () => json({ assets: [{ key: 'avatar', value: 'https://render/a.jpg' }, { key: 'main-raw', value: 'https://render/m.png' }] })),
      on('/tarren-mill/nobody/character-media', () => new Response('', { status: 404 })),
    ]);
    expect(await api.getCharacterMedia(ref)).toBe('https://render/a.jpg');
    expect(calls.find((c) => c.url.includes('character-media'))!.url).toContain('namespace=profile-eu');
    expect(await api.getCharacterMedia({ ...ref, name: 'Nobody' })).toBeNull();
  });

  it('returns a class icon URL, or null when the class has none', async () => {
    const { api } = client([
      on('/media/playable-class/11', () => json({ assets: [{ key: 'icon', value: 'https://render/druid.jpg' }] })),
      on('/media/playable-class/99', () => new Response('', { status: 404 })),
    ]);
    expect(await api.getClassIconUrl('eu', 11)).toBe('https://render/druid.jpg');
    expect(await api.getClassIconUrl('eu', 99)).toBeNull();
  });
```

In `src/core/sync/character-sync.test.ts`:
- Replace the `profile` constant with `const profile: CharacterProfile = { name: 'Testchar', realmId: 1, realmSlug: 'test-realm', realmName: 'Test Realm', className: 'Druid', specName: 'Feral', raceName: 'Troll', faction: 'HORDE' };`
- In `fakeBlizzard`, add `getCharacterMedia: async () => 'https://render/avatar.jpg',` and `getClassIconUrl: async () => null,` to the `client` object, after `getItemDetails`.

Run: `npx vitest run src/core/blizzard`
Expected: FAIL, because the profile lacks race and faction, and `getCharacterMedia` and `getClassIconUrl` don't exist.

- [ ] **Step 3: Implement the client changes**

In `src/core/blizzard/client.ts`:
- Change the types import to include `Faction`: `import { SLOT_TYPES, type Faction, type GearItem, type Quality, type Region, type SlotType } from '../types';`
- Replace the `CharacterProfile` interface:

```ts
export interface CharacterProfile {
  name: string;
  realmId: number;
  realmSlug: string;
  realmName: string;
  className: string;
  specName: string;
  raceName: string;
  faction: Faction | null;
}
```

- Add to `RawProfile`, after `active_spec`:

```ts
  race?: { name: string };
  faction?: { type: string };
```

- Add to the `BlizzardClient` interface, after `getEquipment`:

```ts
  getCharacterMedia(ref: CharacterRef): Promise<string | null>;
  getClassIconUrl(region: Region, classId: number): Promise<string | null>;
```

- In `getProfile`, replace `specName: raw.active_spec?.name ?? '',` with:

```ts
        specName: raw.active_spec?.name ?? '',
        raceName: raw.race?.name ?? '',
        faction: raw.faction?.type === 'HORDE' || raw.faction?.type === 'ALLIANCE' ? raw.faction.type : null,
```

- Add a helper above `return {` that reads one media asset, returning `null` on 404:

```ts
  async function mediaAsset(region: Region, path: string, namespace: Namespace, key: string): Promise<string | null> {
    try {
      const media = await api<{ assets?: { key: string; value: string }[] }>(region, path, namespace);
      return media.assets?.find((asset) => asset.key === key)?.value ?? null;
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return null;
      throw err;
    }
  }
```

- Add to the returned object, after `getEquipment`:

```ts
    getCharacterMedia(ref) {
      return mediaAsset(ref.region, `${characterPath(ref)}/character-media`, 'profile', 'avatar');
    },

    getClassIconUrl(region, classId) {
      return mediaAsset(region, `/data/wow/media/playable-class/${classId}`, 'static', 'icon');
    },
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/core && npm run typecheck`
Expected: all pass. The `views.test.ts` and `add-character.test.ts` fakes are cast with `as unknown as BlizzardClient`, so they don't need the new methods.

- [ ] **Step 5: Commit**

```bash
git add src/core
git commit -m "feat: read race, faction, avatars and class icons from Blizzard"
```

---

### Task 2: Schema and queries for identity data

**Files:**
- Modify: `src/core/db/schema.ts`, `src/core/db/queries.ts`
- Test: `src/core/db/queries.test.ts`
- Create: a drizzle migration

**Interfaces:**
- Produces:
  - `characters` gains `race: string | null`, `faction: Faction | null`, `avatarUrl: string | null`
  - Table `classMedia`: `className` (primary key), `classId`, `iconUrl`, `fetchedAt`
  - `upsertClassIcons(db, entries: { className: string; classId: number; iconUrl: string | null }[], now)`
  - `getClassIconMap(db): Promise<Map<string, string | null>>`

- [ ] **Step 1: Update the schema and generate a migration**

In `src/core/db/schema.ts`:
- Add `Faction` to the types import.
- Add to the `characters` table, after `specName`:

```ts
  race: text('race'),
  faction: text('faction').$type<Faction>(),
  avatarUrl: text('avatar_url'),
```

- Add below `itemDetails`:

```ts
export const classMedia = sqliteTable('class_media', {
  className: text('class_name').primaryKey(),
  classId: integer('class_id').notNull(),
  iconUrl: text('icon_url'),
  fetchedAt: integer('fetched_at').notNull(),
});
```

Run: `npm run db:generate -- --name character-identity`
Expected: a new migration that adds three columns to `characters` and creates `class_media`.

- [ ] **Step 2: Write the failing tests**

In `src/core/db/queries.test.ts`, add `getClassIconMap, upsertClassIcons` to the import from `./queries`, then add inside `describe('tracks, meta and icons', ...)`:

```ts
  it('stores class icons by class name', async () => {
    const db = await openTestDb();
    await upsertClassIcons(db, [{ className: 'Druid', classId: 11, iconUrl: 'https://i/druid.jpg' }, { className: 'Monk', classId: 10, iconUrl: null }], 1);
    await upsertClassIcons(db, [{ className: 'Druid', classId: 11, iconUrl: 'https://i/druid2.jpg' }], 2);
    expect(await getClassIconMap(db)).toEqual(new Map([['Druid', 'https://i/druid2.jpg'], ['Monk', null]]));
  });
```

Add inside `describe('characters', ...)`:

```ts
  it('stores race, faction and avatar', async () => {
    const db = await openTestDb();
    const { id } = await insertCharacter(db, newCharacter, 1);
    expect(await getCharacter(db, id)).toMatchObject({ race: null, faction: null, avatarUrl: null });
    await updateCharacter(db, id, { race: 'Troll', faction: 'HORDE', avatarUrl: 'https://render/a.jpg' });
    expect(await getCharacter(db, id)).toMatchObject({ race: 'Troll', faction: 'HORDE', avatarUrl: 'https://render/a.jpg' });
  });
```

Run: `npx vitest run src/core/db`
Expected: FAIL, because `upsertClassIcons` and `getClassIconMap` don't exist.

- [ ] **Step 3: Implement the queries**

In `src/core/db/queries.ts`, add `classMedia` to the import from `./schema`, then add after `getItemDetailsMap`:

```ts
export async function upsertClassIcons(db: Db, entries: { className: string; classId: number; iconUrl: string | null }[], now: number) {
  await withWriteLock(db, async () => {
    for (const entry of entries) {
      await db.insert(classMedia).values({ ...entry, fetchedAt: now })
        .onConflictDoUpdate({ target: classMedia.className, set: { classId: entry.classId, iconUrl: entry.iconUrl, fetchedAt: now } });
    }
  });
}

export async function getClassIconMap(db: Db): Promise<Map<string, string | null>> {
  const rows = await db.select().from(classMedia);
  return new Map(rows.map((r) => [r.className, r.iconUrl]));
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/db drizzle
git commit -m "feat: store race, faction and avatar on characters, and cache class icons"
```

---

### Task 3: Sync race, faction and avatar

**Files:**
- Modify: `src/core/sync/character-sync.ts`
- Test: `src/core/sync/character-sync.test.ts`

**Interfaces:**
- Consumes: `getCharacterMedia`, `CharacterProfile.raceName` and `.faction` (Task 1). The character columns (Task 2).
- Produces: every successful sync stores race, faction and avatar URL. A failed or empty media call keeps the stored avatar.

- [ ] **Step 1: Write the failing tests**

In `src/core/sync/character-sync.test.ts`, add before `it('throws for an unknown character ID', ...)`:

```ts
  it('saves race, faction and avatar with the profile', async () => {
    const { db, id, syncer } = await setup();
    await syncer.sync(id);
    expect(await getCharacter(db, id)).toMatchObject({ race: 'Troll', faction: 'HORDE', avatarUrl: 'https://render/avatar.jpg' });
  });

  it('keeps the stored avatar and still syncs gear when the avatar fetch fails', async () => {
    let mediaFails = false;
    const { db, id, syncer, advance } = await setup({
      getCharacterMedia: async () => { if (mediaFails) throw new Error('media down'); return 'https://render/avatar.jpg'; },
    });
    await syncer.sync(id);
    mediaFails = true;
    advance(6 * 60 * 1000);
    expect(await syncer.sync(id)).toBe('unchanged');
    expect(await getCharacter(db, id)).toMatchObject({ avatarUrl: 'https://render/avatar.jpg', lastSyncError: null });
  });

  it('keeps the stored avatar when Blizzard has none', async () => {
    let avatar: string | null = 'https://render/avatar.jpg';
    const { db, id, syncer, advance } = await setup({ getCharacterMedia: async () => avatar });
    await syncer.sync(id);
    avatar = null;
    advance(6 * 60 * 1000);
    await syncer.sync(id);
    expect((await getCharacter(db, id))?.avatarUrl).toBe('https://render/avatar.jpg');
  });
```

Run: `npx vitest run src/core/sync/character-sync.test.ts`
Expected: FAIL, because the syncer doesn't store race, faction or avatar.

- [ ] **Step 2: Implement the sync changes**

In `src/core/sync/character-sync.ts`:
- Replace `let profile, gear;` with:

```ts
    // The avatar is nice to have: a failed or empty media call never fails the sync.
    const media = blizzard.getCharacterMedia(ref).catch(() => null);
    let profile, gear;
```

- Replace the `updateCharacter(db, characterId, { ... })` call after `saveSnapshotIfChanged` with:

```ts
    const avatarUrl = await media;
    await updateCharacter(db, characterId, {
      className: profile.className,
      specName: profile.specName || character.specName,
      race: profile.raceName || character.race,
      faction: profile.faction ?? character.faction,
      avatarUrl: avatarUrl ?? character.avatarUrl,
      status: 'ok',
      lastSyncedAt: time,
      lastSyncError: null,
    });
```

- [ ] **Step 3: Run the tests to see them pass**

Run: `npx vitest run src && npm run typecheck`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/core/sync
git commit -m "feat: sync race, faction and avatar, keeping the old avatar on failure"
```

---

### Task 4: Class icon cache

**Files:**
- Modify: `src/core/sync/reference-sync.ts`
- Test: `src/core/sync/reference-sync.test.ts`

**Interfaces:**
- Consumes: `getClasses`, `getClassIconUrl` (Task 1). `upsertClassIcons`, `getClassIconMap` (Task 2). `getMeta`, `setMeta`.
- Produces: `ensureClassIcons(deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region): Promise<Map<string, string | null>>`, refreshed at most every 30 days.

- [ ] **Step 1: Write the failing tests**

In `src/core/sync/reference-sync.test.ts`, add `ensureClassIcons` to the import from `./reference-sync`, then add at the end:

```ts
describe('ensureClassIcons', () => {
  function blizzardWith(fail = false) {
    const calls = { classes: 0 };
    const blizzard = {
      getClasses: async () => { calls.classes++; if (fail) throw new Error('down'); return [{ id: 11, name: 'Druid', specs: [] }, { id: 10, name: 'Monk', specs: [] }]; },
      getClassIconUrl: async (_region: string, id: number) => (id === 11 ? 'https://i/druid.jpg' : null),
    } as unknown as BlizzardClient;
    return { blizzard, calls };
  }

  it('fills the cache and serves it for 30 days', async () => {
    const db = await openTestDb();
    const { blizzard, calls } = blizzardWith();
    expect(await ensureClassIcons({ db, blizzard, now: 1 }, 'eu')).toEqual(new Map([['Druid', 'https://i/druid.jpg'], ['Monk', null]]));
    await ensureClassIcons({ db, blizzard, now: 1 + 29 * DAY_MS }, 'eu');
    expect(calls.classes).toBe(1);
    await ensureClassIcons({ db, blizzard, now: 1 + 30 * DAY_MS }, 'eu');
    expect(calls.classes).toBe(2);
  });

  it('keeps the cache when Blizzard fails', async () => {
    const db = await openTestDb();
    await ensureClassIcons({ db, blizzard: blizzardWith().blizzard, now: 1 }, 'eu');
    const icons = await ensureClassIcons({ db, blizzard: blizzardWith(true).blizzard, now: 1 + 31 * DAY_MS }, 'eu');
    expect(icons.get('Druid')).toBe('https://i/druid.jpg');
  });
});
```

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: FAIL, because `ensureClassIcons` doesn't exist.

- [ ] **Step 2: Implement the cache**

In `src/core/sync/reference-sync.ts`, add `getClassIconMap, upsertClassIcons` to the queries import, then add at the end of the file:

```ts
const CLASS_ICONS_META_KEY = 'classIcons.v1.fetchedAt';
const CLASS_ICONS_TTL_MS = 30 * DAY_MS;

/** Class icons change rarely: refresh every 30 days, and keep the cache when Blizzard fails. */
export async function ensureClassIcons(
  deps: { db: Db; blizzard: BlizzardClient; now: number }, region: Region,
): Promise<Map<string, string | null>> {
  const { db, blizzard, now } = deps;
  const fetchedAt = await getMeta(db, CLASS_ICONS_META_KEY);
  if (!fetchedAt || now - fetchedAt.updatedAt >= CLASS_ICONS_TTL_MS) {
    try {
      const classes = await blizzard.getClasses(region);
      const entries = await Promise.all(classes.map(async (cls) => ({
        className: cls.name,
        classId: cls.id,
        iconUrl: await blizzard.getClassIconUrl(region, cls.id).catch(() => null),
      })));
      await upsertClassIcons(db, entries, now);
      await setMeta(db, CLASS_ICONS_META_KEY, String(now), now);
    } catch {
      // Keep the cached icons. Anything without an icon falls back to the class-colored initial.
    }
  }
  return getClassIconMap(db);
}
```

- [ ] **Step 3: Run the tests to see them pass**

Run: `npx vitest run src && npm run typecheck`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/core/sync
git commit -m "feat: cache class icons for 30 days"
```

---

### Task 5: Identity line and view models

**Files:**
- Create: `src/core/characters/identity.ts`
- Modify: `src/server/views.ts`
- Test: `src/core/characters/identity.test.ts`, `src/server/views.test.ts`

**Interfaces:**
- Consumes: `ensureClassIcons` (Task 4), the character columns (Task 2).
- Produces:
  - `identityLine(race: string | null, spec: string, className: string): string`
  - `CharacterSummary` gains `race: string | null`, `faction: Faction | null`, `avatarUrl: string | null`, `classIconUrl: string | null`, `identity: string`

- [ ] **Step 1: Write the failing tests**

`src/core/characters/identity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { identityLine } from './identity';

describe('identityLine', () => {
  it('joins race, spec and class', () => {
    expect(identityLine('Troll', 'Guardian', 'Druid')).toBe('Troll Guardian Druid');
  });

  it('skips missing parts', () => {
    expect(identityLine(null, 'Guardian', 'Druid')).toBe('Guardian Druid');
    expect(identityLine('', '', 'Druid')).toBe('Druid');
  });
});
```

In `src/server/views.test.ts`:
1. Change the queries import to `import { gearToSnapshotItems, insertCharacter, saveSnapshotIfChanged, updateCharacter } from '@/core/db/queries';`
2. In `services()`, add to the `blizzard` object, after `getClasses`: `getClassIconUrl: async (_r: string, id: number) => \`https://i/class-${id}.jpg\`,`
3. Add at the end of the file:

```ts
describe('identity', () => {
  it('shows race, spec and class, the avatar and the class icon', async () => {
    const s = await services();
    const id = await seed(s);
    let page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ identity: 'Guardian Druid', race: null, faction: null, avatarUrl: null, classIconUrl: 'https://i/class-11.jpg' });

    await updateCharacter(s.db, id, { race: 'Troll', faction: 'HORDE', avatarUrl: 'https://render/a.jpg', specOverride: 'Feral' });
    page = await getCharacterPage(s, id);
    expect(page).toMatchObject({ identity: 'Troll Feral Druid', faction: 'HORDE', avatarUrl: 'https://render/a.jpg' });

    const [card] = await getCharacterCards(s);
    expect(card).toMatchObject({ identity: 'Troll Feral Druid', avatarUrl: 'https://render/a.jpg', classIconUrl: 'https://i/class-11.jpg' });
  });
});
```

Run: `npx vitest run src/core/characters src/server`
Expected: FAIL, because `./identity` doesn't exist and the views lack the new fields.

- [ ] **Step 2: Implement the identity line**

`src/core/characters/identity.ts`:

```ts
/** "Troll Guardian Druid", the way the Armory names a character. Missing parts are skipped. */
export function identityLine(race: string | null, spec: string, className: string): string {
  return [race, spec, className].filter(Boolean).join(' ');
}
```

- [ ] **Step 3: Update the view models**

In `src/server/views.ts`:
- Add imports: `import { identityLine } from '@/core/characters/identity';`, add `ensureClassIcons` to the `@/core/sync/reference-sync` import, and add `type Faction` to the `@/core/types` import.
- Replace the line `  sourceAt: number | null;` in `CharacterSummary` with:

```ts
  sourceAt: number | null;
  race: string | null;
  faction: Faction | null;
  avatarUrl: string | null;
  /** Fallback when there's no avatar. */
  classIconUrl: string | null;
  /** Race, spec and class, for example "Troll Guardian Druid". */
  identity: string;
```

- Replace `function summarize(c: CharacterRow, snapshot: Snapshot | null): CharacterSummary {` and its body with:

```ts
function summarize(c: CharacterRow, snapshot: Snapshot | null, classIcons: ReadonlyMap<string, string | null> = new Map()): CharacterSummary {
  const spec = c.specOverride || c.specName;
  return {
    id: c.id, name: c.name, realmName: c.realmName, region: c.region, className: c.className,
    activeSpec: c.specName, spec, specSlug: methodSpecSlug(spec, c.className),
    status: c.status, lastSyncedAt: c.lastSyncedAt, lastSyncError: c.lastSyncError, priorityList: c.priorityList,
    snapshot: snapshot && { source: snapshot.source, createdAt: snapshot.createdAt },
    sourceAt: !snapshot ? null : snapshot.source === 'simc' ? snapshot.createdAt : c.lastSyncedAt ?? snapshot.createdAt,
    race: c.race,
    faction: c.faction,
    avatarUrl: c.avatarUrl,
    classIconUrl: classIcons.get(c.className) ?? null,
    identity: identityLine(c.race, spec, c.className),
  };
}
```

- In `getCharacterCards`:
  - Replace `const { db, bisSource, fetchRaidbots, now } = services;` with `const { db, blizzard, bisSource, fetchRaidbots, now } = services;`
  - Replace these two lines:

```ts
  const bisBySlug = new Map<string, Promise<BisResult>>();
  const characters = await listCharacters(db);
```

  with:

```ts
  const characters = await listCharacters(db);
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, characters[0]?.region ?? 'eu');
  const bisBySlug = new Map<string, Promise<BisResult>>();
```

  - Replace `const summary = summarize(c, gear.current);` with `const summary = summarize(c, gear.current, classIcons);`
- In `getCharacterPage`:
  - Replace `const specs = await specsPromise;` with:

```ts
  const specs = await specsPromise;
  const classIcons = await ensureClassIcons({ db, blizzard, now: time }, character.region);
```

  - In the returned object, replace `    ...summary,` with `    ...summary,\n    classIconUrl: classIcons.get(character.className) ?? null,`

Class names come from Blizzard's `en_GB` locale in every region, so one cache serves all regions.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/characters src/server
git commit -m "feat: add race, faction, avatar and class icon to the view models"
```

---

### Task 6: Avatar and faction components on the character page and cards

**Files:**
- Create: `src/components/CharacterAvatar.tsx`, `src/components/FactionBadge.tsx`
- Modify: `src/app/characters/[id]/page.tsx`, `src/components/CharacterCard.tsx`
- Test: `src/components/identity-components.test.ts`

**Interfaces:**
- Consumes: the view model fields from Task 5.
- Produces:
  - `<CharacterAvatar name className avatarUrl classIconUrl size />`
  - `<FactionBadge faction size? />`, and `FACTION_TEXT: Record<Faction, { label: string; color: string }>`

- [ ] **Step 1: Write the failing tests**

`src/components/identity-components.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CharacterAvatar } from './CharacterAvatar';
import { FactionBadge } from './FactionBadge';

// React 19 hoists <link rel="preload"> tags for images ahead of the markup.
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<link[^>]*\/>/g, '');
const base = { name: 'Testbear', className: 'Druid', size: 52 };

describe('CharacterAvatar', () => {
  it('shows the avatar in a class-colored ring', () => {
    const html = render(createElement(CharacterAvatar, { ...base, avatarUrl: 'https://render/a.jpg', classIconUrl: 'https://i/druid.jpg' }));
    expect(html).toContain('src="https://render/a.jpg"');
    expect(html).toContain('border-color:#FF7C0A');
  });

  it('falls back to the class icon, then to the initial', () => {
    expect(render(createElement(CharacterAvatar, { ...base, avatarUrl: null, classIconUrl: 'https://i/druid.jpg' }))).toContain('src="https://i/druid.jpg"');
    const initial = render(createElement(CharacterAvatar, { ...base, avatarUrl: null, classIconUrl: null }));
    expect(initial).not.toContain('<img');
    expect(initial).toContain('>T</span>');
  });
});

describe('FactionBadge', () => {
  it('names the faction in its title and hides the shape from screen readers', () => {
    const html = render(createElement(FactionBadge, { faction: 'HORDE' }));
    expect(html).toContain('title="Horde"');
    expect(html).toContain('aria-hidden="true"');
    expect(render(createElement(FactionBadge, { faction: 'ALLIANCE' }))).toContain('title="Alliance"');
  });
});
```

Run: `npx vitest run src/components`
Expected: FAIL, because the components don't exist.

- [ ] **Step 2: Write the components**

`src/components/CharacterAvatar.tsx`:

```tsx
import { classColor } from './class-colors';

interface Props {
  name: string;
  className: string;
  avatarUrl: string | null;
  classIconUrl: string | null;
  size: number;
}

/** The avatar in a class-colored ring. Falls back to the class icon, then to the class-colored initial. Decorative: the name is always shown beside it. */
export function CharacterAvatar({ name, className, avatarUrl, classIconUrl, size }: Props) {
  const color = classColor(className);
  const src = avatarUrl ?? classIconUrl;
  if (src) {
    return (
      <img src={src} alt="" width={size} height={size}
        className="shrink-0 rounded-full border-2 bg-bg object-cover" style={{ width: size, height: size, borderColor: color }} />
    );
  }
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-full border-2 bg-bg font-bold"
      style={{ width: size, height: size, borderColor: color, color, fontSize: Math.round(size * 0.4) }}>{name.charAt(0)}</span>
  );
}
```

`src/components/FactionBadge.tsx`:

```tsx
import type { Faction } from '@/core/types';

const BADGE: Record<Faction, { label: string; bg: string; fg: string }> = {
  HORDE: { label: 'Horde', bg: '#7a1414', fg: '#f0b2a0' },
  ALLIANCE: { label: 'Alliance', bg: '#153a7a', fg: '#e7c46a' },
};

/** Faction name and a text color with enough contrast on the dark surfaces. */
export const FACTION_TEXT: Record<Faction, { label: string; color: string }> = {
  HORDE: { label: 'Horde', color: '#e8836b' },
  ALLIANCE: { label: 'Alliance', color: '#7fa8f0' },
};

/** A small shield in faction colors. Decorative: always pair it with the faction name in text. */
export function FactionBadge({ faction, size = 20 }: { faction: Faction; size?: number }) {
  const badge = BADGE[faction];
  return (
    <span title={badge.label} aria-hidden="true"
      className="flex items-center justify-center rounded-full border-2 border-surface-2" style={{ width: size, height: size, background: badge.bg }}>
      <svg width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} viewBox="0 0 24 24" fill={badge.fg}>
        <path d="M12 2l8 3.5v6.5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5.5z" />
      </svg>
    </span>
  );
}
```

Run: `npx vitest run src/components`
Expected: PASS.

- [ ] **Step 3: Use them on the character page and the cards**

In `src/app/characters/[id]/page.tsx`:
- Add `import { CharacterAvatar } from '@/components/CharacterAvatar';`
- Replace:

```tsx
          <span className="flex size-16 items-center justify-center rounded-full border-2 bg-bg text-2xl font-bold" style={{ borderColor: color, color }}>
            {view.name.charAt(0)}
          </span>
```

  with:

```tsx
          <CharacterAvatar name={view.name} className={view.className} avatarUrl={view.avatarUrl} classIconUrl={view.classIconUrl} size={76} />
```

- Replace `<span className="font-semibold" style={{ color }}>{view.spec} {view.className}</span>` with `<span className="font-semibold" style={{ color }}>{view.identity}</span>`.

In `src/components/CharacterCard.tsx`:
- Add `import { CharacterAvatar } from './CharacterAvatar';`
- Replace:

```tsx
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full border-2 bg-bg text-xl font-bold" style={{ borderColor: color, color }}>
          {card.name.charAt(0)}
        </span>
```

  with:

```tsx
        <CharacterAvatar name={card.name} className={card.className} avatarUrl={card.avatarUrl} classIconUrl={card.classIconUrl} size={52} />
```

- Replace `<span className="text-[15px] font-semibold" style={{ color }}>{card.spec} {card.className}</span>` with `<span className="text-[15px] font-semibold" style={{ color }}>{card.identity}</span>`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 5: Commit**

```bash
git add src/components "src/app/characters"
git commit -m "feat: show avatars and race on the character page and cards"
```

---

### Task 7: Class icons and faction badges in search results

**Files:**
- Modify: `src/core/raiderio/search.ts`, `src/app/api/search/route.ts`, `src/components/AddCharacterBar.tsx`
- Test: `src/core/raiderio/search.test.ts`

**Interfaces:**
- Consumes: `ensureClassIcons` (Task 4), `FactionBadge`, `FACTION_TEXT`, `CharacterAvatar` (Task 6), `getServices`.
- Produces:
  - `CharacterSearchResult` gains `faction: Faction | null`
  - `GET /api/search` results gain `classIconUrl: string | null`

- [ ] **Step 1: Write the failing tests**

In `src/core/raiderio/search.test.ts`:
- In the first `matches` entry of `response`, add `faction: 'horde',` to `data`.
- In the first test's expected result, add `faction: 'HORDE'` after `className: 'Druid',`.
- Add:

```ts
  it('leaves the faction empty when Raider.IO has none or an unknown one', async () => {
    const odd = { matches: [{ type: 'character', data: { name: 'Testbear', region: { slug: 'eu' }, realm: { name: 'X', wowRealmId: 1 }, class: { name: 'Druid' }, faction: 'neutral' } }] };
    const { fn } = fakeFetch([on('raider.io/api/search', () => json(odd))]);
    expect((await searchCharacters(fn, 'eu', 'Testbear'))[0]?.faction).toBeNull();
  });
```

Run: `npx vitest run src/core/raiderio`
Expected: FAIL, because results have no `faction`.

- [ ] **Step 2: Add faction to search results**

In `src/core/raiderio/search.ts`:
- Change the types import to `import type { Faction, Region } from '../types';`
- Add `faction: Faction | null;` to `CharacterSearchResult`, after `className`.
- Add `faction?: string;` to `RawSearch`'s `data`, after `class`.
- In the `.map(...)` result, add after `className`:

```ts
      faction: m.data!.faction === 'horde' ? 'HORDE' : m.data!.faction === 'alliance' ? 'ALLIANCE' : null,
```

Run: `npx vitest run src/core/raiderio`
Expected: PASS.

- [ ] **Step 3: Add class icons in the search route**

Replace `src/app/api/search/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { searchCharacters, type CharacterSearchResult } from '@/core/raiderio/search';
import { ensureClassIcons } from '@/core/sync/reference-sync';
import { parseRegion } from '@/server/route-helpers';
import { getServices } from '@/server/services';

export async function GET(request: NextRequest) {
  const region = parseRegion(request.nextUrl.searchParams.get('region'));
  if (!region) return NextResponse.json({ error: 'Unknown region' }, { status: 400 });

  let results: CharacterSearchResult[];
  try {
    results = await searchCharacters(fetch, region, request.nextUrl.searchParams.get('term') ?? '');
  } catch {
    return NextResponse.json({ error: 'Search is unavailable. Pick the realm yourself.' }, { status: 502 });
  }

  // Class icons are a nice to have: without them, results show the class-colored initial.
  let icons = new Map<string, string | null>();
  try {
    const services = await getServices();
    icons = await ensureClassIcons({ db: services.db, blizzard: services.blizzard, now: services.now() }, region);
  } catch {
    // Keep the empty map.
  }
  return NextResponse.json(results.map((r) => ({ ...r, classIconUrl: icons.get(r.className) ?? null })));
}
```

- [ ] **Step 4: Show them in the add bar**

In `src/components/AddCharacterBar.tsx`:
- Add imports:

```tsx
import type { Faction } from '@/core/types';
import { CharacterAvatar } from './CharacterAvatar';
import { FACTION_TEXT, FactionBadge } from './FactionBadge';
```

- Replace `interface Result { name: string; realmName: string; blizzardRealmId: number; className: string }` with:

```tsx
interface Result {
  name: string;
  realmName: string;
  blizzardRealmId: number;
  className: string;
  faction: Faction | null;
  classIconUrl: string | null;
}
```

- Replace these two lines inside the result button:

```tsx
                  <span className="grow text-[17px]"><strong className="font-semibold">{r.name}</strong><span className="text-muted"> - {r.realmName}</span></span>
                  <span className="text-sm font-semibold" style={{ color: classColor(r.className) }}>{r.className}</span>
```

  with:

```tsx
                  <span className="relative shrink-0">
                    {r.classIconUrl
                      ? <img src={r.classIconUrl} alt="" width={40} height={40} className="size-10 rounded-lg border-2" style={{ borderColor: classColor(r.className) }} />
                      : <CharacterAvatar name={r.name} className={r.className} avatarUrl={null} classIconUrl={null} size={40} />}
                    {r.faction && <span className="absolute -bottom-1.5 -right-1.5"><FactionBadge faction={r.faction} /></span>}
                  </span>
                  <span className="grow text-[17px]"><strong className="font-semibold">{r.name}</strong><span className="text-muted"> - {r.realmName}</span></span>
                  <span className="flex flex-col items-end">
                    <span className="text-sm font-semibold" style={{ color: classColor(r.className) }}>{r.className}</span>
                    {r.faction && <span className="text-xs font-semibold" style={{ color: FACTION_TEXT[r.faction].color }}>{FACTION_TEXT[r.faction].label}</span>}
                  </span>
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 6: Check it in the browser**

Restart `npm run dev`, because the running server opened its database before this branch's migration. Then:

1. Open your druid's page. Before a sync, it shows the class icon and "Guardian Druid".
2. Select **Refresh**. The page shows the avatar and "Troll Guardian Druid".
3. The characters page card shows the same avatar and identity line.
4. Search for a name in the add bar. Each result shows its class icon with a faction badge, and class and faction in text.

- [ ] **Step 7: Commit**

```bash
git add src/core/raiderio src/app/api/search src/components/AddCharacterBar.tsx
git commit -m "feat: show class icons and faction badges in search results"
```
