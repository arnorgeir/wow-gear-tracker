# Minor polish batch: BiS settings, tier stats and character cards

Status: recommendations pre-approved by the owner on 2026-10-13 ("I pre-approve your recommended suggestions"). Pending spec review.
Date: 2026-10-13
Issues: #135, #136, #137, #138, #142

## Goal

Five small issues, each fixable in a few files, batched into one spec, one plan and one pull request with one commit series per issue. Each section below answers its issue's open questions with the recommended choice.

## Scope

In scope: the five changes below.

Out of scope:

- Any schema change or migration. None is needed.
- A new `ItemState`. #138 is solved with wording on the existing state (see below).
- The character page header (#142's second question): it has a 76 px portrait and room for four lines, so it stays as it is.

## #135 Fetch and Refresh buttons the same size

**Problem.** `FetchButton` (`src/components/spec-picker/FetchButton.tsx`) sizes to its label, so a "Fetch" row and a "Refresh" row in the same class card have different widths. Its busy label "Fetching…" is wider again, so a button grows while it runs.

**Design.** The button variant (not the `link` variant) gets a fixed minimum width that fits the widest label it can show, "Fetching…", plus a centered label: `min-w-[6.5rem] justify-center` with `inline-flex items-center`. Every size (`sm`, `md`, `lg`) uses the same width, so every FetchButton on the BiS settings pages and the spec editor header has one width. The width is a measured value; if "Fetching…" overflows at `text-sm` in the browser check, raise it.

**Testing.** A markup test (`renderToStaticMarkup`) that the button carries the min-width class for both labels and that the link variant doesn't. By hand at 375 and 1440 px: the BiS settings page's buttons line up in one column, and a button keeps its width while it shows "Fetching…".

## #136 Override item search: loading state, icon and rarity

**Problem.** In `src/components/item-search/`:

1. Nothing visible shows while a search runs. The only status is a screen-reader-only "Searching…", set only after the 250 ms debounce.
2. Results show an empty box: `ItemChoice` has no icon URL.
3. Results take their color from the item's base quality. Blizzard's item API gives base quality, and dungeon loot's base quality is Rare, so a Mythic+ item shows blue. The rest of the app shows a BiS pick as Epic (`bisView` in `src/server/views/member.ts` hardcodes `'EPIC'`).

**Open question answered: where the quality comes from.** From the base quality, raised to what a BiS pick drops as. One pure function in `src/core/bis/pick-quality.ts`:

```ts
/** The quality a BiS pick shows: Epic, unless its base quality is already above Epic. Base quality is what Blizzard's item API gives, and dungeon loot is Rare there. */
export const pickQuality = (base: Quality | null): Quality => (base === 'LEGENDARY' || base === 'ARTIFACT' ? base : 'EPIC');
```

It is used by the search results and the chosen-item card in `ItemSearch.tsx` (replacing `item.quality ?? 'EPIC'`), and by the two places in `src/server/views/settings-spec.ts` that show an override's item (`catalog.get(...)?.quality ?? 'EPIC'` and `item?.quality ?? 'EPIC'`), so an override in the editor matches its search result. `CatalogItem.quality` keeps the base quality as stored; only display changes.

**Icons.**

- `ItemChoice` gains `iconUrl: string | null`.
- The search route is a `GET` and must not write (`AGENTS.md`, "Errors and HTTP"), so `searchItems` only reads cached icons with `getItemIcons`. Items with no cached icon keep the empty box.
- To make the cache hold the season's loot, the season sync caches icons for every loot item: after `replaceSeason` in the "loaded" branch and after `updateSeasonArtwork` in the "current" branch of `runSync` (`src/core/sync/season-sync.ts`), call `ensureItemIcons` from `src/core/sync/reference-sync.ts` with the loot item IDs. It skips IDs already cached and swallows each item's failure; the Blizzard client already caps parallel requests at 4. Running it in the "current" branch fills existing installs on their next daily season check. An icon failure never fails the season sync: the call sits after the meta write and is wrapped so its error is logged and ignored. No cache version bump: neither `season_dungeons` nor `dungeon_loot` gains a column.
- `lookupItem` (a `POST`) calls `ensureItemIcons` for the one item it returns, in the spec's region from `regionForSpec`, so a looked-up item shows its icon at once and keeps it in later searches.
- `ItemSearch.tsx` renders the icon inside the rarity ring the way `PickLine` (`src/components/bis-editor/PickLine.tsx`) does: `<img>` when `iconUrl` is set, the empty ring otherwise.

**Loading state.** Reuse the character search bar's indicator (`src/components/add-character-bar/AddCharacterBar.tsx`): a spinner and "Searching…" in a `role="status"` span that stays mounted, inside the input's right edge.

- Extract that markup into `src/components/searching-status/SearchingStatus.tsx`, `SearchingStatus({ searching, className })`, and use it in both search bars. The positioning classes differ per bar, so the caller passes them.
- `useItemSearch` reports `busy` from the moment the query changes, including the debounce, until its answer or error arrives: it stores the query its last answer was for and derives `busy` as `query !== answeredQuery` for a non-idle query. The pure part (`isSearching(query, answeredQuery)`, idle input is never searching) goes in `search-plan.ts` with tests.
- While a Blizzard lookup runs, the existing "Looking up item … on Blizzard…" line shows instead, and the spinner in the input hides, so only one status shows.

**Testing.** `pickQuality` unit tests (Rare and null give Epic, Legendary stays). `searchItems` returns a cached icon and `null` for an uncached one. `lookupItem` caches and returns the icon through the fake fetch. `runSync` caches loot icons in both branches and still reports "loaded" when every icon request fails. `isSearching` tests. Markup tests: a result with `iconUrl` renders an `<img>` in an Epic ring; `SearchingStatus` renders its text only while searching. By hand: search "hood" on a spec's editor; the spinner shows while typing, results show icons and purple names; a pasted item ID shows the Blizzard line, then the item with its icon.

## #137 Manual lists say where the pick was copied from

**Problem.** For a Manual source the slot column says "Copied pick" and the search label says "Replace the copied <slot> pick", without naming the source.

**Open question answered.** Name the source: the column says "Copied from Method", the search label says "Replace the <slot> pick copied from Method". When `copiedFrom` is null (no copy yet), the old wording stays.

**Design.** `pickColumn` and `replaceText` in `src/components/bis-editor/editor-text.ts` take `copiedFrom: FetchedSourceId | null` as a second argument, and their callers pass the view's `copiedFrom`, which the editor view already carries. Fetched sources are unchanged.

**Testing.** `editor-text.test.ts`: Manual with `copiedFrom: 'method'` gives the new wording, Manual with null gives the old, Method is unchanged.

## #138 Tier row with unknown stats says so

**Problem.** `compareStats` returns `unknown` when either side's stats are missing, and `stateFor` in `src/core/gear/evaluate.ts` only reacts to `different`, so such a row shows Done with nothing to say the stats weren't checked.

**Open question answered.** No new state. The row keeps the state its track gives (Done, Upgrade or Below Myth) and counts toward done as now: the stats are usually right and the next sync fills them, and a new state would touch every count, color and legend. It gets words instead: "Stats unverified".

**Design.**

- `evaluateGear` only compares stats when `statsMatter` is true; otherwise `GearRow.stats` is `null`. Nothing outside tests reads `stats` today, so this changes no behavior, and the doc comment says so.
- `GearRowView` (`src/server/views/types.ts`) gains `statsUnverified: boolean`, set by `rowView` in `src/server/views/member.ts` to `r.stats === 'unknown'`.
- `equippedStatText` (`src/components/shared/equipped-stats.ts`) returns `"Stats unverified"` when `statsUnverified` is true, after its existing tier-row and state checks. The character page's gear table and the group grid's cell details already show this text.
- `needText` (`src/components/group-grid/cell-note.ts`) returns `"Tier stats unverified"` for such a cell, so the grid shows it without opening the cell.

**Testing.** `evaluate` tests: unknown stats with `statsMatter` give `stats: 'unknown'` and state Done; with `statsMatter: false`, `stats` is null. `rowView` sets `statsUnverified`. `equippedStatText` and `needText` tests for the new wording, and that a known pair is unchanged. By hand: a character whose tier piece has no stats (for example a fresh SimC paste of a catalysed piece) shows "Stats unverified" on the character page and the group grid.

## #142 Character card identity in three lines

**Problem.** The card's identity block is four lines beside a 52 px portrait, and a long spec line wraps to a fifth.

**Open question answered.** Fewer lines, same portrait. Order: name; spec line; "<Realm> · <item level> ilvl". The spec line and the realm line both `truncate` instead of wrapping, so the block is always three lines or fewer. "642.3 ilvl" matches the group member header's wording. With no item level, the third line is the realm alone. The character page header doesn't change.

**Design.** `src/components/character-card/CharacterCard.tsx` only. The item level stays `font-mono`.

**Testing.** `CharacterCard.test.ts` markup: realm and "642.3 ilvl" share one line; no item level shows the realm alone and no "ilvl". By hand at 375, 1024 and 1440 px: the portrait sits level with a three-line block, and a long spec name truncates.
