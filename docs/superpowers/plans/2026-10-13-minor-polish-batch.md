# Minor Polish Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five small issues (#135, #136, #137, #138, #142) on one branch, one pull request, with each issue's commits standing on their own.

**Architecture:** No schema change, no migration, no cache version bump. Pure rules go in `.ts` files with unit tests (`src/core` for logic, a component's own directory for display rules). Components only wire them.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Vitest (`environment: 'node'`, markup tests through `renderToStaticMarkup`), in-memory SQLite through `openTestDb()`, fake fetch through `src/test/fake-fetch.ts`.

**Spec:** `docs/superpowers/specs/2026-10-13-minor-polish-batch-design.md`. The spec is the authority; read each issue's section before its task.

**Branch:** `feat/minor-polish-batch` (already exists, holds the spec and this plan). Rebase on `origin/main` before pushing if it moved.

## Global Constraints

- Failing test first, watch it fail, then code. One commit per task at least; subjects `feat:` or `fix:` lowercase imperative, terse why-body only when the subject doesn't say it. No AI attribution or mention anywhere. Use the repo's `commit` skill.
- `src/core` never imports `next`, `react` or `src/app|components|server`. Core code never calls `Date.now()` or global `fetch`.
- `GET` routes never write. Every DB write goes through `withWriteLock` (existing queries already do).
- Fixture names are made up (Birkibjörn style). No real players.
- Gate before the pull request: `npm run typecheck && npm run lint && npm test`, then `npm run build` in a separate git worktree with its own `npm ci` (never in the folder a dev server serves).

## Review Focus

1. **#138 equal-ID fallback.** A tier piece with null stats and the target's item ID must still be unverified (Task 4 tests).
2. **#138 no false "Needed".** `needText` unchanged; a `CellDetails` markup test pins that an unverified Done row has no "Needed" (Task 4).
3. **#136 GET stays read-only.** `searchItems` reads icons with `getItemIcons`, never `ensureItemIcons` (Task 6).
4. **#136 season sync never fails on icons.** A test where every icon request fails still gives `'loaded'` (Task 6).
5. **#136 status lifecycle.** answered A, pending B, back to A shows A's answer with no spinner and no request; a row change with the same query is busy (Task 7).

---

### Task 1: #135 Fetch and Refresh buttons share one width

**Files:** Modify `src/components/spec-picker/FetchButton.tsx`. Test: create `src/components/spec-picker/FetchButton.test.ts`.

- [ ] Test (markup): the button variant with label "Fetch" and with "Refresh" both carry `min-w-[6.5rem]` and `justify-center`; the `link` variant carries neither. Mock `next/navigation` as `CharacterCard.test.ts` does if `useApiAction` needs the router.
- [ ] Add `inline-flex items-center justify-center min-w-[6.5rem]` to the non-link class string only.
- [ ] Commit `fix: give fetch and refresh buttons one width` (body: closes the uneven column; width fits "Fetching…").

### Task 2: #137 Manual list names the copy's source

**Files:** Modify `src/components/bis-editor/editor-text.ts`, `BisEditor.tsx`, `SlotRow.tsx`. Test: `editor-text.test.ts`.

- [ ] Tests: `pickColumn('manual', 'method')` is `"Copied from Method"`; `pickColumn('manual', null)` is `"Copied pick"`; `pickColumn('method', null)` is `"Method's pick"`. `replaceText('manual', 'Head', 'method')` is `"Replace the Head pick copied from Method"`; with null it is `"Replace the copied Head pick"`; Method unchanged.
- [ ] Add a third/second parameter `copiedFrom: FetchedSourceId | null` (`pickColumn(source, copiedFrom)`, `replaceText(source, slotLabel, copiedFrom)`). Pass the view's `copiedFrom` from `BisEditor.tsx` and down to `SlotRow.tsx` (follow how `source` already reaches `SlotRow`).
- [ ] Commit `feat: name the source a manual pick was copied from`.

### Task 3: #142 Character card identity in three lines

**Files:** Modify `src/components/character-card/CharacterCard.tsx`. Test: `CharacterCard.test.ts`.

- [ ] Tests: with `itemLevel: 642.34`, the markup has one element containing both "Argent Dawn" and "642.3 ilvl" (assert on a regex across that one span, e.g. `/>Argent Dawn · <span class="font-mono">642.3<\/span> ilvl</`, adjusted to the final markup); with `itemLevel: null`, the realm shows and "ilvl" does not; "Item level" no longer appears.
- [ ] Markup: name link; identity span with `truncate`; then `<span className="truncate text-[15px] text-muted">{card.realmName}{card.itemLevel !== null && <> · <span className="font-mono">{card.itemLevel.toFixed(1)}</span> ilvl</>}</span>`.
- [ ] Commit `feat: fit character card identity in three lines`.

### Task 4: #138 Unverified tier stats say so

**Files:** Modify `src/core/gear/evaluate.ts`, `src/server/views/types.ts`, `src/server/views/member.ts`, `src/components/shared/equipped-stats.ts`, `src/components/group-grid/state-word.ts`, `src/components/group-grid/cell-label.ts`, `src/components/group-grid/GroupCell.tsx`. Tests beside each, plus `src/components/cell-details/CellDetails.test.ts`. Fix any test fixture that builds a `GearRow` or `GearRowView` by adding `statsUnverified: false`.

- [ ] `evaluate.test.ts`: a matched tier row on a full Myth track with stats on: (a) equipped stats null, same item ID as the target; (b) equipped stats null, different ID; (c) target stats missing, same ID; (d) target stats missing, different ID: each gives `statsUnverified: true` and state `done`. Known stats both sides: false. `statsMatter: false` with (a): false. A Missing tier row: false. A non-tier row: false.
- [ ] `GearRow.statsUnverified: boolean` = `statsMatter && matched && row.kind === 'item' && row.isTier && item !== null && (targets.get(row.itemId)?.secondaryStats == null || item.secondaryStats == null)`. Don't change `compareStats`, `stats` or `stateFor`.
- [ ] `GearRowView.statsUnverified: boolean`, copied in `rowView`. Test in the existing views tests where `rowView` output is checked.
- [ ] `equippedStatText`: after the existing early returns for non-tier and Missing/In bags, return `'Stats unverified'` when `row.statsUnverified` (before the `equippedStats === null` check). Widen its `Pick` to include `statsUnverified`. Tests: unverified gives the text even with null `equippedStats`; known pair unchanged.
- [ ] `stateWord(state, tierNeed, unverified = false)`: appends `?` to the word when `unverified`. `cellLabel`: appends `, stats unverified` after the state text when `cell.statsUnverified`. Tests for both.
- [ ] `GroupCell.tsx`: pass `cell.statsUnverified` to `stateWord`; add `cell.statsUnverified ? 'Tier stats unverified' : null` to the `hover` list.
- [ ] `CellDetails.test.ts`: an unverified Done tier cell renders "Stats unverified" and not "Needed".
- [ ] Commit `fix: say when tier stats could not be checked` (body: Done hid unchecked stats; equal item IDs prove nothing for catalysed pieces).

### Task 5: #136 Picks show Epic

**Files:** Create `src/core/bis/pick-quality.ts` and `pick-quality.test.ts`. Modify `src/components/item-search/ItemSearch.tsx`, `src/server/views/settings-spec.ts`.

- [ ] Tests: `RARE`, `UNCOMMON` and `null` give `EPIC`; `EPIC`, `LEGENDARY`, `ARTIFACT` keep their own.
- [ ] `pickQuality` as the spec gives it. Use it in `ItemSearch.tsx` (`ItemName`, `RarityBox`) and both override sites in `settings-spec.ts`. Extend a settings view test: an override of a `RARE` catalog item shows `EPIC`.
- [ ] Commit `fix: show dungeon loot picks as epic` (body: Blizzard gives base quality; dungeon loot is Rare there; BiS picks show Epic elsewhere).

### Task 6: #136 Search results carry icons

**Files:** Modify `src/core/bis/edits.ts` (+test), `src/core/sync/season-sync.ts` (+test), `src/app/api/items/lookup/route.ts` only if deps change, `src/components/item-search/ItemSearch.tsx` (+ a markup test `ItemSearch.test.ts` if feasible, else test the result row through an extracted `ResultIcon` file in the same directory).

- [ ] `edits.test.ts`: `searchItems` returns `iconUrl` from a cached `items` row and `null` when uncached, and performs no write (no Blizzard call through the fake fetch). `lookupItem` fetches the media endpoint through the fake fetch, returns `iconUrl`, and a second `searchItems` for it returns the cached URL.
- [ ] `ItemChoice` gains `iconUrl: string | null`. `choice()` takes the icon map. `searchItems` calls `getItemIcons(db, ids)` for the matched IDs. `lookupItem` calls `ensureItemIcons({ db, blizzard, now }, await regionForSpec(db, ref.specSlug), [itemId])`. Import `ensureItemIcons` from `../sync/reference-sync` (core sync module; check no import cycle; if one appears, move only `ensureItemIcons` usage behind a parameter rather than restructuring).
- [ ] `season-sync.test.ts`: after a "loaded" sync, every loot item has a cached icon; after a "current" sync on an install with uncached icons, they are cached; when every media request fails, the result is still `'loaded'` and the season meta is written.
- [ ] `runSync`: after `setMeta` in both branches, `await cacheLootIcons(...)`: reads the season's loot item IDs (an existing query or `select itemId from dungeon_loot`), calls `ensureItemIcons`, and catches and `console.error`s any throw.
- [ ] `ItemSearch.tsx`: render `<img src={iconUrl} …>` inside the ring when set, as `PickLine` does; keep the empty ring otherwise.
- [ ] Commit `feat: show item icons in override search` (body: GET search reads cached icons only; season sync and lookups fill the cache).

### Task 7: #136 Search shows it is searching

**Files:** Create `src/components/searching-status/SearchingStatus.tsx` (+ `SearchingStatus.test.ts`). Modify `src/components/add-character-bar/AddCharacterBar.tsx`, `src/components/item-search/search-plan.ts` (+test), `use-item-search.ts`, `ItemSearch.tsx`.

- [ ] `SearchingStatus({ searching, className })`: always-mounted `role="status"` span with the caller's classes; spinner and "Searching…" only while `searching`. Test both states. Swap the markup in `AddCharacterBar.tsx` for it with the same classes (no visual change).
- [ ] `search-plan.test.ts`: `searchKey(row, ' hood ')` equals `searchKey(row, 'hood')` and differs for another `slotKey`; `isSearching(key, answeredKey, idle)`: idle is never searching; equal keys are not; A answered then B typed is; back to A is not; same query, other row is.
- [ ] `useItemSearch`: state gains `key: string | null`. Every `setState` with an answer or error stores the effect's key. Derive `cached = key === state.key` (errors included: a failed key is retried only by changing the text); the effect returns early when `idle || cached` (add `cached` to deps). Test sequence in `search-plan.test.ts` covers a failed A too. When a lookup starts, set `{ ...IDLE, key: null, looking: id, lookingKey: key }`. Return `looking` only when `state.lookingKey === key`, and `busy: isSearching(key, state.key, idle)`. Test (pure helper or hook-free sequence in `search-plan.test.ts`): lookup pending, query changes to a new search (line hidden, busy) and to an earlier answered query (searches again). Drop the old `busy` writes that the derivation replaces.
- [ ] `ItemSearch.tsx`: wrap the input in a `relative` container and place `<SearchingStatus searching={busy && looking === null} className="pointer-events-none absolute inset-y-0 right-11 flex items-center gap-2 text-sm text-muted" />`; remove the old sr-only status. Keep the Blizzard lookup line.
- [ ] Commit `feat: show searching state in override search`.

### Task 8: Gate, pull request, review loop

- [ ] `npm run typecheck && npm run lint && npm test`; build in a separate worktree (`git worktree add ../wgt-build feat/minor-polish-batch`, `npm ci`, `npm run build`, remove the worktree).
- [ ] Push, open the PR per `AGENTS.md` (`Closes #135, closes #136, closes #137, closes #138, closes #142.`, What changes, Testing with counts and gaps, `Spec:` line). Move the issues to In review.
- [ ] Hand checks that need the browser and real data stay listed in Testing for the owner: #135 column alignment at 375/1440 px; #136 icons, purple names and spinner; #138 "Done?" on a real unverified piece; #142 card at 375/1024/1440 px.
- [ ] Run the `review-loop` skill.
