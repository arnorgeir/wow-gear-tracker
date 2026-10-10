# Skeleton loaders

Status: design approved in chat on 2026-10-10.
Date: 2026-10-10
Issue: #87. Skeleton loaders... skeleton loaders everywhere

## Goal

While the app waits for data, the user sees nothing happen, or a line of grey text where a section belongs. A click on a character card leaves the old page on screen until the new one has rendered. A character page whose BiS list is still loading says "Loading BiS list…" where the gear table goes.

Every wait for data shows a pulsing skeleton shaped like the content it is waiting for. Text appears beside a skeleton only when the shape alone would confuse the user.

## What success looks like

- Navigating to any of the three routes shows that page's skeleton at once.
- Every in-page wait listed under "In-page waits" shows a skeleton of the section in place of its loading text.
- A group membership change skeletons the grid and both rail panels, while the member picker stays real and usable.
- A character added from the bar on `/` appears at once as a skeleton card with its name.
- Switching list tabs on a character page, or editing the group, never blanks the whole page.
- Screen readers hear one status line for each skeleton region, saying what is loading.
- With `prefers-reduced-motion`, skeletons don't pulse.
- When the content lands, the page doesn't jump by much: skeletons copy the outer box, padding and grid of what they stand for.

## Scope

In scope: route loading states for `/`, `/group` and `/characters/[region]/[realm]/[name]`; in-page waits on background syncs; the group edit transition; adding a character from the bar; the untracked-character auto-add.

Out of scope:

- The add bar's search results. They already have a spinner and "Searching…".
- Button busy states, such as **Refresh** or **Remove**.
- Wowhead tooltips.
- Streaming or splitting the page loaders with Suspense. Database reads are fast; the slow waits are client-driven, and `src/server/views/` keeps one loader per page.
- No schema change, no migration, no cache version bump.

## Design

### The primitive

`src/components/skeleton/Skeleton.tsx` renders `<div aria-hidden="true">` with `animate-pulse rounded-md bg-line motion-reduce:animate-none`, plus a `className` the caller passes for size and shape: `h-4 w-32`, or `size-[52px] rounded-full`. It is a server component.

No new color token: `bg-line` on `bg-surface` already reads as a placeholder in this palette.

### Words

- **Each skeleton region carries exactly one `role="status"` element** with `sr-only` text naming what is loading, such as "Loading character…". The shapes inside are `aria-hidden`.
- **Visible text appears only where the skeleton can't explain itself:**
  - A name the user just asked for: "Adding Birkibjörn…".
  - The page-level "Loading upgrade track data…" line on the group and character pages. The rest of the page is real there; only the upgrade colors are missing, and nothing else says why.
  - Errors, unchanged.
- **Text that becomes screen-reader-only:** "Loading BiS list…" wherever a skeleton replaces it, "Syncing…" in group cells, and "Updating group…" in the member picker.
- The copy stays in `src/components/shared/loading-copy.ts`, together with the new route strings.

### Section skeletons

Each skeleton sits in the directory of the component it imitates, and copies that component's outer `section` or `article`, border, padding and grid classes. Labels that never depend on data render for real: table headers, slot labels, section headings.

| Skeleton | Directory | Shape |
|---|---|---|
| `CharacterCardSkeleton` | `character-card/` | Avatar circle, three text bars, progress bar, a row of crest chips, footer line. Optional `name` prop: when set, the name renders for real and the card's status reads "Adding {name}…" visibly. |
| `CardProgressSkeleton` | `character-card/` | The card's middle block only: list label bar, progress bar, summary line. |
| `GearTableSkeleton` | `character-page/` | Real header row and 16 rows on the gear table's 4-column grid. |
| `DungeonPrioritySkeleton` | `character-page/` | Four ranked rows: name bar, score bar, one or two item-card shapes. Rendered inside the real section and heading. |
| `CharacterPageSkeleton` | `character-page/` | The whole character page below the back link: header, crests, settings, list tabs, gear table, dungeons, vault. Takes an optional `heading` node shown above it. |
| `GroupGridSkeleton` | `group-grid/` | Takes `members: number`. Member header shapes and every slot row; slot labels real. |
| `GroupPrioritySkeleton` | `group-priority/` | The group dungeon list's rows. |
| `GroupVaultSkeleton` | `group-vault/` | The group vault panel's rows. |

A skeleton that only its parent renders, such as a header shape used only by `CharacterPageSkeleton`, is a file in the parent's directory.

### Page loads

Each route gets a `loading.tsx` that composes the skeletons:

- **`src/app/loading.tsx`, for `/`:** the real heading and subtitle, a skeleton of the add bar's box, `StateLegend`, and four `CharacterCardSkeleton`s in the page's card grid. Status: "Loading characters…".
- **`src/app/group/loading.tsx`:** the real heading, a skeleton of the member picker, then `GroupLayout` with `GroupGridSkeleton members={5}` and both rail skeletons. Status: "Loading group…".
- **`src/app/characters/[region]/[realm]/[name]/loading.tsx`:** the real "All characters" link and `CharacterPageSkeleton`. Status: "Loading character…".

A route skeleton doesn't know the character's name yet, so it shows no words on screen.

`src/app/loading.tsx` sits in the root segment, so it would also wrap `/group` and the character route. Each of those has its own `loading.tsx`, which is the nearer boundary and wins.

### Search-param navigations must not show a route skeleton

Group edits navigate with `router.replace` to a new `?chars=`, and the list tabs link to a new `?list=`. If Next treats the new search params as a new segment and shows `loading.tsx`, a tab switch blanks the whole character page and a group edit hides the picker the user is clicking.

**Required behavior:** neither navigation shows the route skeleton. Only the sections that depend on the change skeleton: the gear table, dungeons and vault for a tab switch; the grid and rail panels for a group edit (see "Group edits in flight").

The plan's first task checks this in the browser, with the dev server and a throttled network. If the route skeleton does show, the plan picks the smallest fix that meets the requirement, such as wrapping the tab links' navigation in a transition, or moving the route's loading boundary below the parts that must stay. The plan records which fix and why.

### In-page waits

| Wait | Today | Becomes |
|---|---|---|
| Card, BiS list loading (no bar yet) | "Loading BiS list…" | `CardProgressSkeleton`, status sr-only |
| Card, track data loading | Track text in place of the summary | The bar stays real; a skeleton line replaces the summary, status sr-only |
| Gear table, BiS loading and no rows | Text | `GearTableSkeleton` rows inside the real section, status sr-only |
| Character dungeons, BiS or season loading | Text | `DungeonPrioritySkeleton` rows under the real heading, status sr-only |
| Group dungeons, season loading | Text | `GroupPrioritySkeleton` rows, status sr-only |
| Group cells, member `bisLoading` or `syncing` | Dim text in every cell | Skeleton cells in that member's column |
| Page-level track data wait, group and character pages | Text line | Unchanged |

Group cells: `cellNote` in `src/components/group-grid/cell-note.ts` returns `{ skeleton: true }` for `bisLoading` and `syncing` instead of text. The other states keep their text, because they aren't waits. A `bisLoading` member already has a "Loading BiS list…" status in the member notices row. A `syncing` member has none, so its column carries one sr-only status: "Syncing {name}…".

### Group edits in flight

`GroupEditsProvider` already exposes `pending` and the requested `keys`.

- A small client component in `group-edits/`, `WhileSettled`, takes `fallback` and `children`, and renders the fallback while `useGroupEdits().pending` is true. Nothing else imports it, so it stays in that directory.
- The group page wraps each `GroupLayout` slot in it: the grid falls back to `GroupGridSkeleton members={keys.length}`, the dungeons panel to `GroupPrioritySkeleton`, and the vault panel to `GroupVaultSkeleton`.
- The member picker and its add bar stay real and usable. Further edits are allowed while one is pending, as today.
- "Updating group…" in `GroupMembers` becomes sr-only. The skeleton says the rest.
- When the group goes from no members to some, the page renders the empty-state text, not `GroupLayout`. While pending in that state, the empty text is replaced by the same skeletons inside `GroupLayout`.

### Adding a character from the bar on `/`

The bar and the card grid are siblings in a server page, so they share the pending name through context:

- `src/components/pending-character/PendingCharacterProvider.tsx` is a client provider holding the name being added, or `null`. `usePendingCharacter()` reads and sets it.
- `AddCharacterBar` sets the name when an add starts, and clears it when the add fails or the transition that follows success settles. Without a provider, as on the group page, it behaves as today.
- `PendingCharacterCard`, a client component in the same directory, renders `CharacterCardSkeleton name={name}` at the end of the card grid while a name is set. When the list is empty, the grid renders around it instead of the empty-state text.
- The bar's own "Adding {name}…" line is removed when a provider is present: the card says it.
- The skeleton card is gone after the refresh: the real card has replaced it.

### Opening an untracked character by URL

`AutoAddCharacter` shows its "Adding {name} – {realmSlug}…" line visibly, as today, with `CharacterPageSkeleton` below it. On failure the error replaces both, as today.

## Testing

The repo renders components to static markup in `*.test.ts` files (for example `src/components/group-grid/GroupGrid.test.ts`). The new tests follow that pattern.

- **Unit, `cell-note.test.ts`:** `bisLoading` and `syncing` return `{ skeleton: true }`; `untracked`, `noGear`, `notFound` and "No BiS list" keep their text.
- **Render, each skeleton:**
  - Every shape is inside an `aria-hidden` element.
  - There is exactly one `role="status"`, with the expected text.
  - `GroupGridSkeleton` renders one header shape per member and one row per slot.
  - `CharacterCardSkeleton` with `name` shows the name and "Adding {name}…" visibly.
- **Render, in-page swaps:**
  - `GearTable` with `bisLoading` and no rows renders skeleton rows, not the text.
  - `DungeonPriority` and `GroupPriority` render skeleton rows while loading, and real rows otherwise.
  - `CharacterCard` renders `CardProgressSkeleton` without counts, and a skeleton summary line while tracks load.
  - `GroupGrid` renders skeleton cells for a `syncing` member, with one "Syncing {name}…" status.
- **Hand checks, local, with dev tools throttling the network to Slow 4G:**
  - Open each route from the nav and from a card. The route skeleton shows, then the page.
  - Switch list tabs on a character page. The page never blanks; only the sections change.
  - Add and remove group members. The picker stays; the grid and rail skeleton, then fill in.
  - Add a character from the bar on `/`. A named skeleton card appears, then the real card.
  - Open an untracked character's path. The adding line and page skeleton show, then the page.
  - Turn on reduced motion in the OS. The skeletons don't pulse.
  - Compare each skeleton with its loaded page. No large jump when content lands.
- **Not covered:** no browser-level tests, so route fallbacks, transitions and the search-param behavior are checked by hand only.
