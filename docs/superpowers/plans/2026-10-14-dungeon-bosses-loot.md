# Dungeon page: bosses and loot — plan

Spec: `docs/superpowers/specs/2026-10-14-dungeon-bosses-loot-design.md` (the authority). Issue #5.
Branch: `feat/dungeon-bosses-loot`. TDD each task: failing test first, then code. One commit per task, `feat:` subjects.

## Task 1: `getSeasonDungeon` query

- `src/core/db/queries/season.ts`: add `getSeasonDungeon(db, challengeModeId)`. Read the dungeon row, then the season's other rows for `split` (same `journalInstanceId`), then its loot ordered by ``sql`rowid` ``. Sequential reads. Return `{ dungeon, split, loot }` or null.
- Tests beside the existing season query tests (create `season.test.ts` if none): insertion order kept when a later boss has a lower encounter ID; `split` true/false; null for unknown ID.

## Task 2: `itemKind` shared helper

- Move `SLOT_NAMES` and the armor+slot formatting from `src/components/item-search/result-detail.ts` to `src/components/shared/item-kind.ts` as `itemKind({ armorType, inventoryType }): string | null` ("Leather wrist", "Trinket", unknown type lowercased with `_` as spaces, null type gives null). `resultDetail` calls it; its tests stay green.
- `item-kind.test.ts` covers the four cases.

## Task 3: `getDungeonPage` loader and view types

- `src/server/views/types.ts`: `DungeonPageView { challengeModeId; name; shortName; imageUrl; split; bosses: DungeonBossView[] }`, `DungeonBossView { encounterId; name; items: DungeonLootItemView[] }`, `DungeonLootItemView { itemId; name; quality: Quality; iconUrl: string | null; inventoryType; armorType; stats: string[] | null }`.
- `src/server/views/dungeon-page.ts`: `getDungeonPage(services, id)` uses `getSeasonDungeon`, groups by encounter in first-seen order, `getItemIcons` for icons, `quality ?? 'EPIC'`, `decodeStats`, empty list becomes null.
- `dungeon-page.test.ts` with `openTestDb()`: grouping and order, EPIC fallback, cached vs uncached icon, stats null/[]/pair, null for unknown ID.

## Task 4: page and `DungeonPage` component

- `src/components/dungeon-page/DungeonPage.tsx` per spec "Page": `DungeonThumbnail`, `h1`, `SPLIT_DUNGEON` when split, a `section` + `h2` per boss, grid `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` of `ItemCard` with `bonusIds={[]}`, `itemLevel={null}`, `detail={itemKind(item) ?? undefined}`, `stats` only when non-empty via `statPairLabel`.
- `src/app/dungeons/[id]/page.tsx`: `force-dynamic`, `await params`, `parseId` then `notFound()`, `getServices()` with `MissingConfigError` → `SetupNotice` as the character page does, loader null → `notFound()`. Main wrapper classes as the character page.
- `DungeonPage.test.ts` markup test (same style as other component tests): `h1`, `h2`s in order, a Wowhead link per item, split note only when split, no stats line for an item without stats.

## Task 5: links from dungeon rows

- `DungeonDisclosure`: required `challengeModeId`; last body line `<Link href={`/dungeons/${id}`}>Bosses and loot<span className="sr-only">: {name}</span></Link>`, `text-sm`. Update `DungeonDisclosure.test.ts`, `DungeonPriority.tsx`, `DungeonRow.tsx`.
- `nothingFrom` becomes `{ challengeModeId: number; name: string }[]` in `types.ts`, `character-page.ts`, `group-page.ts` and their tests.
- `src/components/dungeon-links/DungeonLinks.tsx`: renders the comma-separated links; used by `DungeonPriority` and `GroupPriority`. Markup test.

## Gate

`npm run typecheck && npm run lint && npm test && npm run build` in the worktree (its own `.next`, so building is safe).
