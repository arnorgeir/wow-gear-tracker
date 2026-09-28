# Splitting components and modules by job

Status: awaiting approval
Date: 2026-09-28

## Why

The rules in `AGENTS.md` now say every component lives in its own directory, a file does one job, and a hook holds client state rather than logic. The code predates those rules. Nothing in it is broken, but all fifteen components sit flat at the root of `src/components`, five of them hand-roll the same call-then-refresh cycle, four modules have grown past one job, and three pure functions with real branching sit inside `.tsx` files where nothing can test them.

This brings the existing code up to the written rules in one sweep, so there is one convention in the repo instead of two.

## What success looks like

- Every rule in the `Splitting code` section of `AGENTS.md` holds for the code as it stands, not only for new code.
- Every component lives in a kebab-case directory holding a PascalCase file.
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

**1. Every component gets a directory, with no threshold.** A kebab-case directory holding a PascalCase `.tsx` file: `src/components/state-badge/StateBadge.tsx`, imported as `@/components/state-badge/StateBadge`. A one-line badge gets a directory like everything else. The gain is that there is no judgement call to make and no argument to have when a component grows.

The one distinction that has to be drawn: **a component used by more than its own parent gets a top-level directory; a component used only by its parent is a file inside the parent's directory.** So `EmptySlotCard` becomes `empty-slot-card/EmptySlotCard.tsx`, because the character page imports it directly as well, while `SearchResults` is a file inside `add-character-bar/`, since nothing but that bar will ever render it. Without this line, "every component gets a directory" and "a directory holds its sub-components" contradict each other.

**2. Shared pieces sit outside the component directories.** `src/components/shared/` takes `class-colors.ts` and `row-tone.ts`, which several components use. `src/components/hooks/` takes hooks several components use. Anything used by exactly one component lives in that component's directory.

**3. `useApiAction` covers the components that fit, and no more.** `RefreshButton`, `RemoveCharacterButton` and `CharacterSettings` are the same shape: call a route, track busy, refresh. `SimcPaste` uses the hook but formats its own message from the parsed response. `StaleSync` does not use it at all — it is a mount effect firing parallel requests, not a user action, and forcing it through the hook would distort both. Resisting that is the point of the decision.

**4. Direct imports, not barrels.** Only five files import `db/queries` and four import `server/views`, so updating them is cheaper and clearer than an `index.ts` that re-exports everything and hides the seams. Function names and signatures do not change; only import paths do. `AGENTS.md` states this directly, so no rule is being bent.

**5. Pure mappers come out of the Blizzard client.** The raw-profile-to-`CharacterProfile` mapping is pure and currently reachable only through a fake `fetch`. Extracted, it tests directly.

## PR 1: the shared action hook

The only part of this work that touches behavior paths, so it goes first and alone, while the tree is still flat.

New: `src/components/hooks/use-api-action.ts` — owns `busy`, the request, the parsed JSON response, the `UserError` message from a failed response, and the `router.refresh()` or `router.push()` that follows.

| Component | Today | After |
|---|---|---|
| `RefreshButton` | own `busy` + fetch + refresh | `useApiAction` |
| `RemoveCharacterButton` | own `busy` + confirm + fetch + push/refresh | `useApiAction`, keeps its own `window.confirm` |
| `CharacterSettings` | own `patch` + refresh | `useApiAction` |
| `SimcPaste` | own `busy`, message state, fetch | `useApiAction` + its own message formatting |
| `StaleSync` | mount effect, parallel requests | unchanged |

Tests: `use-api-action.test.ts` covers the success path, a failed response carrying a `UserError` message, a network rejection, and that `refresh` is called once on success and not on failure. The four components have no automated tests today and get none here; the risk is stated in the PR description and checked by hand on the dev server.

## PR 2: the structural sweep

Everything mechanical lands together, as three commits in this order. They stay separate commits so a reviewer can read the moves apart from the extractions, and so a later bisect lands on one of the three rather than on the whole sweep. The pull request squash-merges as usual, so the description carries the same three headings.

### Commit 1: every component into a directory

A pure move. Fifteen components, fifteen directories, no logic touched — which is what makes a diff this wide safe to review quickly.

| Directory | File |
|---|---|
| `add-character-bar/` | `AddCharacterBar.tsx` |
| `character-avatar/` | `CharacterAvatar.tsx` |
| `character-card/` | `CharacterCard.tsx` |
| `character-settings/` | `CharacterSettings.tsx` |
| `crest-summary/` | `CrestSummary.tsx` |
| `faction-badge/` | `FactionBadge.tsx` |
| `item-card/` | `ItemCard.tsx` |
| `refresh-button/` | `RefreshButton.tsx` |
| `remove-character-button/` | `RemoveCharacterButton.tsx` |
| `setup-notice/` | `SetupNotice.tsx` |
| `simc-paste/` | `SimcPaste.tsx` |
| `stale-sync/` | `StaleSync.tsx` |
| `state-badge/` | `StateBadge.tsx` |
| `upgrade-badge/` | `UpgradeBadge.tsx` |
| `wowhead-refresh/` | `WowheadRefresh.tsx` |

Also: `class-colors.ts` and `row-tone.ts` move to `shared/` with their tests, and `ItemCard.test.ts` and `identity-components.test.ts` move beside the components they cover — the latter splitting to follow `character-avatar/` and `faction-badge/`.

Use `git mv` so history follows each file. Tests: no new ones. `typecheck` catches every broken import and `build` catches a broken page, which is the whole safety argument for keeping this PR free of logic changes.

### Commit 2: extractions inside the directories

Now that each component owns a directory, the parts move in beside it.

**`add-character-bar/`** — `SearchResults.tsx` takes the listbox, including the result avatar and its faction badge. `use-character-search.ts` takes the term, region, debounce, manual fallback, realm fetch, and the outside-click and Escape handling. `field-classes.ts` takes the input, select and label class strings that `character-settings/` currently duplicates; being shared, it lands in `shared/`.

**`character-card/`** — `crest-line.ts` takes `crestLine`, whose four branches have no test today, with `crest-line.test.ts` covering crests missing, no crests, none affordable, and one versus several upgrades ready.

**`item-card/`** — `quality-styles.ts` takes the quality table and `wowhead.ts` takes `wowheadData`, with the existing test following it. `EmptySlotCard` leaves for its own `empty-slot-card/` directory, since the character page imports it directly.

**`simc-paste/`** — `import-message.ts` takes the imported-counts and nothing-changed branches, with tests.

**`character-page/`** — the sections lifted out of the 171-line page: `CharacterHeader.tsx`, `ListTabs.tsx`, `GearTable.tsx`, `BisTarget.tsx` and `VaultSection.tsx`, as files in one directory. Each is used only by the page, and `BisTarget` only by `GearTable`, so by decision 1 they are files rather than directories of their own. This directory is a grouping for one route's sections rather than a component directory, since the parent component is the route file itself — the only place in the tree where that is true, and worth naming so it does not read as a mistake. The page becomes composition, matching the thin-pages rule.

Tests: three new pure-function test files, written before the extraction and watched to fail, plus the hook's. The sub-component moves are covered by `typecheck` and `build`, as in the commit before.

### Commit 3: backend modules

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

## Risks

**The untested components in PR 1.** Four components change how they track state, with nothing automated asserting their behavior. Mitigated by keeping PR 1 small and separate, by testing the hook directly, and by a hand check of each of the five interactions on the dev server, listed in the PR description.

**Import churn.** PR 2 rewrites every component import in the repo and every backend one. `typecheck` catches each broken path, which is why the commits that move files carry no logic changes.

**Review width.** PR 2 is wide, and its first commit is the widest and least interesting part: fifteen renames and their import updates. Two things keep it readable — the commit boundaries, so the moves can be read apart from the extractions, and the tables above, which let a reviewer confirm placement without opening each file. `git mv` keeps `git log --follow` working.

The reason this is a risk worth naming: mechanical hunks are the ones a reviewer's eye slides over, and the extraction commit is where a real mistake would hide. Reviewing PR 2 commit by commit rather than through the combined diff is the mitigation.

## Sequence

PR 1, merged, then PR 2. Branches: `chore/use-api-action`, then `chore/split-components-and-modules`.

PR 1 goes alone because it is the only behavior change in the work, and it lands on four components that have no automated tests. Everything in PR 2 is mechanical, so it carries no such risk and does not need the same isolation — splitting it further would buy review rounds rather than safety, since no one else is working in this repo and nothing is waiting on it.
