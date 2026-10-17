# Dungeon loot: who wants each item

Status: written for the unattended loop on 2026-10-17 after the owner asked to file and spec it; the owner reviews it with the pull request. Spec review round 1 (Codex) folded in: S1.1 needs come from a per-drop matcher, not the ranker's one credit per row; S1.2 tier BiS needs a verified stat match; S1.3 each need carries its reason and fit in words; S1.4 BiS lists use the Overall fallback; S1.5 overflow and spec names open with a disclosure, not a title; S1.6 the page says which characters it couldn't evaluate.
Date: 2026-10-17
Issues: #184 (part of #45). Builds on the dungeon guide page (#159, merged).

## Goal

The dungeon page's Loot tab tells you which of your characters need each drop, and which specs' BiS lists name it. By default it shows only the drops someone wants, so the tab answers "is this dungeon, or this boss, worth running for us?" A grid and a list view, like the characters page.

## Scope

In scope, from the owner's thread:

- **Needed by:** on each item, the tracked characters who need it, from the same priority logic the character and group pages use, with the kind of need in words.
- **BiS for:** on each item, the specs whose configured BiS list names it.
- **Filter:** wanted drops only by default, with a switch to show every drop.
- **Grid and list views,** chosen with the characters page's toggle and remembered.

Out of scope, kept for follow-ups in #184 or new issues:

- Sorting by demand and need counts on boss banners.
- A group lens (needs of one group only).
- Difficulty, upgrade track and item level (#174). Cards stay epic.
- "Any" rows (Method rows that name a slot and a minimum item level, not an item). They fit nearly every drop of a slot, so they would mark half the table as wanted. They keep counting in the dungeon rankings, as today.

## Data

### Needed by

- Load every tracked character of the active account with `listCharacters`, and each one's `MemberData` with `loadMember` and one shared `createBisLookup`, in sequence, as `getGroupPage` does. A character whose `exclusionReason` (`group-grid.ts`) isn't null is not evaluated; the loader keeps `{ name, reason }` for each one.
- `rankDungeons` picks one drop per tier row for scoring, so it can't say who needs each drop. A new pure function `needsByDrop(characters: PriorityCharacter[], loot: LootItem[]): Map<number, DropNeed[]>` in `src/core/priority/drop-needs.ts` walks every drop instead. It shares the ranker's rules: the same missing and wrong-stats rows, `fitsSlot`, `compareStats` and `statsMatter`, exported from `rank.ts` (or a small shared module) rather than copied. `rankDungeons` and its scoring don't change.
  - An item row the character is missing or holds with wrong stats: the drop with that `itemId` gets `{ via: 'drop', reason }`, reason `missing` or `wrongStats`.
  - A tier row: every drop that `fitsSlot` gets `{ via: 'catalyst', reason, fit }`, where `fit` is `bis` (same stats), `unverified` (unknown stats), `alternative` (different stats) or `any` (stats ignored), the ranker's `FIT` mapping. A wrong-stats tier row only takes `bis` drops, as the ranker does.
  - Any rows add nothing (see Scope).
- `priorityCharacter(member, tracks)` builds the input, with the tracks the loader already reads.
- Each item's view gets `neededBy: { key, name, className, avatarUrl, classIconUrl, slotLabel, via, reason, fit? }[]`, ordered by character name, one entry per character (the first matching row when two rows match).
- The view also gets `coverage: { evaluated: number; excluded: { name: string; reason: string }[] }`.

`// ponytail:` note in the loader: loading every character is linear in the roster; the characters page already does this, and a cache can come when rosters grow.

### BiS for

- Specs come from `listSpecs`, falling back to the tracked specs as `getSpecPicker` does when the catalog isn't loaded. A spec counts as configured when it has a stored list for the active account (`readSpecBase` returns `lists`, from Method or a manual list).
- Each configured spec is read once through the same `createBisLookup` (region: the first tracked character's, else `eu`). Its list is `choosePriorityList(bis.lists, bis.listType)`, the same Overall fallback the character and group pages use.
- An item is BiS for a spec when an item row names its `itemId`, or a tier row's slot fits it (the spec's armor type) and `compareStats` against the spec's tier target says `same`, or the spec ignores stats. Unknown and different stat pairs don't count. Any rows don't count. This matcher is a pure function beside `needsByDrop`.
- Each item gets `bisFor: { slug, label, className, iconUrl }[]`, where `label` is class and spec ("Frost Mage"), ordered by class, then spec.

Nothing is fetched from Method or Blizzard here: specs without a stored list aren't listed. The settings page is where lists are fetched.

## Page

### Filter

- New search param `show=all`. Missing or anything else: wanted only, where wanted means `neededBy` or `bisFor` is non-empty. `parseGuideState` gains `show: 'wanted' | 'all'`, with the same array and junk rules; `guideHref` keeps `show` across boss and tab changes and omits the default.
- A two-option switch above the grid, as links: "Wanted" and "All drops", the picked one with `aria-current="page"`, styled like the view toggle.
- Messages above the items, from `coverage`, before any empty state:
  - Nobody evaluated (no tracked characters, or every one excluded): "No character could be checked yet." followed by each excluded name and its reason, as the group page words them. Items then show only their BiS for row.
  - Some excluded: "Not checked: Birkibjörn (still syncing)." as one muted line.
- Wanted with nothing wanted after a full or partial evaluation: "Nothing here is wanted by the characters checked or your BiS lists." with a link to All drops. For a boss: "…from this boss."
- The count of wanted drops shows on the switch: "Wanted (12)".

### Grid view (default)

`ItemCard` stays the card; a new `LootCard` in `src/components/dungeon-page/` wraps it and adds two rows under it, inside the same bordered box:

- **Needed by:** each character's avatar (`CharacterAvatar`, 20 px) and name, then the need in muted words: nothing for a missing item, "has wrong stats" for a wrong-stats row, "via Catalyst" for a tier route, plus "stats unverified" or "alternative stats" for those fits. Up to three characters; more sit behind a native `<details>` whose summary reads "+N more" and opens the rest as the same lines.
- **BiS for:** up to six spec icons (20 px), each with its label as accessible text, followed by a `<details>` summary "BiS for N specs" that opens the labels as text. The summary is always there, so touch and keyboard users can read the names; with seven or more specs it's the only place the rest show.
- A row with nothing to show is left out.

### List view

One row per item, in a table-like list with column headers on wide screens: item (icon, name, kind, boss on the dungeon-wide tab), Needed by (each name with its need words, as in the grid), BiS for (labels written out, comma separated). Below `md` each row stacks the three parts.

### Choosing the view

- `ViewToggle` takes the cookie name and the radio group name as props, so the characters page and the dungeon loot tab each remember their own choice. Characters keeps `characters-view`; dungeon loot uses `dungeon-loot-view`, read with a pure parser like `characters-view.ts`.
- The toggle shows on the Loot tab only.

### Words, not just color

Every need is words, every name is text, and spec icons carry class and spec as accessible text; nothing is said by color or a hover title alone.

## Testing

- `drop-needs.test.ts` (pure): two same-slot tier candidates on different bosses both credited; same, unknown and different stats give `bis`, `unverified`, `alternative`; a wrong-stats tier row only takes `bis`; stats ignored gives `any`; a missing item row and a wrong-stats item row give `missing` and `wrongStats`; Any rows add nothing. BiS matcher: item row, tier with same stats, tier with different or unknown stats (not BiS), stats ignored (BiS), an override changing the target.
- `dungeon-page.test.ts` (in-memory DB, made-up characters such as Birkibjörn): `neededBy` and `coverage` for a fully evaluated roster with needs, one with zero needs, a mixed roster, and an all-excluded roster; `bisFor` with an Overall-only stored list under default Mythic+ settings, an empty Raid list falling back, and a spec without a stored list left out.
- `guide-state.test.ts`: `show` parsing and hrefs keeping it.
- `characters-view` parser test for the loot cookie, `ViewToggle` test for cookie and name props.
- `DungeonPage.test.ts`: filter default hides unwanted items; "All drops" shows them; counts; the three coverage states and the empty state; need words for each reason and fit; more than three characters and more than six specs open in `<details>`; list view columns; spec labels as text.
- Gate: typecheck, lint, test, build.
- By hand on a DB copy: loot tab for a dungeon where a tracked character needs items, both views at 1440 and 375 px, filter switch, `<details>` opened by keyboard and tap, cookie remembered across reloads.
