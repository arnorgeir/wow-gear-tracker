# Dungeon loot: who wants each item — plan

Spec: `docs/superpowers/specs/2026-10-17-dungeon-loot-needs-design.md` (the authority). Issue #184. Branch `feat/dungeon-loot-needs`. TDD each task, one commit per task, `feat:` subjects unless noted.

## Task 1: per-drop needs and BiS matcher (core, pure)

- Export the shared rules from `src/core/priority/rank.ts` (`fitsSlot`, the missing/wrong-stats row selection, `FIT`), or move them to a small shared module; `rankDungeons` behavior and its tests unchanged.
- `src/core/priority/drop-needs.ts`: `needsByDrop(characters, loot)` and `bisMatches(list rows, targets, statsMatter, armor, loot)`. Tests in `drop-needs.test.ts` per spec "Testing".

## Task 2: loader

- `src/server/views/types.ts`: `neededBy`, `bisFor` on loot item views; `coverage` on `DungeonPageView`.
- `src/server/views/dungeon-page.ts`: load characters (sequential, `exclusionReason`), `needsByDrop`, configured specs with `choosePriorityList`, `bisMatches`. `ponytail:` note. Tests per spec.

## Task 3: filter state

- `guide-state.ts`: `show: 'wanted' | 'all'`, hrefs keep it. Tests.

## Task 4: view toggle reuse

- `ViewToggle` takes `cookie` and `name` props; characters page passes its own. A `dungeon-loot-view` cookie parser beside `characters-view.ts` (or generalize that parser). Tests.

## Task 5: loot tab UI

- `LootCard` (grid) and list rows in `src/components/dungeon-page/`, the Wanted / All drops switch with count, coverage messages, empty states, `<details>` overflow, need words in a tested `.ts` helper. Loot route reads the cookie. Update `DungeonPage.test.ts` per spec.

## Gate

`npm run typecheck && npm run lint && npm test && npm run build` in the worktree.
