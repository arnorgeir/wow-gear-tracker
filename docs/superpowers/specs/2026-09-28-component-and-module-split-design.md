# Splitting components and modules by job

Status: awaiting approval
Date: 2026-09-28

## Why

The rules in `AGENTS.md` now say a file does one job, a component becomes a directory once it has parts, and a hook holds client state rather than logic. The code predates those rules. Nothing in it is broken, but five components each hand-roll the same call-then-refresh cycle, four modules have grown past one job, and three pure functions with real branching sit inside `.tsx` files where they can't be tested.

This brings the existing code up to the written rules in one sweep, so there is one convention in the repo instead of two.

## What success looks like

- Every rule in the `Splitting code` section of `AGENTS.md` holds for the code as it stands, not only for new code.
- The duplicated fetch-then-refresh logic exists once.
- Three pure functions that currently have no tests have them: the crest line, the SimC import message, and the Wowhead data attribute.
- No behavior changes. The app does what it does today, with the same markup and the same requests.
- `npm run typecheck && npm run lint && npm test` and `npm run build` stay clean throughout.

## Non-goals

- No new features, no visual changes, no copy changes.
- No change to the database schema, so no migration.
- No feature-slice restructure. `src/core` is already organized by domain and stays that way.
- No test framework additions. Components still have no browser-level test setup, and this work does not add one.

## Decisions

**1. Directories only where there are parts.** Of the fifteen components, four qualify — `AddCharacterBar`, `CharacterCard`, `ItemCard` and `SimcPaste` — and eleven stay single files. A twenty-line badge never earns a directory, so `StateBadge`, `SetupNotice`, `UpgradeBadge`, `WowheadRefresh`, `CrestSummary`, `RefreshButton`, `RemoveCharacterButton`, `StaleSync`, `CharacterAvatar`, `FactionBadge` and `CharacterSettings` are untouched except for import paths.

A fifth directory, `character-page/`, is different in kind: it collects sections extracted from the 171-line page, which are new components rather than an existing one growing parts.

`class-colors.ts` and `row-tone.ts` stay at the root of `src/components`, since several components and directories use them. They are already the pattern this work spreads.

**2. Shared hooks live in `src/components/hooks/`.** A hook used by five components is not a part of any one of them. Hooks used by a single component live in that component's directory.

**3. `useApiAction` covers the three components that fit, and no more.** `RefreshButton`, `RemoveCharacterButton` and `CharacterSettings` are the same shape: call a route, track busy, refresh. `SimcPaste` uses the hook but formats its own message from the parsed response. `StaleSync` does not use it at all — it is a mount effect firing parallel requests, not a user action, and forcing it through the hook would distort both. Resisting that is the point of the decision.

**4. Direct imports, not barrels.** Only five files import `db/queries` and four import `server/views`, so updating them is cheaper and clearer than an `index.ts` that re-exports everything and hides the seams. Function names and signatures do not change; only import paths do.

This contradicts the letter of one line in `AGENTS.md` — "keeping the same public surface, so importers don't change." The intent of that line is that the API stays stable, not that the path must. The final PR amends it to say so, since a rule the code knowingly violates is worse than no rule.

**5. Pure mappers come out of the Blizzard client.** The raw-profile-to-`CharacterProfile` mapping is pure and currently reachable only through a fake `fetch`. Extracted, it tests directly.

## PR 1: the shared action hook

The only part of this work that touches behavior paths, so it goes first and alone.

New: `src/components/hooks/use-api-action.ts` — owns `busy`, the request, the parsed JSON response, the `UserError` message from a failed response, and the `router.refresh()` or `router.push()` that follows.

| Component | Today | After |
|---|---|---|
| `RefreshButton` | own `busy` + fetch + refresh | `useApiAction` |
| `RemoveCharacterButton` | own `busy` + confirm + fetch + push/refresh | `useApiAction`, keeps its own `window.confirm` |
| `CharacterSettings` | own `patch` + refresh | `useApiAction` |
| `SimcPaste` | own `busy`, message state, fetch | `useApiAction` + its own message formatting |
| `StaleSync` | mount effect, parallel requests | unchanged |

Tests: `use-api-action.test.ts` covers the success path, a failed response carrying a `UserError` message, a network rejection, and that `refresh` is called once on success and not on failure. The four components have no automated tests today and get none here; the risk is stated in the PR description and checked by hand on the dev server.

## PR 2: component directories

Four directories, each holding the component, its parts and their tests.

**`src/components/add-character/`** — `AddCharacterBar.tsx` keeps the layout, region select and realm fallback. `SearchResults.tsx` takes the listbox, including the result avatar and its faction badge. `use-character-search.ts` takes the term, region, debounce, the manual fallback, the realm fetch and the outside-click and Escape handling. `field-classes.ts` takes the shared input, select and label class strings, which `CharacterSettings` currently duplicates.

**`src/components/character-card/`** — `CharacterCard.tsx` keeps the markup. `crest-line.ts` takes `crestLine`, whose four branches have no test today. `crest-line.test.ts` covers crests missing, no crests, none affordable, and one versus several upgrades ready.

**`src/components/item-card/`** — `ItemCard.tsx`, `EmptySlotCard.tsx`, `quality-styles.ts` for the quality table, and `wowhead.ts` for `wowheadData`. The existing `ItemCard.test.ts` moves in and keeps passing.

**`src/components/character-page/`** — sections lifted out of the 171-line page: `CharacterHeader.tsx`, `ListTabs.tsx`, `GearTable.tsx` with `BisTarget.tsx`, and `VaultSection.tsx`. The page becomes composition, matching the thin-pages rule.

**`src/components/simc-paste/`** — `SimcPaste.tsx` plus `import-message.ts` for the imported-counts and nothing-changed branches, with tests.

Tests: three new pure-function test files, written before the extraction and watched to fail. Everything else is a move, where `typecheck` catches a broken import and `build` catches a broken page.

## PR 3: backend modules

`src/core/db/queries.ts` (250 lines) becomes `src/core/db/queries/`:

| Module | Holds |
|---|---|
| `write-lock.ts` | `withWriteLock` and its comment, now exported inside the directory |
| `characters.ts` | `CharacterRow`, `NewCharacter`, `nameKeyOf`, insert, list, get, update, delete |
| `snapshots.ts` | snapshot types, `gearToSnapshotItems`, `hashSnapshot`, `latestSnapshotRow`, `saveSnapshotIfChanged`, `getLatestSnapshot`, `equippedGear` |
| `bis-lists.ts` | `replaceBisLists`, `getBisLists` |
| `tracks.ts` | `replaceTracks`, `getTrackMap`, `replaceBonusQualities`, `getBonusQualityMap` |
| `meta.ts` | `getMeta`, `setMeta` |
| `media.ts` | item icons, item details and class icons |

`src/server/views.ts` (246 lines) becomes `src/server/views/` with `types.ts` for the `*View` types, `summarize.ts` for `summarize` and `loadGear`, `item-view.ts` for `itemView`, `character-cards.ts` and `character-page.ts`.

`src/core/blizzard/client.ts` (204 lines) becomes `src/core/blizzard/` with `types.ts`, `token.ts` for the access-token cache, `parse.ts` for the pure raw-response mappers, and `client.ts` for the endpoint calls.

Tests: `parse.test.ts` is new and covers the profile mapping directly, including a missing faction and a missing spec. `queries.test.ts` splits to follow its modules. Every existing test keeps passing unchanged otherwise, since no signature moves.

Also in this PR: the one-line `AGENTS.md` amendment from decision 4.

## Risks

**The untested components in PR 1.** Four components change how they track state, with nothing automated asserting their behavior. Mitigated by keeping PR 1 small and separate, by testing the hook directly, and by a hand check of each of the five interactions on the dev server, listed in the PR description.

**Import churn.** PR 2 and PR 3 touch many import paths. `typecheck` catches every broken one, which is why the moves ride in PRs with no logic changes.

**Review size.** PR 3 is the largest. It is mechanical, and the table above lets a reviewer check placement without reading each line.

## Sequence

PR 1, then PR 2, then PR 3, each merged before the next starts, so a regression has a small diff to bisect. Branches: `chore/use-api-action`, `chore/component-directories`, `chore/split-backend-modules`.
