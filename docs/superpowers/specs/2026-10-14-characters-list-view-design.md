# Characters overview: grid or list view

Status: written unattended under the approved work loop; the owner reviews the open-question answers in the pull request.
Date: 2026-10-14
Issues: #150

## Goal

The Characters page (`src/app/(home)/page.tsx`) shows tracked characters only as a card grid. Add a list view, one compact row per character, and a control to switch between the two. The choice is remembered.

## Scope

In scope: the list row, its skeleton, the toggle, remembering the choice, and the pieces the card and row share.

Out of scope:

- Any schema change, migration, new view field or loader change. `getCharacterCards` (`src/server/views/character-cards.ts`) already gives everything a row shows.
- Sorting or filtering the list.
- A list view on the group page.
- Reading the choice in `loading.tsx`. The loading fallback is prefetched and must not read cookies (see Next's `loading.md`, "Good to know"), so it keeps the card-grid skeleton in both views. The real page replaces it as soon as it streams.

## Open questions answered

**What a list row shows.** One row per character, holding what decides "who needs what" at a glance:

- Avatar at 40 px, without the class badge (smaller avatars are too small for one, as the item card polish spec decided).
- Name as the link to the character page, with `LinkPending`, in class color.
- One line under it: identity in class color, then realm and item level in muted text (`Guardian Druid · Argent Dawn · 642.3 ilvl`).
- The progress block: list label (`Mythic+ BiS`), the count (`5 / 16`), the segmented bar, and the summary text. Same loading, `bisError` and `notFound` states as the card.
- Sync and track errors, same text as the card.
- The source line (`SimC, pasted 2h ago`) and the remove button.

Dropped from the row: the crest chips and the crest text. They are upgrade detail; the character page has them, and they would double the row's height.

**Where the toggle sits.** Right end of the legend row, above the characters, so it sits next to what it changes. It shows only when at least one character is tracked; with none there is nothing to lay out.

**Remembered across visits.** Yes, in a cookie, `characters-view`, `grid` or `list`, for a year. A cookie, not `localStorage`, so the server renders the chosen view on the first paint with no flash. Anything other than `list` reads as `grid`, the default.

**Add-character skeleton and empty state in list view.** The skeleton for a character being added is a row of the same shape, with the name and "Adding <name>…" where the source line goes, as the card skeleton does. The empty state is the same text in both views, and the toggle is hidden there.

## Design

**Shared pieces.** The row and the card show the same bar and source line, so both move out of `CharacterCard`:

- `src/components/bis-bar/BisBar.tsx`: the segmented bar, taking the `barSegments` result. Same markup and `aria-hidden` as today.
- `src/components/shared/source-text.ts`: `sourceText(card, now)`, the "SimC, pasted …" / "Blizzard, synced …" / "Not synced yet" string, with unit tests.
- `bis-summary.ts` and `CardProgressSkeleton` stay in `character-card/`; the row imports `bisSummary` and `barSegments` from there. If that import crosses directories, `bis-summary.ts` moves to `shared/` instead (AGENTS.md "Splitting code": a helper several components use lives in `shared/`). The plan settles which.

**List row.** `src/components/character-row/CharacterRow.tsx`, a server component taking `{ card, now }` like `CharacterCard`. An `<article>`, `rounded-xl border border-line bg-surface px-4 py-3`:

- Below `md`, the identity, progress and footer blocks stack (`flex-col gap-3`), so a phone gets a short card.
- From `md`, one line (`md:flex-row md:items-center md:gap-6`): identity block at a fixed `md:w-72` and `shrink-0`, the progress block `grow` with `min-w-0`, then the source text and the remove button at the end. The source text is right-aligned in a fixed `md:w-44` so the remove buttons line up.
- Errors (`tracksError`, `lastSyncError`) render under the bar inside the progress block, so they don't add a column.

`CharacterRowSkeleton` sits in the same directory with an optional `name`, matching `CharacterCardSkeleton`'s behavior: no `role="status"` of its own, and "Adding <name>…" in the source slot when named.

**Grid wrapper.** `CharacterGrid` gains `view: CharactersView`. `grid` keeps today's classes and `CharacterCardSkeleton`; `list` uses `flex flex-col gap-3` and `CharacterRowSkeleton`. The empty branch is unchanged.

**Toggle.** `src/components/view-toggle/ViewToggle.tsx`, a client component taking `{ view }`:

- A `fieldset` with an `sr-only` legend "Layout", holding two radio labels, "Grid" and "List", each with a small icon beside the word. It reuses `SourcePicker`'s segmented look at a smaller height (`h-9`), with the checked option in `bg-gold-soft text-gold ring-gold-line`. Color is not the only signal: the checked radio is the control's state, and both options have words.
- Choosing an option sets local state at once, writes the cookie (`path=/; max-age=31536000; SameSite=Lax`, as `RememberGroup` does) and calls `router.refresh()` inside `startTransition`.
- `src/components/view-toggle/characters-view.ts` holds `CHARACTERS_VIEW_COOKIE`, the `CharactersView` type and `parseCharactersView(value?: string)`, with unit tests.

**Page.** `src/app/(home)/page.tsx` reads the cookie with `cookies()`, parses it, and passes `view` to `CharacterGrid` and `ViewToggle`. It renders `CharacterRow` or `CharacterCard` per card. The legend and toggle share one row: `flex flex-wrap items-center justify-between gap-4`.

No route handler: the cookie is a display preference the browser sets, and nothing writes on the server.

## Testing

Markup tests with `renderToStaticMarkup`, as the card's tests do:

- `characters-view.test.ts`: `list` reads as `list`; `grid`, `undefined` and junk read as `grid`.
- `source-text.test.ts`: the three source strings.
- `CharacterRow.test.ts`: name link to `card.href`, identity, realm and ilvl on one line, list label and count, bar segments, summary text, no crest chips; `notFound`, `bisError` and loading states as on the card; errors shown; the remove button present. The skeleton: shapes and no status without a name; the name and "Adding Birkibjörn…" with one.
- `CharacterGrid.test.ts`: `view="list"` uses the list classes and, while adding, the row skeleton; `view="grid"` keeps today's output.
- `ViewToggle.test.ts`: two radios named "Grid" and "List", the given view checked, an `sr-only` legend.
- Existing `CharacterCard` tests stay green after the bar and source move out.

By hand at 375, 768 and 1440 px: toggle switches the layout, the choice survives a reload, the rows line up their remove buttons from `md`, a phone row stacks without horizontal scroll, and adding a character in list view shows the named row skeleton.
