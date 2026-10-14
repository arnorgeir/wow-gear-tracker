# Dungeon page: bosses and loot

Status: written for the unattended loop on 2026-10-14; the owner reviews it with the pull request.
Date: 2026-10-14
Issues: #5 (part of #45)

## Goal

A page per season dungeon that lists its bosses and everything each boss drops. Plan 3a already stores both (`season_dungeons`, `dungeon_loot`), so this is a read-only page over existing data.

## Scope

In scope:

- A new page, `/dungeons/[id]`, for one season dungeon: its art and name, then each boss with its loot.
- A link to that page from each dungeon row on the character page and the group page.

Out of scope:

- The season overview (#46), the map, guide links and keystone.guru routes (#47), and Mythic+ statistics (#4).
- Boss tactics, abilities or descriptions. A separate research thread looks at sources for those.
- Any schema change, migration, cache version bump or new sync. The page reads what the season sync already stores.
- A nav tab. #46 adds the overview, which is where a tab would point.
- Which half of a split dungeon a boss belongs to. Blizzard's journal doesn't say (see `AGENTS.md`, "Season loot joins by map ID").

## Route

`/dungeons/[id]`, where `id` is the dungeon's challenge mode ID, for example `/dungeons/503`.

- The ID is the key every view already carries (`DungeonPriorityView.challengeModeId`, `GroupDungeonView.challengeModeId`), so the links need no new field and no slug rules. A name-based slug would read better but needs normalization (apostrophes, colons, accents) and a lookup by name; that can come with #46 if the owner wants it.
- An `id` that isn't a positive integer, or that the stored season doesn't list, is `notFound()`. A season change makes old IDs 404, which is right: the dungeon is no longer in the season.
- The page is `force-dynamic`, like the character page, and handles `MissingConfigError` with `SetupNotice` the same way.
- It never writes. It doesn't start a season sync either: the only links to it come from rows that exist because the season is loaded.

## Data

New query in `src/core/db/queries/season.ts`:

```ts
/** One stored season dungeon with its loot rows in boss order, or null when the season doesn't list it. */
export async function getSeasonDungeon(db: Db, challengeModeId: number):
  Promise<{ dungeon: SeasonDungeonRow; split: boolean; loot: DungeonLootRow[] } | null>
```

- `split` uses the same rule as `getSeasonLoot`: another stored dungeon shares its `journalInstanceId`.
- Loot is ordered by `encounterId`, then `itemId`, as `getSeasonLoot` orders it. Journal encounter IDs rise in boss order within an instance in practice, but the API doesn't promise it, and the sync doesn't store the journal's own order. Storing it would need a column and a season cache bump, so it stays out of this change; if a dungeon shows bosses out of order, that is the follow-up.
- Reads run in sequence, not in parallel (`AGENTS.md`, "In-memory test databases have one connection").

New loader `src/server/views/dungeon-page.ts`, `getDungeonPage(services, challengeModeId): Promise<DungeonPageView | null>`:

- Groups loot by encounter, keeping first-seen order, into `bosses: { encounterId; name; items: DungeonLootItemView[] }[]`.
- Each item: `itemId`, `name`, `quality` (stored quality, else `'EPIC'`, since season dungeon loot is epic in Mythic+), `iconUrl` from `getItemIcons` (null when not cached yet; the season sync caches loot icons in the background), `inventoryType`, `armorType`, and `stats` (decoded `secondaryStats`, or null).
- The view carries `name`, `shortName`, `imageUrl` and `split` from the dungeon row.
- Types go in `src/server/views/types.ts`.

## Page

`src/app/dungeons/[id]/page.tsx` stays thin: parse the ID, load the view, render `DungeonPage`.

`src/components/dungeon-page/DungeonPage.tsx` (server component):

- Header: `DungeonThumbnail` (reused) and the dungeon name as `h1` in `font-display`.
- When `split`, the existing `SPLIT_DUNGEON` copy under the header, so it reads the same as on the priority rows.
- One `section` per boss, labeled by an `h2` with the boss name, holding a list of `ItemCard`s in a responsive grid (one column on phones, up to three on wide screens). `ItemCard` is reused unchanged: the whole card is the Wowhead link.
- Card detail line: armor type and slot, as the item search already writes it ("Leather wrist", "Trinket"). That formatting moves out of `src/components/item-search/result-detail.ts` into `src/components/shared/item-kind.ts` as `itemKind(item)`, and `resultDetail` calls it, so both read the same.
- Card stats line: `statPairLabel(stats)` when stats are known, else none.
- A boss with no stored items doesn't appear: the sync stores only loot rows, so it can't happen today.

## Links from dungeon rows

`DungeonDisclosure` gains a required `challengeModeId` prop and renders a `Link` to `/dungeons/<id>` as the last line of its open body, reading "Bosses and loot". It sits in the body, not the `<summary>`, so a click on the summary still only toggles the row. `DungeonPriority` and `DungeonRow` pass the ID they already have.

## Testing

- `season.test.ts` (or the existing season query tests): `getSeasonDungeon` returns the dungeon, its loot in `encounterId` order, `split` true for two dungeons sharing an instance and false otherwise, and null for an unknown ID.
- `dungeon-page.test.ts`: groups items under their boss in order, falls back to `'EPIC'` for null quality, carries cached icons and null for uncached ones, decodes stats, and returns null for an unknown ID. Real in-memory SQLite through `openTestDb()`.
- `item-kind.test.ts`: armor and slot ("Leather wrist"), slot alone ("Trinket"), an unknown inventory type falls back to its lowercased words, null inventory type gives null. Existing `resultDetail` tests keep passing.
- `DungeonPage` markup test: an `h1` with the name, an `h2` per boss in order, a Wowhead link per item, the split note only when `split`.
- `DungeonDisclosure.test.ts`: the body holds a link to `/dungeons/<id>` reading "Bosses and loot", outside the `<summary>`.
- Gate: typecheck, lint, test and build.
- By hand (owner or Claude with the local DB): open a dungeon from the group page at 375 and 1440 px; boss order looks right; Wowhead tooltips show on hover; a split dungeon shows the note; `/dungeons/1` and `/dungeons/abc` show the 404 page.
