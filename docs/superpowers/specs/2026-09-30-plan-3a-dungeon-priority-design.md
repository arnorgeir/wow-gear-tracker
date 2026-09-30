# Plan 3a: season loot and dungeon priority

Status: awaiting approval
Date: 2026-09-30
Parent spec: `docs/superpowers/specs/2026-09-26-gear-tracker-design.md`

## Why

The app shows what each character still needs, but not where to get it. Plan 3 answers "which Mythic+ dungeons should we run?" It is split in two:

- **3a, this spec:** load the season's dungeon loot, build the scoring engine, and show each character's own dungeon priority on the character page. This proves the scores against real characters on a small surface.
- **3b, its own spec later:** the group page, built on an engine already trusted.

The parent spec stays the authority for the scoring rules. This spec decides what the parent left open and adds what building it revealed.

## What success looks like

- Each character page shows the season's Mythic+ dungeons ranked by how much that character needs from each, with the items behind every score.
- The ranking follows the parent spec's rules exactly, with the fallback and "Any" rows described here.
- Loading season loot never slows a page render.
- A failed load never leaves a page without priority when older data exists.
- The engine accepts several characters, so 3b adds no scoring code.

## Non-goals

- The group page, its character picker and its grid (3b).
- Browser tests (#35). 3a's new UI is server-rendered and covered by HTML tests; the decision belongs with 3b's interactive page.
- Moving the existing Method and Raidbots refreshes off the render path (#3's note). That matters for a page with several characters, so it belongs to 3b.
- Deciding per half which bosses a split dungeon has. See decision 1.

## What the probes established

Checked against the live APIs on 2026-09-30, before any design:

- **The current season is Midnight Season 2**, with eight dungeons. Raider.IO's static data gives each dungeon's `challenge_mode_id`, but no Encounter Journal ID.
- **The join works by map ID for all eight.** Blizzard's keystone dungeon (`/data/wow/mythic-keystone/dungeon/{challenge mode ID}`) names a map, and exactly one journal instance has that map. Name alone is not trusted; the map ID confirms it.
- **Split dungeons are real.** Last season's two Tazavesh halves are separate Mythic+ dungeons (challenge modes 391 and 392) that share one journal instance with 8 encounters. The API does not say which encounter belongs to which half.
- **Encounter loot gives only item ID and name.** Slot and armor type need one `/data/wow/item/{id}` call per item, about 220 per season.
- **Seasons come in variants.** "Break the Meta" and "cutoffs" entries repeat the main season's dungeons. Only `is_main_season` counts.
- **"Any" rows exist only for Feral Druid today.** Of 347 rows across eight specs' live pages, the only rows without an item link that are not headers are Feral's Shoulders, Chest, Gloves and Boots, each reading exactly `Any 334` with source `-`, all on its Overall list. Feral has no Mythic+ list.

## Decisions

### 1. Season data

**Tables**, in one migration:

| Table | Columns |
|---|---|
| `season_dungeons` | season slug, challenge mode ID, name, short name, journal instance ID, map ID |
| `dungeon_loot` | challenge mode ID, encounter ID, encounter name, item ID, item name, inventory type, armor type |

Slot and armor type live on the loot row rather than in the shared `item_details` cache. Loot is rebuilt every season, and this leaves that cache's refresh rules alone.

**The loader**, `src/core/sync/season-sync.ts`, receives its clients and the database as parameters, like the other sync modules:

1. **Find the season.** Read Raider.IO's static data for the current expansion and the next one, and take the newest main season that has started in any region. A new expansion is found without a code change.
2. **Join each dungeon to its journal instance:** challenge mode → keystone dungeon → map ID → the journal instance with that map ID.
3. **Load each encounter's loot**, then look up each loot item's inventory type and armor type, at most 4 requests at once through the existing limiter.
4. **Write the whole season in one transaction**, through `withWriteLock`, replacing that season's rows. A page never sees half a season.

**When it runs:** never during a page render. A client component, `season-sync/SeasonSync.tsx`, mounted on the character page, calls `POST /api/season/sync` when there is no season data or the last check is over a day old, then refreshes the page when the load finishes. This is the pattern `StaleSync` uses for gear.

- The daily check is one Raider.IO call. The full load, about 250 calls, runs only when the season slug changes.
- Two requests arriving together share one in-flight load in the same process.
- A version key, like `TRACKS_META_KEY` for the Raidbots data, forces a reload whenever these tables change shape.

**Split dungeons:** when two season dungeons resolve to the same journal instance, both get the whole instance's loot, and the priority list notes this on those dungeons. None are in the current season. A per-half boss list waits until a season needs one.

**Failures:**

- Raider.IO or Blizzard unavailable: the previous season's data stays, and the page says it is showing older data.
- An item lookup answering 404: the loot row is stored without inventory or armor type. It still credits named BiS items, but not tier or "Any" rows.
- Any other error: the load is abandoned, nothing is written, and the next check retries.

**New client calls:**

- Raider.IO: season static data.
- Blizzard: keystone dungeon, the journal instance index, a journal instance, a journal encounter.
- The existing `getItemDetails` gains inventory type and armor type.

Each follows the existing split: request code in the client module, response mapping in pure parsers under test.

### 2. "Any" rows (#10)

**Parser:** a row whose item cell reads exactly `Any <number>` and has no item link becomes an "any" row. Rows without a link that do not match, such as table headers, are still skipped.

**Row type:** `BisRow` becomes a union of two kinds sharing `slotLabel`, `slots` and `source`:

- `kind: 'item'`: today's fields (`itemId`, `name`, `bonusIds`, `isTier`, `isCatalyst`).
- `kind: 'any'`: `minItemLevel`.

A union makes the compiler flag every reader of `itemId`, so no consumer quietly mishandles an any row.

**Storage:** `bis_items` gains a nullable `min_item_level`, and `item_id` becomes nullable. BiS lists already refresh daily, so no forced refetch is needed.

**Gear evaluation:** an any row is `done` when the item in its slot has at least that item level, and `missing` otherwise. Its requirement is purely item level, so the track-based states (`mythUpgradable`, `belowMyth`) and `inBags` never apply. A done any row gets the gold row like any satisfied BiS row.

**Gear table:** the BiS column shows a plain card reading "Any item, level 334+", with no icon and no Wowhead link.

**Great Vault:** a vault choice counts as BiS for an any row when it fits that slot and reaches the item level.

### 3. The scoring engine

**Location:** `src/core/priority/`, pure functions with no network and no database access, like `gear/`.

**Input:** a list of characters, each with its evaluated gear rows for its priority list and its class, plus the season's loot. 3a passes one character, and 3b passes several.

**Fallback:** when a character's chosen priority list is empty for their spec, the engine uses Overall and reports that it did.

**Which rows count:** only rows in the `missing` state, as the parent spec says.

**Weight**, from the character's current item in that slot:

| Current item | Weight |
|---|---|
| Empty, or Veteran track or lower | 3 |
| Champion track, or no track | 2 |
| Hero or Myth track | 1 |

- For ring and trinket rows, the weaker of the two unmatched items sets the weight.
- A tier row gets +2 while the character has fewer than 4 tier pieces equipped.

**Which dungeons a row credits:**

| Row | Credits every season dungeon that |
|---|---|
| Named item | drops that exact item |
| Tier | drops an item for that slot in the character's armor type, since the catalyst accepts it |
| Any | drops an item for that slot, filtered by armor type for armor slots |

- A named item that drops in no season dungeon credits nothing.
- Armor type comes from class: cloth for Mage, Priest and Warlock; leather for Demon Hunter, Druid, Monk and Rogue; mail for Evoker, Hunter and Shaman; plate for Death Knight, Paladin and Warrior.
- Inventory types map to the app's slots in one pure table. A one-handed weapon counts for main hand and off hand.

**Known imprecision:** for non-armor slots, "drops an item for that slot" cannot tell whether a trinket has the right stats or a weapon is a type the class can use. Every real "Any" row today is an armor slot, where armor type makes the match precise.

**Output:** dungeons ranked by total weight. Ties go to the dungeon that credits more characters, then to name order. Each dungeon carries its credits: character, slot, what was credited (the item, "Any 334", or "Tier via catalyst"), and weight.

### 4. The character page

**Placement:** the page follows the Group artboard on the design canvas. The gear table sits on the left at about 860 px, and a right-hand column holds **Dungeon priority** above **Great Vault**. Below the large breakpoint the two stack into one column, with the table first. The Group page in 3b uses the same arrangement.

**The priority list** is the character's priority list setting (Mythic+ by default), not the open tab, and its heading names it: "Dungeon priority · Mythic+ list".

- Each dungeon with a score shows its name and score on one line, and its credits beneath. Named items use `ItemCard`, with icon and Wowhead tooltip. Tier and "Any" credits are text.
- Dungeons scoring zero collapse into one muted line: "Nothing you need from: …".

**States:**

| Situation | Shows |
|---|---|
| No season data yet | "Loading this season's loot…", then fills in when the sync finishes |
| Last load failed, older data exists | Priority from the older data, marked as older |
| Chosen list empty for the spec | "Using the Overall list: Method has no Mythic+ list for Feral Druid" |
| Upgrade track data unavailable | Priority, with "Weights are approximate while upgrade track data is unavailable" |
| No dungeon credits any row | "No season dungeon drops anything you still need." A character can still have missing rows here: raid-only or crafted items credit no dungeon |

**New pieces**, in the existing layers:

- `src/core/db/queries/season.ts`: reads and the transactional season write.
- `src/core/sync/season-sync.ts`: the loader.
- `src/app/api/season/sync/route.ts`: the sync route, kept thin.
- `src/components/season-sync/SeasonSync.tsx`: the client trigger.
- `src/components/character-page/DungeonPriority.tsx`: the section.
- A `priority` field on the character page view, with its season status.

## Testing

- **Scoring engine:** the bulk of the tests. Cover the weight table, the weaker ring or trinket, the tier bonus, tier and "Any" crediting by armor type, a named item that drops nowhere, ties, the Overall fallback, and a split dungeon's shared loot.
- **Parser:** a trimmed fixture with Feral's four "Any 334" rows and a header row. It holds a few rows, not a copy of Method's page.
- **Evaluation:** any rows reaching `done` and `missing`, and never the track states.
- **Season loader:** a fake fetch and an in-memory database. Cover the map-ID join, a split dungeon, an item answering 404, and a failed load leaving the previous season intact.
- **Views:** the character page view carries priority and each state above.
- **Live check:** `npm run test:live` gains the real Raider.IO-to-journal join, so a change on Blizzard's side surfaces as a failing check rather than an empty list.

## Left for 3b

- The group page: picker, grid, group ranking with who needs what, vault lists and crest headers.
- Moving the Method and Raidbots refreshes off the render path.
- Class-colored names in the group grid's headers (#24).
- The browser test decision (#35).
