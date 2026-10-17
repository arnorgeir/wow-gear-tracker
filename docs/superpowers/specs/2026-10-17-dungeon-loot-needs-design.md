# Dungeon loot: who wants each item

Status: written for the unattended loop on 2026-10-17 after the owner asked to file and spec it; the owner reviews it with the pull request.
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

A new loader step in `src/server/views/dungeon-page.ts`, reading only:

- Load every tracked character of the active account with `listCharacters`, and each one's `MemberData` with `loadMember` and one shared `createBisLookup`, in sequence, as `getGroupPage` does. Characters the group page would exclude (`exclusionReason` not null: never synced, no rows, BiS still loading) are skipped.
- Run `rankDungeons(characters.map(priorityCharacter), [thisDungeon])` with the dungeon as a `SeasonLoot` (`getSeasonLoot` already builds it). The one rank's `characters[].credits` say who needs what.
- Map credits to items: an `item` credit to its `itemId`; a `tier` credit to its drop's `itemId`, marked "via Catalyst" (the drop is catalysed into the tier piece) with its `fit`; `any` credits are dropped (see Scope).
- Each item gets `neededBy: { key, name, className, avatarUrl, classIconUrl, slotLabel, via: 'drop' | 'catalyst' }[]`, ordered by character name. A character needing one item for two slots (two rings) appears once, with the first slot label.

`// ponytail:` note in the loader: loading every character is linear in the roster; the characters page already does this, and a cache can come when rosters grow.

### BiS for

- Specs come from `listSpecs`, falling back to the tracked specs as `getSpecPicker` does when the catalog isn't loaded. A spec counts as configured when it has a stored list for the active account (`readSpecBase` returns `lists`, from Method or a manual list).
- For each configured spec, read its effective list (overrides applied) for the list type its settings compare (`getSpecSettings`, default Mythic+), through the same `createBisLookup` reads the needed-by step uses, so a spec is read once.
- An item is BiS for a spec when an `item` row of that list names its `itemId`, or a tier row's slot fits it as a catalyst source (the spec's class can wear it). `any` rows don't count.
- Each item gets `bisFor: { slug, specName, className, iconUrl }[]`, ordered by class, then spec.

Nothing is fetched from Method or Blizzard here: specs without a stored list aren't listed. The settings page is where lists are fetched.

## Page

### Filter

- New search param `show=all`. Missing or anything else: wanted only, where wanted means `neededBy` or `bisFor` is non-empty. `parseGuideState` gains `show: 'wanted' | 'all'`, with the same array and junk rules; `guideHref` keeps `show` across boss and tab changes and omits the default.
- A two-option switch above the grid, as links: "Wanted" and "All drops", the picked one with `aria-current="page"`, styled like the view toggle.
- Wanted with nothing wanted: "Nobody you track needs anything from here." with a link to the All drops view. For a boss: "…from this boss."
- The count of wanted drops shows on the switch: "Wanted (12)".

### Grid view (default)

`ItemCard` stays the card; a new `LootCard` in `src/components/dungeon-page/` wraps it and adds two rows under it, inside the same bordered box:

- **Needed by:** each character's avatar (`CharacterAvatar`, 20 px) with the name, and "via Catalyst" in muted text when that's the route. Up to four, then "+N more" with the full list in its `title`.
- **BiS for:** spec icons (20 px) with each spec's name in `sr-only` and a `title`; up to six, then "+N".
- A row with nothing to show is left out.

### List view

One row per item, in a table-like list with column headers on wide screens: item (icon, name, kind, boss on the dungeon-wide tab), Needed by (names written out), BiS for (spec names written out, comma separated). Below `md` each row stacks the three parts.

### Choosing the view

- `ViewToggle` takes the cookie name and the radio group name as props, so the characters page and the dungeon loot tab each remember their own choice. Characters keeps `characters-view`; dungeon loot uses `dungeon-loot-view`, read with a pure parser like `characters-view.ts`.
- The toggle shows on the Loot tab only.

### Words, not just color

"via Catalyst" and every name are text. Spec and class icons always carry the name as accessible text.

## Testing

- `dungeon-page.test.ts` (in-memory DB, made-up characters such as Birkibjörn): a character missing an item in this dungeon appears in its `neededBy`; a tier credit marks "catalyst"; an `any` credit adds nothing; an excluded character (no rows) is skipped; a spec with a stored list naming the item appears in `bisFor`, a spec without a stored list doesn't; override edits change `bisFor`.
- `guide-state.test.ts`: `show` parsing and hrefs keeping it.
- `characters-view` parser test for the loot cookie, `ViewToggle` test for cookie and name props.
- `DungeonPage.test.ts`: filter default hides unwanted items; "All drops" shows them; counts; empty states; grid card rows, "+N more"; list view columns; sr-only spec names.
- Gate: typecheck, lint, test, build.
- By hand on a DB copy: loot tab for a dungeon where a tracked character needs items, both views at 1440 and 375 px, filter switch, cookie remembered across reloads.
