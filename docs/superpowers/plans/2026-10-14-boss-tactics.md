# Boss tactics — plan

Spec: `docs/superpowers/specs/2026-10-14-boss-tactics-design.md` (the authority). Issue #155.
Branch: `feat/boss-tactics`, stacked on `feat/dungeon-bosses-loot` (PR #156). TDD each task. One commit per task, `feat:` subjects unless noted.

## Task 1: parse the journal tree

- `src/core/types.ts`: `JournalSection`.
- `src/core/blizzard/parse.ts` + `types.ts`: `RawJournalEncounter` gains `description?`, `sections?`; `JournalEncounter` gains `description`, `sections`. Recursive parse with sibling dedupe (title + spellId), null for empty body, skip untitled nodes, non-numeric spell ID gives null.
- Tests in `parse.test.ts` (or the existing blizzard parse tests) with made-up boss text.

## Task 2: markup

- `src/core/journal/markup.ts`: `parseJournalText`, `spellIndex`, types `JournalInline`, `JournalBlock`. `markup.test.ts` per spec.

## Task 3: store encounters at season sync

- `schema.ts`: `dungeonEncounters`. Run `npm run db:generate -- --name dungeon_encounters`. Never hand-edit the migration.
- `season.ts`: `SeasonData.encounters?`; `replaceSeason` deletes/inserts `dungeon_encounters` in its transaction (delete before `seasonDungeons` is fine, no FK). `getSeasonDungeon` returns `encounters` map for loot encounter IDs; malformed JSON counts as missing.
- `season-sync.ts`: `loadSeasonLoot` fills `encounters` from the fetched map. `SEASON_META_KEY = 'season.v6'`, comment names the new table. Update the test asserting `season.v5`.
- `AGENTS.md` database rule: name `dungeon_encounters` beside `season_dungeons` and `dungeon_loot`.
- Tests: sync stores one row per distinct encounter (split halves share), resync replaces; query returns map, malformed JSON missing.

## Task 4: view

- `src/server/views/types.ts`: `BossTacticsView`, `AbilityView`; `DungeonBossView.tactics`.
- `dungeon-page.ts`: build tactics per spec "View and page" using `spellIndex` + `parseJournalText`. Tests per spec.

## Task 5: component

- `src/components/dungeon-page/BossTactics.tsx` per spec; `DungeonPage` renders it after each boss's loot grid, only when `tactics` is non-null. Markup tests per spec. Text only through JSX text nodes, never `dangerouslySetInnerHTML`.

## Gate

`npm run typecheck && npm run lint && npm test && npm run build` in the worktree.
