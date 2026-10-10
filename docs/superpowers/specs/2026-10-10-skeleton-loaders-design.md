# Skeleton loaders

Status: design approved in chat on 2026-10-10. Spec review findings (list-tab pending state, client-side group fallback) resolved on 2026-10-10. Route skeletons limited to `/` on 2026-10-10, after a browser probe (see "Why only `/` gets a route skeleton").
Date: 2026-10-10
Issue: #87. Skeleton loaders... skeleton loaders everywhere

## Goal

While the app waits for data, the user sees nothing happen, or a line of grey text where a section belongs. A click on a character card leaves the old page on screen until the new one has rendered. A character page whose BiS list is still loading says "Loading BiS list…" where the gear table goes.

Every wait for data shows a pulsing skeleton shaped like the content it is waiting for. Text appears beside a skeleton only when the shape alone would confuse the user.

## What success looks like

- Navigating to `/` shows the characters page's skeleton at once. The group and character routes get no route skeleton; see "Why only `/` gets a route skeleton".
- Every in-page wait listed under "In-page waits" shows a skeleton of the section in place of its loading text.
- A group membership change skeletons the grid and both rail panels, while the member picker stays real and usable.
- A character added from the bar on `/` appears at once as a skeleton card with its name.
- Switching list tabs on a character page skeletons the gear table, dungeons and vault until the new list renders, even when the BiS and season data are cached. Header, settings and tabs stay.
- The group grid skeleton always has as many columns as the latest requested membership, including while several edits are pending.
- Switching list tabs on a character page, or editing the group, never blanks the whole page.
- Screen readers hear one status line for each skeleton region, saying what is loading.
- With `prefers-reduced-motion`, skeletons don't pulse.
- When the content lands, the page doesn't jump by much: skeletons copy the outer box, padding and grid of what they stand for.

## Scope

In scope: the route loading state for `/`; in-page waits on background syncs; list-tab switches on the character page; the group edit transition; adding a character from the bar; the untracked-character auto-add.

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

- **Each skeleton region carries exactly one `role="status"` element** with `sr-only` text naming what is loading, such as "Loading characters…". The shapes inside are `aria-hidden`.
- **Visible text appears only where the skeleton can't explain itself:**
  - A name the user just asked for: "Adding Birkibjörn…".
  - The page-level "Loading upgrade track data…" line on the group and character pages. The rest of the page is real there; only the upgrade colors are missing, and nothing else says why.
  - Errors, unchanged.
- **Text that becomes screen-reader-only:** "Loading BiS list…" wherever a skeleton replaces it, "Syncing…" in group cells, and "Updating group…" in the member picker.
- The copy stays in `src/components/shared/loading-copy.ts`, together with the new strings.

### Section skeletons

Each skeleton sits in the directory of the component it imitates, and copies that component's outer `section` or `article`, border, padding and grid classes. Labels that never depend on data render for real: table headers, slot labels, section headings.

| Skeleton | Directory | Shape |
|---|---|---|
| `CharacterCardSkeleton` | `character-card/` | Avatar circle, three text bars, progress bar, a row of crest chips, footer line. Optional `name` prop: when set, the name renders for real and the card's status reads "Adding {name}…" visibly. |
| `CardProgressSkeleton` | `character-card/` | The card's middle block only: list label bar, progress bar, summary line. |
| `GearTableSkeleton` | `character-page/` | Real header row and 16 rows on the gear table's 4-column grid. |
| `DungeonPrioritySkeleton` | `character-page/` | Four ranked rows: name bar, score bar, one or two item-card shapes. Rendered inside the real section and heading. |
| `VaultSectionSkeleton` | `character-page/` | The vault section's box and its three reward rows. |
| `CharacterPageSkeleton` | `character-page/` | The whole character page below the back link: header, crests, settings, list tabs, gear table, dungeons, vault. Takes an optional `heading` node shown above it. |
| `GroupGridSkeleton` | `group-grid/` | Takes `members: number`, at least 1. Member header shapes and every slot row; slot labels real. No server-only imports, so client components can render it. |
| `GroupPrioritySkeleton` | `group-priority/` | The group dungeon list's rows. |
| `GroupVaultSkeleton` | `group-vault/` | The group vault panel's rows. |

A skeleton that only its parent renders, such as a header shape used only by `CharacterPageSkeleton`, is a file in the parent's directory.

### Page loads

Only `/` gets a route skeleton:

- **`src/app/(home)/loading.tsx`:** the real heading and subtitle, a skeleton of the add bar's box, `StateLegend`, and four `CharacterCardSkeleton`s in the page's card grid. Status: "Loading characters…". Shapes only, no visible words.
- **The home page moves to `src/app/(home)/page.tsx`.** The `(home)` route group scopes the loading boundary to `/`. A `loading.tsx` at `src/app/` would sit above `/group` and the character route too, and a loading boundary above a page that isn't its own triggers the full reloads described below.
- **`/group` and the character route have no `loading.tsx`.** Opening them from another page keeps the old page on screen until the new one renders, as today. Their sections still skeleton on every in-page wait, tab switch and group edit.

### Why only `/` gets a route skeleton

A browser probe on 2026-10-10, on the dev server and on a production build, with a 2 s delay in the character page and tabs navigating inside `startTransition`:

| Route fallback | Tab switch to a new `?list=` |
|---|---|
| `loading.tsx` beside the character page | Same document, but the route fallback shows: the whole page blanks |
| `<Suspense>` in a character-route `layout.tsx` | Full document reload on every click, dev and production |
| `loading.tsx` at `src/app/characters/` | Full document reload on every click |
| None | Same document, the transition's pending state works, no fallback |

Group edits navigate to a new `?chars=` the same way. A route skeleton on either page therefore either blanks it or reloads it on every tab switch or group edit, so neither page gets one. A later issue can look for another page-load cue for them.

### Search-param navigations must not show a route skeleton

Group edits navigate with `router.replace` to a new `?chars=`, and the list tabs link to a new `?list=`. If Next treats the new search params as a new segment and shows `loading.tsx`, a tab switch blanks the whole character page and a group edit hides the picker the user is clicking.

**Required behavior:** neither navigation shows the route skeleton. Only the sections that depend on the change skeleton: the gear table, dungeons and vault for a tab switch (see "List-tab switches"); the grid and rail panels for a group edit (see "Group edits in flight").

Both navigations run inside `startTransition`, and neither route has a loading boundary in its tree (see above), so the page stays and only the dependent sections skeleton.

A cached destination that renders at once must not be forced through a skeleton. Neither the route fallback nor the section swaps add a minimum display time.

### List-tab switches

Today `ListTabs` renders plain `Link`s, and the page renders `GearTable`, `DungeonPriority` and `VaultSection` directly. With the BiS and season data cached, nothing on the page knows a tab switch is in flight, so the old list stays on screen until the server answers.

- **`src/components/list-switch/ListSwitchProvider.tsx`**, a client provider, owns the switch. It holds the requested list type and a `useTransition` pending flag. `select(listType, href)` sets the requested list and calls `startTransition(() => router.push(href, { scroll: false }))`. Once nothing is pending, the requested list resets to the rendered one, as `GroupEditsProvider` does with its keys.
- **`ListTabs` becomes a client component.** Each tab stays a `Link` with the same `href`, so middle-click, open-in-new-tab and keyboard focus behave as today. A plain left click without modifier keys calls `preventDefault()` and `select(...)`. The tab marked `aria-current="page"` is the requested one, so the click shows at once.
- **`WhileListSettled`**, a client component in the same directory, takes `fallback` and `children` and renders the fallback while the switch is pending. The page wraps three sections in it:
  - `GearTable`, falling back to `GearTableSkeleton` in its real section box.
  - `DungeonPriority`, falling back to its real heading and `DungeonPrioritySkeleton`.
  - `VaultSection`, falling back to `VaultSectionSkeleton`.
- The fallbacks have fixed shapes, so the server page builds them and passes them in as nodes. The header, crests, settings and tabs stay mounted and usable.
- **Rapid switches settle on the last one.** Each click updates the requested list and starts a new transition; the router drops the earlier navigation, and the sections stay skeletons until the last one has rendered.
- The provider wraps the page body below the back link. It is the only owner of the switch; nothing else reads the URL's `list` param on the client.

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

`GroupEditsProvider` already exposes `pending` and the requested `keys`, which run ahead of the rendered ones during an edit. Only a client component can read them; the server page knows only the committed keys. So the choice between the empty state, skeletons and real panels moves to the client.

- **`src/components/group-body/GroupBody.tsx`**, a client component rendered inside `GroupEditsProvider`, takes:
  - `empty`: the empty-state paragraph.
  - `content`: `null` when the rendered group has no members, else `{ notice, legend, gear, dungeons, vault, dungeonCount }`, the same server-rendered slots the page passes to `GroupLayout` today. `notice` is the page-level track data line, or `null`.
- **`groupBodyMode(pending, requestedCount, hasContent)`** in `group-body/group-body-mode.ts` is a pure function returning `'empty'`, `'skeleton'` or `'content'`:
  - `requestedCount === 0` gives `'empty'`, pending or not. Removing the last member shows the empty-state text at once: there is nothing to wait for.
  - Otherwise `pending` gives `'skeleton'`.
  - Otherwise `hasContent` gives `'content'`, and its absence gives `'empty'`.
- **In `'skeleton'` mode** `GroupBody` renders `GroupLayout` with `legend` from `content` when present, else `StateLegend`; `gear` as `GroupGridSkeleton members={keys.length}`; `dungeons` as `GroupPrioritySkeleton`; `vault` as `GroupVaultSkeleton`. Both rail skeletons go inside the page's `PANEL_BOX` wrapper, which moves to `group-body/`. `GroupLayout` takes `dungeonCount: number | null` and hides the Dungeons tab's count when it is `null`, as it is in this mode.
- **The column count follows the latest intent.** `keys` comes from the context on every render, so a second edit while the first is pending changes the skeleton at once: a third member added to a pending two-member group shows three columns.
- **Empty to one member** works without any server response: `keys.length` becomes 1 and `pending` true in the same render, so the mode goes from `'empty'` to `'skeleton'` directly.
- **`GroupLayout` stays mounted** across `'content'` and `'skeleton'`: both render it at the same place in the tree, so the selected phone tab survives an edit.
- `GroupGridSkeleton`, `GroupPrioritySkeleton` and `GroupVaultSkeleton` contain no server-only imports, because `GroupBody` renders them on the client.
- The member picker and its add bar stay real and usable. Further edits are allowed while one is pending, as today.
- "Updating group…" in `GroupMembers` becomes sr-only. The skeleton says the rest.

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
- **Unit, `group-body-mode.test.ts`:** every combination of `pending`, `requestedCount` 0 or more, and `hasContent`, including 0 requested while pending (`'empty'`) and 1 requested with no content while pending (`'skeleton'`).
- **Render, `GroupBody`** inside a `GroupEditsProvider` (with the App Router mocked, as `GroupGrid.test.ts` does): settled with content renders the slots; settled without content renders the empty text.
- **Render, `ListTabs`** inside a `ListSwitchProvider`: each tab is a link with its `?list=` href, and the rendered list carries `aria-current="page"`. `WhileListSettled` renders its children when nothing is pending.
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
  - Open `/` from the nav. The route skeleton shows, then the page. Open `/group` and a character: no route skeleton, and no full reload.
  - On a character whose BiS and season data are already loaded, switch list tabs. The clicked tab is marked at once; the gear table, dungeons and vault show skeletons, then the new list. Header, settings and tabs never blank.
  - Click three tabs quickly. The page settles on the last one clicked.
  - Middle-click a tab. It opens in a new browser tab, and the current page doesn't skeleton.
  - Group edits:
    - Empty group, add one member: one skeleton column appears before the server answers.
    - One member, remove it: the empty-state text appears at once.
    - Two members, add a third and a fourth before the first edit settles: the skeleton shows three, then four columns, and the picker stays usable.
    - On a phone width, pick the Vault tab, then edit the group: the Vault tab stays selected.
  - Repeat the tab-switch and group-edit checks on a production build (`npm run build`, then `npx next start -p 3001`, with dev stopped), since prefetching differs from dev.
  - Add a character from the bar on `/`. A named skeleton card appears, then the real card.
  - Open an untracked character's path. The adding line and page skeleton show, then the page.
  - Turn on reduced motion in the OS. The skeletons don't pulse.
  - Compare each skeleton with its loaded page. No large jump when content lands.
- **Not covered:**
  - No browser-level tests, so route fallbacks, transitions, rapid edits and the search-param behavior are checked by hand only.
  - Static markup can't show a screen reader's announcements. The render tests check that one status exists per region; a pass with a screen reader is optional.
  - Pending states can't be forced in a static render, so the skeleton branches of `GroupBody` and `WhileListSettled` are covered by `groupBodyMode` and by hand.
