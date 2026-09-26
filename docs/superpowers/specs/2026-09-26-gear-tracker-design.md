# WoW gear tracker: design

- **Status:** Draft for review
- **Date:** 2026-09-26
- **Scope:** First version (gear tracking and group dungeon priority)

## Summary

A local web app that tracks World of Warcraft characters' gear against Method.gg's best-in-slot (BiS) lists. It shows what each character still needs, how far their BiS items are upgraded, and which Mythic+ dungeons a group should run together to get the most upgrades.

The app runs locally first. The repo is public on GitHub so friends can contribute. Hosting comes later and must not require a redesign.

## Goals

1. Track several characters, your own and friends', in one app.
2. Compare each character's gear to Method's Overall, Raid and Mythic+ BiS lists for their spec.
3. Show each BiS item's upgrade state, and highlight fully upgraded Myth-track BiS items.
4. Rank the season's Mythic+ dungeons by how many needed upgrades they drop, for one character or a group.
5. Accept a pasted SimulationCraft (SimC) string for instant gear updates without logging out.
6. Show each character's upgrade crests, and flag BiS items the character can upgrade right now.

## Non-goals for the first version

- Hosting, user accounts, or login. The app runs on localhost.
- Mythic+ statistics such as completed keys, levels and timed runs. This is a later project with its own spec.
- A dungeon loot browser page. The loot data is stored, but only used for scoring.
- Raid boss priority. Priority covers Mythic+ dungeons only.
- A custom in-game addon or file watcher.
- Scheduled background syncing.

## Decisions

| Topic | Decision |
|---|---|
| Stack | Next.js (App Router) with React and TypeScript in strict mode. |
| Storage | SQLite through Drizzle ORM and the libSQL client. A local file now, Turso when hosted. |
| Styling | Tailwind CSS, dark theme, WoW item quality colors. |
| Package manager | npm. |
| BiS source | Method.gg gearing pages, parsed from HTML. |
| Priority list | Each character's Mythic+ BiS list by default, with a per-character switch to Overall. |
| Tracks | Decoded from bonus IDs using Raidbots' public bonus data. |
| Live gear | SimC string paste, in addition to the Blizzard API. |
| Character search | Raider.IO's undocumented search endpoint, with a manual realm picker as fallback. |
| Loot tables | Blizzard's Encounter Journal API, for the season's dungeons from Raider.IO. |

## Architecture

One Next.js app. All logic lives in plain TypeScript modules under `src/core` that don't import Next.js or React. Pages and route handlers stay thin: they call a core function and render the result. This keeps the option open to move logic into a separate Node service or worker later without a rewrite.

```
src/
  core/                  plain TypeScript, no Next.js or React
    blizzard/            token cache, profile, equipment, realms, journal, items, media
    raiderio/            character search, season dungeon list
    method/              fetch and parse BiS tables
    raidbots/            bonus ID to track decoding
    simc/                SimC string parser
    gear/                BiS matching and item states
    priority/            dungeon weights and group ranking
    db/                  schema, database client, queries
    sync/                refresh orchestration, staleness, snapshot rules
  app/                   Next.js pages and route handlers
  components/            React UI components
```

`src/core` has three kinds of modules:

- **Clients** (`blizzard`, `raiderio`, `method`, `raidbots`) fetch and parse external data. They never touch the database.
- **Logic** (`gear`, `priority`, `simc`) is pure functions with no network or database access.
- **Sync** is the only layer that combines clients and the database.

### Code principles

- **Single responsibility.** Each module has one job, as listed above.
- **Open/closed.** BiS data comes through a `BisSource` interface. Adding another source, like Wowhead, doesn't change matching or scoring code.
- **Liskov substitution.** Any `BisSource` or client implementation can replace another, including test fakes.
- **Interface segregation.** Logic functions take only the data they need, never a database client or a whole character record.
- **Dependency inversion.** Sync functions receive their clients and database as parameters, so tests pass in fakes.
- **No enterprise patterns.** No class hierarchies, dependency injection containers, or interfaces with a single implementation other than `BisSource`. Plain functions and TypeScript types are the default.

## External data sources

| Source | Used for | Endpoint | Auth |
|---|---|---|---|
| Blizzard OAuth | Access token | `POST https://oauth.battle.net/token` | Client credentials |
| Blizzard Profile API | Character profile, active spec, class | `/profile/wow/character/{realm}/{name}` | Token, `profile-{region}` namespace |
| Blizzard Profile API | Equipped items | `/profile/wow/character/{realm}/{name}/equipment` | Token, `profile-{region}` namespace |
| Blizzard Game Data API | Realm list for the fallback picker | `/data/wow/realm/index` | Token, `dynamic-{region}` namespace |
| Blizzard Game Data API | Dungeon bosses and loot | `/data/wow/journal-instance/{id}`, `/data/wow/journal-encounter/{id}` | Token, `static-{region}` namespace |
| Blizzard Game Data API | Item slot type, armor type, icon | `/data/wow/item/{id}`, `/data/wow/media/item/{id}` | Token, `static-{region}` namespace |
| Raider.IO (undocumented) | Character search by name | `https://raider.io/api/search?term={name}` | None |
| Raider.IO (documented) | Current season's dungeons | `/api/v1/mythic-plus/static-data?expansion_id={id}` | None, rate limited |
| Method.gg | BiS lists per spec | `https://www.method.gg/guides/{spec}-{class}/gearing` | None, HTML |
| Raidbots | Bonus ID to track name, step and max | `https://www.raidbots.com/static/data/live/bonuses.json` | None |
| Wowhead | Hover tooltips in the UI | Tooltip script tag | None |

Notes:

- Blizzard's profile data updates after a character logs out, sometimes with extra delay.
- Raider.IO's search endpoint is undocumented and may change. It only suggests characters. Everything after selection uses official APIs.
- Raider.IO realm slugs can differ from Blizzard's, for example `azjolnerub` versus `azjol-nerub`. Map realms by Blizzard realm ID, which Raider.IO returns as `wowRealmId`, not by slug.
- Method has no API. The app fetches each spec's page at most once a day and keeps the parsed result.

## Data model

| Table | Columns (main ones) |
|---|---|
| `characters` | id, region, realm ID, realm slug, realm name, name, class, active spec, spec override, priority list (`mythicPlus` or `overall`), status (`ok` or `notFound`), last synced at, added at |
| `gear_snapshots` | id, character ID, source (`blizzard` or `simc`), created at, content hash |
| `snapshot_items` | snapshot ID, location (`equipped`, `bag` or `vault`), slot, item ID, name, item level, quality, bonus IDs, is tier |
| `snapshot_currencies` | snapshot ID, currency ID, name, quantity (SimC snapshots only) |
| `bis_lists` | id, spec slug, list type (`overall`, `raid`, `mythicPlus`), fetched at |
| `bis_items` | list ID, slot label, allowed slots, item ID, name, bonus IDs, is tier, is catalyst, source text |
| `season_dungeons` | id, season slug, name, Blizzard journal instance ID, Raider.IO dungeon ID, challenge mode ID |
| `dungeon_loot` | dungeon ID, encounter ID, encounter name, item ID |
| `items` | item ID, name, inventory type, item class, armor subclass, icon URL |
| `upgrade_tracks` | bonus ID, track name, step, max step, upgrade currency ID, upgrade cost per step, fetched at |

Rules:

- A new gear snapshot is saved only when the content hash differs from the character's latest snapshot. Repeated refreshes without gear changes add no rows.
- Snapshots are kept as history, to allow a gear timeline later.
- Group selections are not stored. The group page takes character IDs in the URL, for example `/group?chars=12,15`.
- The database file lives in a gitignored `data/` folder.

## Domain rules

### BiS matching

Each BiS row is matched against the character's current gear:

- **Normal rows** match when an equipped item in the row's slot has the same item ID.
- **Tier rows** (Method marks them "(Tier Set)") match when the equipped item in that slot is any tier piece. Blizzard's equipment data marks tier pieces with an item set. Method lists the catalyst source item, not the tier piece.
- **Ring and trinket rows** match an item in either of the two slots. Exact matches are assigned first, so one item can't satisfy two rows.

Method slot labels map to Blizzard slot types: Head to `HEAD`, Neck to `NECK`, Shoulders to `SHOULDER`, Cloak to `BACK`, Chest to `CHEST`, Wrist to `WRIST`, Gloves to `HANDS`, Belt to `WAIST`, Legs to `LEGS`, Boots to `FEET`, Ring to `FINGER_1` or `FINGER_2`, Trinket to `TRINKET_1` or `TRINKET_2`, Weapon to `MAIN_HAND`, and Off Hand to `OFF_HAND`.

### Item states

Each BiS row gets one state:

| State | Condition | Shown as |
|---|---|---|
| `missing` | The slot doesn't hold the BiS item. | Plain row, with the BiS item and where it drops. |
| `inBags` | The BiS item is in the character's bags (SimC data only). | "In your bags" badge. |
| `belowMyth` | The BiS item is equipped, on a track below Myth. | "Great Vault target" badge. |
| `mythUpgradable` | The BiS item is equipped on Myth track, below max step. | "Upgrade with crests" badge, with the step, for example "Myth 3/6". |
| `done` | The BiS item is equipped on Myth track at max step, or it has no track. | Bright golden border. |

A track is read from the item's bonus IDs using Raidbots' data. If no bonus ID decodes to a track, the item shows its item level only. A BiS item with no track, like some special trinkets, counts as `done` because it can't be upgraded.

### Dungeon priority

Priority uses each character's selected spec and priority list. The list is Mythic+ by default, or Overall if switched. Only items that drop in the current season's dungeons count, according to Blizzard's journal.

A BiS row counts toward priority only in the `missing` state. `belowMyth` rows don't count, because Myth-track copies only come from the Great Vault. `inBags` rows don't count, because the character already owns the item.

Each counted row gets a weight based on the character's current item in that slot:

| Current item in the slot | Weight |
|---|---|
| Empty, or Veteran track or lower | 3 |
| Champion track, or no track | 2 |
| Hero or Myth track | 1 |

For ring and trinket rows, the weaker of the two unmatched items sets the weight.

**Tier bonus.** If the row is a tier row and the character has fewer than 4 tier pieces equipped, the row gets +2.

**Which dungeons a row credits:**

- **Normal rows** credit the dungeon that drops the BiS item.
- **Tier rows** credit every season dungeon that drops an item for that slot in the character's armor type, since the catalyst accepts any of them. Armor type comes from class: cloth, leather, mail or plate.

A dungeon's score is the sum of the weights it's credited with, across all selected characters. Ties are broken by the number of characters who get at least one credited row. Each dungeon lists who benefits and which items.

### Item quality

Each item card is colored by the item's actual quality: Uncommon, Rare, Epic and so on. The icon border and item name use the quality color, and the card gets a matching tint and border.

- **Blizzard data:** use the `quality` field on each equipped item.
- **SimC data:** derive quality from the bonus IDs using Raidbots' data. If no bonus ID sets a quality, use the item's base quality from the `items` table.

Blizzard's item catalog endpoint only returns base quality, which is often lower than the equipped copy's. Never use it for equipped items when better data exists.

The `done` state's golden ring sits outside the quality border, so both stay visible.

### Crests and upgrade flags

Crest counts come only from SimC pastes. The SimC addon writes them in the `# upgrade_currencies=` comment line, as `c:<currency ID>:<quantity>` entries separated by `/`. Catalyst charges come from the `# catalyst_currencies=` line. Blizzard's API doesn't expose currencies.

A BiS item gets a "Can upgrade" flag when all of these are true:

- It's equipped and in the `mythUpgradable` or `belowMyth` state.
- It's below its track's max step.
- The character has at least one step's cost in that track's crest, per Raidbots' upgrade cost data.

The flag shows how many steps the character can afford for that item alone. Crests are a shared pool, so the character's crest summary shows the total steps the crests cover. Non-BiS items never get the flag, since crests spent on them are wasted once the BiS item drops.

If the latest snapshot comes from Blizzard, crests show as unknown with a prompt to paste SimC.

### Great Vault list

Per character, the Great Vault list shows:

- Every BiS row in the `belowMyth` state.
- Current Great Vault choices from the latest SimC paste, marked when a choice is a BiS item.

### SimC paste

The character page accepts a SimC string from the in-game `/simc` command. The parser reads:

- **Header lines:** class and character name, region, server and spec.
- **Equipped items:** one line per slot, like `head=,id=...,bonus_id=a/b/c`. The item name and level come from the comment line above each item.
- **Bag items:** commented item lines under the `### Gear from Bags` heading.
- **Great Vault choices:** commented item lines under the `### Weekly Reward Choices` heading.

If the string's name, realm or region doesn't match the character, the app rejects it and says which field didn't match. Realm names are compared after normalizing: lowercase, with spaces, dashes, underscores and apostrophes removed.

**Precedence between SimC and Blizzard data.** After a SimC paste, the pasted gear stays current until Blizzard's equipment data changes compared with the last Blizzard fetch before the paste. A change on Blizzard's side means the character logged out after the paste, so Blizzard's data is at least as new. The character page shows which source is current and its age, for example "From SimC, pasted 20 minutes ago".

## Pages

### Characters (`/`)

- An add bar with a region dropdown, defaulting to EU, and a name search field.
- The search waits until you pause typing and until at least 3 characters are entered. It then shows matches as "Name - Realm", with class and avatar.
- Picking a match confirms the character through Blizzard's profile endpoint, saves it, and runs the first sync.
- If search fails or finds nothing, you can type the name and pick the realm from Blizzard's realm list.
- A card per character shows avatar, name and realm, spec, BiS progress for its priority list, gear source and age, and a remove action.
- Characters with status `notFound` show a warning with remove and search again actions.

### Character page (`/characters/[id]`)

- Tabs switch between the Overall, Raid and Mythic+ lists.
- Each slot row shows the equipped item's icon, name, item level and track, the BiS item, and the state badge.
- `done` rows get the golden border.
- A spec dropdown compares against another spec of the same class.
- A switch sets whether the Mythic+ or Overall list drives this character's priority.
- The SimC paste box, a **Refresh** button, and the current gear source and age.
- The Great Vault list and this character's own dungeon priority.

### Group page (`/group?chars=...`)

- A character picker that updates the URL.
- A grid with slots as rows and characters as columns. Each cell is colored by item state.
- The dungeon priority list: dungeon, score, and who needs which items from it.
- Each character's Great Vault list.

Every item card shows the item's icon, from Blizzard's media endpoint and cached in the `items` table. Hovering an item shows Wowhead's tooltip. Each item links to `https://www.wowhead.com/item={id}` with the item's bonus IDs in the Wowhead link data, so the tooltip shows the right item level, track and stats. Wowhead's tooltip script is loaded once in the root layout.

The group page shows each character's crest counts in the grid header. Character cards show a one-line crest summary.

## Data refresh

| Data | Refresh rule |
|---|---|
| Gear and active spec | On page load, in the background, when the last sync is over 5 minutes old. Always on **Refresh**. |
| Method BiS lists | Daily, only for specs a tracked character uses. |
| Raidbots track data | Daily. |
| Season dungeons, loot and items | When Raider.IO reports a new main season. Checked daily. |
| Blizzard access token | Kept in memory until expiry. Renewed on a 401 response. |

Pages render immediately from the database. A client component then calls a sync route handler for stale characters. When the sync finishes, the page refreshes in place.

Sync limits itself to 4 parallel requests per external service. If two requests refresh the same character at once, the second one waits for the first instead of starting its own.

## Error handling

A failed refresh never blanks a page. The page shows the last good data with its age and a short note about what failed.

| Failure | Behavior |
|---|---|
| Character returns 404 | Status set to `notFound`. The card offers remove and search again. |
| Method page parses to zero rows | Keep the previous list. Show "BiS list couldn't be updated". |
| Raider.IO search fails | Show the manual realm picker. |
| Bonus ID missing from Raidbots data | Show item level without a track. |
| HTTP 429 from any service | Wait for the `Retry-After` time, then retry once. |
| SimC string doesn't match the character | Reject it and name the mismatched field. |
| SimC string can't be parsed | Reject it with the line that failed. |
| Missing credentials in `.env` | Show a setup page pointing to the README. |

## Testing

- **Tools:** Vitest, TypeScript type checks, and ESLint.
- **Logic** (`gear`, `priority`, the SimC precedence rule): unit tests written before the code.
- **Parsers** (Method HTML, SimC, Raidbots, Blizzard and Raider.IO responses): unit tests against fixture files.
- **Sync:** integration tests with fake clients and an in-memory SQLite database. They cover staleness, snapshot deduplication, shared in-progress refreshes, and error fallbacks.
- **Live checks:** `npm run test:live` calls the real services with the contributor's `.env`. It is opt-in and never runs in CI.
- **UI:** no browser tests in the first version.

Because the repo is public:

- Fixtures use made-up character names and trimmed pages. They never contain real characters or full copies of third-party pages.
- GitHub Actions runs type checks, lint and tests on every pull request. Branch protection on `main` requires those checks and a review.

## Setup and contribution

- Each contributor registers their own Battle.net API client and fills a local `.env` from `.env.example`.
- `.env`, the `data/` folder and cache folders are gitignored.
- The README covers registering a client, filling `.env`, and running `npm install` and `npm run dev`.
- Node.js 24 or later.

## Future work

- Mythic+ statistics from Raider.IO's documented API.
- A dungeon loot browser page.
- A nightly sync script that calls the sync module.
- A custom addon with a saved variables file watcher.
- Hosting on Vercel with Turso, plus a way to restrict who can edit the character list.
- A gear timeline built from snapshot history.

## Risks

| Risk | Mitigation |
|---|---|
| Method changes its page layout | Parser tests, live checks, and keeping the previous list on failure. |
| Raider.IO changes or removes its search endpoint | Isolated in one module, with the manual realm picker as fallback. |
| Raidbots data format changes | Isolated in one module. Items fall back to item level only. |
| Blizzard data lags until logout | SimC paste for instant updates. |
