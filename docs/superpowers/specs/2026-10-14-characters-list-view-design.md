# Characters overview: grid or list view

Status: written unattended under the approved work loop; the owner reviews the open-question answers in the pull request. Spec review round 1 (Codex) folded in: S1.1 the row goes horizontal from `lg`, not `md`, with a column budget and a truncation rule; S1.2 the toggle's selection is `useOptimistic` over the server's `view`, so it reconciles after any refresh; S1.3 the loading-fallback rationale is corrected and the no-flash claim narrowed; S1.4 `bis-summary.ts` moves to `shared/`, and the row gets its own progress skeleton.
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
- Reading the choice in `loading.tsx`. The fallback is prefetched so navigation shows it at once (Next's `loading.md`), and reading a runtime cookie there would trade that for a list-shaped placeholder. It keeps the card-grid skeleton in both views, an accepted tradeoff: a list user sees grid placeholders until the page streams.

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

**Remembered across visits.** Yes, in a cookie, `characters-view`, `grid` or `list`, for a year. A cookie, not `localStorage`, so the server renders the resolved page in the chosen view, with no layout switch after hydration. Anything other than `list` reads as `grid`, the default.

**Add-character skeleton and empty state in list view.** The skeleton for a character being added is a row of the same shape, with the name and "Adding <name>…" where the source line goes, as the card skeleton does. The empty state is the same text in both views, and the toggle is hidden there.

## Design

**Shared pieces.** The row and the card show the same bar and source line, so both move out of `CharacterCard`:

- `src/components/bis-bar/BisBar.tsx`: the segmented bar, taking the `barSegments` result. Same markup and `aria-hidden` as today.
- `src/components/shared/source-text.ts`: `sourceText(card, now)`, the "SimC, pasted …" / "Blizzard, synced …" / "Not synced yet" string, with unit tests.
- `bis-summary.ts` and its test move to `src/components/shared/` (AGENTS.md "Splitting code": a helper several components use lives in `shared/`). Both components import it from there.
- `CardProgressSkeleton` stays card-private: it has crest-chip shapes the row doesn't show. The row has its own `RowProgressSkeleton` in its directory: label and count, bar, summary line.

**List row.** `src/components/character-row/CharacterRow.tsx`, a server component taking `{ card, now }` like `CharacterCard`. An `<article>`, `rounded-xl border border-line bg-surface px-4 py-3`:

- Below `lg`, the identity, progress and footer blocks stack (`flex-col gap-3`), so phones and tablets get a short card. The footer is the source text and the remove button, `justify-between`, as on the card.
- From `lg`, one line (`lg:flex-row lg:items-center lg:gap-6`): identity block `lg:w-64 shrink-0`, the progress block `grow min-w-0`, then the footer `shrink-0` with the source text right-aligned in `lg:w-40`, so the remove buttons line up. Budget at 1024 px with the page's `sm:px-16`: 896 px row, about 862 px inside; 256 + 160 + 44 + three 24 px gaps leave about 330 px for progress. The source text sits in the footer with the button, so the row has three flex children, not four.
- Every text line in the identity block is one `truncate` line: the name, and the identity · realm · ilvl line. Long names and realms end in an ellipsis, never wrap or overflow. The progress block's label/count line keeps the card's `justify-between`; the summary wraps.
- Errors (`tracksError`, `lastSyncError`) render under the bar inside the progress block, so they don't add a column.

`CharacterRowSkeleton` sits in the same directory with an optional `name`, matching `CharacterCardSkeleton`'s behavior: no `role="status"` of its own, and "Adding <name>…" in the source slot when named.

**Grid wrapper.** `CharacterGrid` gains `view: CharactersView`. `grid` keeps today's classes and `CharacterCardSkeleton`; `list` uses `flex flex-col gap-3` and `CharacterRowSkeleton`. The empty branch is unchanged.

**Toggle.** `src/components/view-toggle/ViewToggle.tsx`, a client component taking `{ view }`:

- A `fieldset` with an `sr-only` legend "Layout", holding two radio labels, "Grid" and "List", each with a small icon beside the word. It reuses `SourcePicker`'s segmented look at a smaller height (`h-9`), with the checked option in `bg-gold-soft text-gold ring-gold-line`. Color is not the only signal: the checked radio is the control's state, and both options have words.
- The server's `view` prop is the committed value. The checked radio is `useOptimistic(view)`: choosing an option, inside `startTransition`, sets the optimistic value, writes the cookie (`path=/; max-age=31536000; SameSite=Lax`, as `RememberGroup` does) and calls `router.refresh()`. When the transition settles the radio shows the server's `view` again, so after any refresh (this toggle, a remove, or another tab's choice) the selection matches the layout on screen.
- While the transition is pending the fieldset has `aria-busy="true"` and the options dim (`opacity-60`), so a slow refresh reads as working. Native radio keyboard behavior and the `has-[:focus-visible]` outline stay.
- `src/components/view-toggle/characters-view.ts` holds `CHARACTERS_VIEW_COOKIE`, the `CharactersView` type and `parseCharactersView(value?: string)`, with unit tests.

**Page.** `src/app/(home)/page.tsx` reads the cookie with `cookies()`, parses it, and passes `view` to `CharacterGrid` and `ViewToggle`. It renders `CharacterRow` or `CharacterCard` per card. The legend and toggle share one row: `flex flex-wrap items-center justify-between gap-4`.

No route handler: the cookie is a display preference the browser sets, and nothing writes on the server.

## Testing

Markup tests with `renderToStaticMarkup`, as the card's tests do:

- `characters-view.test.ts`: `list` reads as `list`; `grid`, `undefined` and junk read as `grid`.
- `source-text.test.ts`: the three source strings.
- `CharacterRow.test.ts`: name link to `card.href`, identity, realm and ilvl on one line, list label and count, bar segments, summary text, no crest chips; `notFound`, `bisError` and loading states as on the card; errors shown; the remove button present. The skeleton: shapes and no status without a name; the name and "Adding Birkibjörn…" with one.
- `CharacterGrid.test.ts`: `view="list"` uses the list classes and, while adding, the row skeleton; `view="grid"` keeps today's output.
- `ViewToggle.test.ts`: two radios named "Grid" and "List", the given view checked, an `sr-only` legend. Static markup can't run the transition; the optimistic and reconcile behavior is a hand check.
- Existing `CharacterCard` tests stay green after the bar and source move out.

By hand at 375, 768, 1023, 1024 and 1440 px, loaded and loading rows, with a long name and realm: toggle switches the layout, the choice survives a reload, the rows line up their remove buttons from `lg`, narrower rows stack without horizontal scroll or overlap, and adding a character in list view shows the named row skeleton. Interaction: switching view then removing a character keeps radio and layout in agreement; choosing in a second tab, then refreshing the first, moves the first tab's radio with its layout.
