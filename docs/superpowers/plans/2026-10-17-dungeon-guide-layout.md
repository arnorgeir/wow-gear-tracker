# Dungeon guide layout — plan

Spec: `docs/superpowers/specs/2026-10-17-dungeon-guide-layout-design.md` (the authority; data and markup rules stay with `2026-10-14-boss-tactics-design.md`). PR #159, branch `feat/boss-tactics`. TDD each task, one commit per task, `feat:` subjects.

## Task 1: guide state

- `src/components/dungeon-page/guide-state.ts`: `parseGuideState(raw, bossIds)` → `{ boss: number | null; tab: 'overview' | 'abilities' | 'loot' }`, and `guideHref(dungeonId, state)` building `/dungeons/<id>?boss=…&tab=…` (omit defaults). Fallbacks per spec "Routes and state". Tests per spec.

## Task 2: header and nav

- `MainNav` gains Dungeons. Header switch `sm` → `lg` in `src/app/layout.tsx`, `src/components/shared/nav-tab.ts`, `MainNav`, `AccountNav`. Update `MainNav.test.ts` (Dungeons item, active on `/dungeons/585`) and any test asserting `sm:` classes.

## Task 3: `/dungeons` list

- `src/server/views/dungeon-list.ts` `getDungeonList(services)` reading stored season dungeons (no loot); types in `views/types.ts`. `src/components/dungeon-list/DungeonList.tsx` cards (art + name, link) and the no-season line. `src/app/dungeons/page.tsx` thin, `force-dynamic`, `MissingConfigError` → `SetupNotice` as `[id]/page.tsx`. Tests per spec.

## Task 4: guide layout

- `src/app/dungeons/[id]/page.tsx` awaits `searchParams`, parses with `parseGuideState`, passes state to `DungeonPage`.
- Split `DungeonPage` per spec "Components": `Breadcrumb`, `BossIndex`, `GuideTabs`, `OverviewTab`, `LootTab`, and `BossTactics` reshaped into overview (roles as open `<details>`) and abilities (summary name rule) parts. Split note above the spread. Dungeon loot detail adds ", <boss>". Narrow layout per spec. Tokens only, no new hex; add a token in `globals.css` if one is truly missing.
- Update `DungeonPage.test.ts` and `BossTactics` tests per spec "Testing".

## Gate

`npm run typecheck && npm run lint && npm test && npm run build` in the worktree.
