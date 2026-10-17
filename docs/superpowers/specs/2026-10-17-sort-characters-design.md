# Sort the Characters overview

Status: written for the unattended loop on 2026-10-17; the owner reviews it with the pull request. Spec review round 1 (Opus reviewer; Codex was out of usage) folded in: S1.1 added order comes from the loader's row order, no new field; S1.2 BiS progress uses the card's headline count; S1.3 an e2e test and harness screenshots; S1.4 sort files get their own directory; S1.5 one shared collator; S1.6 the direction button names the current direction; S1.7 a newly added card moves into place after the refresh.
Date: 2026-10-17
Issues: #180. Stacked on PR #186 (`feat/dungeon-loot-needs`), which made `ViewToggle` take its cookie name and added `view-cookie.ts`; this change reuses both.

## Goal

The Characters overview can be sorted, ascending or descending, and remembers the choice (owner answer on #180: "Yes").

## Options

| Key | Label | Value | Default direction |
|---|---|---|---|
| `added` | Date added | the loader's order (`listCharacters` returns rows by `addedAt`, then `id`) | ascending (today's order) |
| `name` | Name | `name` | ascending |
| `class` | Class | `className`, then `spec`, then name | ascending |
| `spec` | Spec | `spec`, then `className`, then name | ascending |
| `itemLevel` | Item level | `itemLevel` | descending (highest first) |
| `progress` | BiS progress | `bisSummary(card).bis / card.total`, the card's own headline count | descending |
| `synced` | Last synced | `lastSyncedAt` | ascending (oldest first finds stale data) |
| `realm` | Realm | `realmName`, then name | ascending |

- Strings compare with one shared `new Intl.Collator('en', { sensitivity: 'base' })`, so accents and case don't change the order and it's the same on every machine.
- Ties fall back to name, then the input index (today's order). JS sort is stable; the input index is the added order, so no `addedAt` field is needed on the view.
- Missing values (no item level; null counts or `total === 0`; never synced) always sort last, in either direction.
- Role is left out: the app stores no role, and spec covers it closely enough. Noted as an assumption in the PR.

## State

- Cookie `characters-sort`, value `<key>.<asc|desc>`, a year long, `SameSite=Lax`, written with `view-cookie.ts`. A pure `parseCharactersSort(raw)` returns `{ key, dir }`; anything unknown gives `added.asc`.
- Picking a new key uses that key's default direction; the direction button flips it.
- The page reads the cookie as it reads the view cookie and sorts with `sortCards(cards, sort)`. The add bar and stale-sync lists keep their own order. A character being added shows its skeleton last, as today, and moves to its sorted place after the refresh.

## Files

`src/components/character-sort/`: `CharacterSort.tsx` (the control), `sort-cards.ts` (`sortCards`, the collator), `characters-sort.ts` (cookie name constant, `parseCharactersSort`, the options table), and their tests.

## Control

- `CharacterSort`, a client component in the toolbar row beside `ViewToggle`: a native `<select>` with a visible "Sort by" label and the eight options, and a button beside it that shows the current direction in words ("Ascending" / "Descending") with an `aria-hidden` arrow, and has the accessible name "Sort direction: Ascending" (or Descending). Same optimistic-then-`router.refresh()` pattern as `ViewToggle`, with `aria-busy` while refreshing.
- Shows only when there are two or more characters.
- Existing tokens (`bg-bg`, `border-line`, `text-muted`, gold focus ring), 36 px tall like the toggle. At 375 px the toolbar wraps.

## Testing

- `sort-cards.test.ts`: each key in both directions; nulls and zero totals last both ways; progress by headline count where it differs from done/total; ties fall back to name then input order; accented names (Birkibjörn) sort with plain letters.
- `characters-sort.test.ts`: parse valid, unknown key, unknown direction, empty.
- `CharacterSort.test.ts` (markup): label, eight options, the selected one, direction words, accessible name.
- `e2e/character-sort.spec.ts`: with three made-up characters from the fake upstream, pick Name, flip direction, reload, the order holds.
- Screenshots from the e2e harness (1440 and 375 px) per `docs/workflow.md` ("Screenshots in pull requests").
- Gate: typecheck, lint, test, build.
