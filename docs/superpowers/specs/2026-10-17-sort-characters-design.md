# Sort the Characters overview

Status: written for the unattended loop on 2026-10-17; the owner reviews it with the pull request.
Date: 2026-10-17
Issues: #180. Stacked on PR #186 (`feat/dungeon-loot-needs`), which made `ViewToggle` take its cookie name; this change reuses that.

## Goal

The Characters overview can be sorted, ascending or descending, and remembers the choice (owner answer on #180: "Yes").

## Options

| Key | Label | Value | Default direction |
|---|---|---|---|
| `added` | Date added | today's order (`addedAt`, then `id`) | ascending (oldest first, today's order) |
| `name` | Name | `name`, locale compare, case and accent insensitive | ascending |
| `class` | Class | `className`, then `spec`, then name | ascending |
| `spec` | Spec | `spec`, then `className`, then name | ascending |
| `itemLevel` | Item level | `itemLevel` | descending (highest first) |
| `progress` | BiS progress | `counts.done / total` | descending |
| `synced` | Last synced | `lastSyncedAt` | ascending (oldest first finds stale data) |
| `realm` | Realm | `realmName`, then name | ascending |

- Ties fall back to name, then today's order, so the order is stable.
- Missing values (no item level, no counts, never synced) always sort last, in either direction.
- Role is left out: the app stores no role, and spec covers it closely enough. Noted as an assumption in the PR.
- `CharacterCardView` gains `addedAt` (it already flows from `characters.addedAt` through the loader; only the view field is new) so the pure sorter needs no database.

## State

- Cookie `characters-sort`, value `<key>.<asc|desc>`, a year long, `SameSite=Lax`, written with the `view-cookie.ts` helper from #186. A pure `parseCharactersSort(raw)` beside `characters-view.ts` returns `{ key, dir }`; anything unknown gives `added.asc`.
- Picking a new key uses that key's default direction; the direction button flips it.
- The page reads the cookie as it reads the view cookie and sorts with `sortCards(cards, sort)`, a pure function in `src/components/character-grid/sort-cards.ts` with tests. The add bar and stale-sync lists keep their own order.

## Control

- A client component `CharacterSort` in its own directory beside `ViewToggle`, in the same toolbar row: a native `<select>` labeled "Sort by" (visible label) with the eight options, and a button beside it whose text names the direction in words ("Ascending" / "Descending") with an arrow icon. Same optimistic-then-`router.refresh()` pattern as `ViewToggle`.
- Shows only when there are two or more characters.
- Styled with existing tokens (`bg-bg`, `border-line`, `text-muted`, gold focus ring), 36 px tall like the toggle. At 375 px the toolbar wraps.

## Testing

- `sort-cards.test.ts`: each key in both directions; nulls last both ways; ties fall back to name then added order; accented names (Birkibjörn) sort with plain letters.
- `characters-sort.test.ts`: parse valid, unknown key, unknown direction, empty.
- `CharacterSort` markup test: label, eight options, the selected one, direction words.
- Gate: typecheck, lint, test, build.
- By hand on a DB copy: each sort at 1440 and 375 px in grid and list, the choice kept across reloads.
