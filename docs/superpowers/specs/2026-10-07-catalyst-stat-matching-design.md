# Catalyst stat matching and honest tier credits

Status: approved by the owner on 2026-10-07. Spec review findings resolved on 2026-10-07: the pair comparison now puts known pairs before item IDs, target pairs are fetched only for tier rows with a retry backoff, view fields, tone, card counts and labels are named, and the vault rule is dropped. The owner chose how character cards count the new state (decision 3).
Date: 2026-10-07
Issue: #79. Correct dungeon catalyst item attribution and distinguish preferred BiS bases

## Goal

In Midnight Season 2 the catalyst keeps the input item's secondary stats, so a tier piece made from a Haste/Mastery chest differs from one made from a Mastery/Vers chest. The app ignores this in two places:

1. **Dungeon credits show the wrong item.** A tier row credits every dungeon that drops a chest in the right armor type, and each credit copies Method's item from the BiS row. Den of Nalorakk, Murder Row and Temple of Sethraliss all show Primordial Robe of Rites, which only Altar of Fangs drops.
2. **Any tier piece counts as BiS.** `evaluateGear` matches a tier row on `item.isTier` alone, so a tier piece with the wrong stats is `done` and its dungeon credits vanish.

This change compares secondary stats. Players are pushed toward tier pieces with Method's stats, and every credit shows the item the dungeon actually drops.

## What success looks like

- Two dungeons with different compatible chest drops never show the same item as their own drop. Each credit shows the drop from that dungeon, with that drop's icon and Wowhead tooltip.
- A dungeon whose drop has Method's stat pair is labeled **Method BiS stats**. A dungeon whose drop has other stats is labeled **catalyst alternative**, ranks lower, and says which stats it has and which Method wants. This holds in the group and character priority views.
- A Myth 6/6 tier head with the wrong stats counts toward the tier set but shows **Wrong stats**, not done, and still credits dungeons whose drop has Method's stats.
- When stats are unknown, behavior and weights match today's. The labels say "stats unverified".

## Facts this design rests on

Checked on 2026-10-07 against live APIs and the local cache.

- **The origin of a catalyzed item is not recorded.** An equipped tier piece carries the tier item ID, such as 271528, plus bonus IDs. Its only per-piece variations, 13696, 13697 and 13698, are `serverside` in Raidbots `bonuses.json`, with no decode. No base item ID survives.
- **Blizzard's equipment endpoint returns each equipped item's stats.** The `stats` entries have `type.type` values such as `HASTE_RATING`. Three tier pieces on one character carried Haste/Mastery, Crit/Haste and Crit/Mastery, so retention shows in the data.
- **Blizzard's item endpoint returns base stats in `preview_item.stats`.** Primordial Robe of Rites (273785) is Haste/Mastery. Hoarded Harvest Wrap (251147) is Mastery/Vers. Values scale with item level; the stat types don't.
- **A tier piece's own item endpoint also returns `preview_item.stats`,** with the stats a tier token gives. Examples: 271529 Enigmatic Dreamwatcher's Gauntlets is Mastery/Vers, 271528 Enigmatic Dreamwatcher's Somnolent Stare is Haste/Vers, and 271463 Pauldrons of the Consecrated Flame is Crit/Mastery. Each also lists an off-class primary with `is_negated: true`. A catalyzed piece with the same item ID can carry a different pair, so an equal item ID proves nothing once both pairs are known.
- **An unknown item ID answers 404,** and `getItemDetails` returns `null` for it.
- **SimC pastes carry no stats.** A SimC item's stat pair is unknown.
- **Great Vault items come only from SimC pastes,** so their pairs are always unknown.
- **The Blizzard client already caps parallel requests at 4** (`createLimiter(4)` in `src/core/blizzard/client.ts`), shared by every caller through `Services`.
- **Method tier rows take three shapes:**
  - a base item marked `(Tier Set)` with a plain source, such as Primordial Robe of Rites from Altar of Fangs;
  - a base item with the source `Ula'tek / Catalyst`;
  - the tier piece itself, such as 271529 from `Entombed Sentinels (Tier Token)`.

  The parser sets `isCatalyst` only for `(Catalyst)` in parentheses, so the second shape reads as `false`.

## Decisions and reasons

### 1. Compare stat pairs, not origins

Origin can't be known, but stats can. A **stat pair** is an item's set of secondary stat types: `CRIT_RATING`, `HASTE_RATING`, `MASTERY_RATING` and `VERSATILITY`. Stored sorted and comma-joined, for example `HASTE_RATING,MASTERY_RATING`. Values, primary stats, stamina and negated stats (`is_negated: true`) are ignored. An item with one secondary has a one-entry pair.

A pure function in `src/core/gear/` compares two items for a tier row:

Checked in this order:

| Result | When |
|---|---|
| `same` | Both pairs are known and equal |
| `different` | Both pairs are known and differ, even when the item IDs are equal |
| `same` | Either pair is unknown, and the item IDs are equal |
| `unknown` | Either pair is unknown, and the item IDs differ |

Known pairs always win over item IDs. For the tier-token shape, the Method row names the tier piece itself, and a catalyzed piece with that item ID can still carry another base's stats.

The target pair is the Method row item's pair. For the tier-token shape, that pair comes from the tier piece's own item endpoint, which gives the stats the token gives.

### 2. Where stat pairs come from

| Item | Source | Stored on |
|---|---|---|
| Equipped, from Blizzard | `stats` in the equipment response | new `snapshot_items.secondary_stats` |
| Equipped, from SimC | the latest Blizzard snapshot's copy of the same item ID and bonus IDs, applied when gear loads | `null` (unknown) when no copy matches |
| Method row item, tier rows only | item endpoint, `preview_item.stats` | new `item_details.secondary_stats` and `item_details.stats_fetched_at` |
| Dungeon loot | the item endpoint call season sync already makes for inventory and armor type | new `dungeon_loot.secondary_stats` |

**Encoding.** `null` means unknown, and `''` means the item has no secondaries. A response without a `stats` field gives `null`.

**Target pairs.** A new core function, `ensureTierTargets(deps, region, lists)` in `src/core/sync/reference-sync.ts`, takes `{ db, blizzard, now }` and a spec's `BisLists`. It collects the item IDs of tier rows across all three lists, about five per list, and returns `Map<number, { secondaryStats: string[] | null; isTier: boolean }>`.
- **When it fetches.** It reads `item_details` and calls the item endpoint for IDs that have no row, or whose `stats_fetched_at` is `null`. That second case covers rows written before this change.
- **Backoff.** A row whose `secondary_stats` is still `null`, after a 404 or a response without stats, is retried only when `stats_fetched_at` is older than `DAY_MS`. A thrown error stores nothing, as in today's `ensureItemDetails`. No page load repeats a lookup that just failed.
- **Concurrency.** Fetches run through the Blizzard client, whose shared `createLimiter(4)` caps them. Only tier rows are fetched, about 15 IDs per spec on a cold cache, so the home page needs no limiter of its own.
- **Callers.** The three loaders that call `ensureBisLists` (`character-cards.ts`, `character-page.ts`, `group-page.ts`) also call `ensureTierTargets` once per spec, cached alongside the BiS result, using the character's region. `BisResult` is unchanged. `MemberContext.bisFor` returns the BiS result plus the target map.
- **Write path.** `upsertItemDetails` writes the two new columns; `ensureItemDetails` keeps its current fields and doesn't touch them.

**Schema and cache.**
- **One migration** adds the nullable columns: `npm run db:generate -- --name catalyst-stat-pairs`.
- **The season cache is versioned.** `dungeon_loot` gains a column, so bump `SEASON_META_KEY` in `src/core/sync/season-sync.ts` from `season.v2` to `season.v3`.
- **A snapshot changes when its stats change, but not because stats became known.** The content hash in `snapshots.ts` keeps its current format, without stats. If adding stats changed every hash, the first Blizzard sync after this change would save a new snapshot for every character, and that snapshot would displace any newer SimC paste.
  - When the hash matches the previous snapshot from the same source, `saveSnapshotIfChanged` compares the stored stat pairs with the new ones.
  - Equal pairs: unchanged, as today.
  - Every stored pair `null` (a snapshot from before this change): the new pairs are written onto the stored rows, and the result is still unchanged.
  - Otherwise, a new snapshot. This is the re-catalyzed piece with the same item ID and bonus IDs but other stats.

**Types.**
- `GearItem`, `SnapshotItemInput` and `LootItem` gain `secondaryStats: string[] | null`. `ItemInfo` gains it from `parseItemInfo`. SimC import sets it to `null`.
- `SeasonLoot.loot` entries gain `name`, from `dungeon_loot.item_name`.
- `BisItemRow` doesn't change. `evaluateGear` and `rankDungeons` take the target map as a parameter (`targets: ReadonlyMap<number, TierTarget>`). Logic functions stay free of database access.
- `GearRow` gains `stats: 'same' | 'different' | 'unknown' | null`, the comparison result for a matched tier row, and `null` otherwise.
- `GearRowView` gains `equippedStats: string[] | null`. The `kind: 'item'` `BisView` gains `targetStats: string[] | null` and `targetIsTierPiece: boolean`, which comes from the target map's `isTier`: true for the tier-token shape.

### 3. A new state, `wrongStats`

`ItemState` gains `wrongStats`. In `evaluateGear`, a tier row still matches any tier piece in its slots, so the slot is claimed and the set count is unchanged. Then:

- `same` or `unknown`: today's track states (`done`, `mythUpgradable`, `belowMyth`).
- `different`: `wrongStats`, whatever the track. The card still shows the track, and the crest upgrade badge still appears when one is affordable.

`ITEM_STATES` order becomes `done, mythUpgradable, wrongStats, belowMyth, inBags, missing`.

Words:
- `state-badge/state-labels.ts`: `wrongStats: { text: 'Wrong stats', className: 'text-stats' }`.
- `group-grid/state-word.ts`: the word "Stats". "Wrong stats" doesn't fit the 57 px column at 390 px, where "Need tier" is the longest word today. The cell note gives the full sentence (decision 5).

Tone. Today `rowTone` highlights only `done` (gold) and `mythUpgradable` (green), and `belowMyth` has no tone.
- `RowTone` gains `'stats'`, returned for `wrongStats` when tracks are known, as the other tones are.
- `ROW_TONE_STYLES.stats` is `{ background: '#2e2513', outline: '2px dashed var(--color-gold)', outlineOffset: '-2px' }`: done's colors, because the piece is done apart from its stats (owner's choice, 2026-10-07). The dashed outline differs from the solid gold and green rings in shape, not just hue, and the word always sits beside it.
- New token in `globals.css` `@theme`: `--color-stats: #f08fc0`, for `text-stats` and `bg-stats`.

Character cards (`character-card/CharacterCard.tsx`). The owner's choice: `wrongStats` gets its own bar segment and does not count as BiS.
- The BiS total stays `done + mythUpgradable + belowMyth`.
- A `bg-stats` segment sits between `belowMyth` and the missing remainder.
- Words: `, N wrong stats` after the vault targets, shown only when N > 0, as the bags count is.
- The character page's per-list BiS counts (`bisCount` in `character-page.ts`) leave `wrongStats` rows out the same way, so the card and the page agree.

Crest upgrades. `upgradeFor` in `src/server/views/summarize.ts` offers an affordable upgrade for `wrongStats` too, beside `mythUpgradable` and `belowMyth`, because the piece is matched and its track still upgrades.

### 4. Tier credits name the local drop

`rankDungeons` rewrites tier crediting. Non-tier item rows, Any rows, ring and trinket weighting, the Overall fallback and split dungeons keep today's behavior.

**Which drop.** For a tier row, a dungeon's compatible drops are its loot in one of the row's slots and in the character's armor type, as today. Each drop is compared with the target by decision 1. The dungeon contributes at most one credit per row, from its best drop:

1. a `same` drop that is the Method row's exact item;
2. any other `same` drop;
3. an `unknown` drop;
4. a `different` drop.

The lowest item ID breaks ties within a rank. A dungeon with no compatible drop gives no credit.

"Exact" in the table below means a `same` drop, so the exact item and a same-pair base share a fit. An exact item whose known pair differs from the target can't happen for loot, because both pairs come from the same item endpoint. If it ever did, the drop would rank as `different`.

**Fit and weight.** "Today's weight" is `weightOf`: the track weight plus the tier bonus of 2 while the character has fewer than 4 tier pieces.

| Row state | Best drop | Credit fit | Weight |
|---|---|---|---|
| `missing` | exact or `same` | `bis` | today's weight |
| `missing` | `unknown` | `unverified` | today's weight |
| `missing` | `different` | `alternative` | today's weight − 1, minimum 1 |
| `wrongStats` | exact or `same` | `bis` | 1, no tier bonus |
| `wrongStats` | `unknown` or `different` | no credit | — |

The −1 is an ordinal preference, not a stat weight. An alternative still fills the slot and counts toward the set, but a dungeon with Method's stats ranks above it. A `wrongStats` piece already counts toward the set, so it gets no tier bonus. Weight 1 matches a Hero or Myth piece hunting its BiS.

**Credit shape.** The tier credit becomes:

```ts
{ kind: 'tier'; slotLabel: string; weight: number; fit: 'bis' | 'unverified' | 'alternative';
  itemId: number; name: string; bonusIds: number[];   // the dungeon's own drop
  dropStats: string[] | null; targetName: string; targetStats: string[] | null }
```

- `itemId` and `name` come from the dungeon's loot row, so the loot name has to reach `SeasonLoot` (`dungeon_loot.item_name` already exists).
- `bonusIds` is `[]`, because loot rows have none.
- `targetName` and `targetStats` describe the Method row. Labels use them, and the view never renders them as an item link.

`PriorityCreditView` mirrors these fields, and `item` is the drop's `ItemView`. Loaders include the drop item IDs in their icon lookups.

### 5. Presentation

All stat words come from one helper, `src/components/shared/stat-pair.ts`, with unit tests. It maps types to Crit, Haste, Mastery and Vers, and joins them with `/` in the stored sorted order, for example "Haste/Mastery" or "Mastery/Vers".

**Group chips** (`group-priority/CreditChip.tsx`, `chip-label.ts`). The drop's icon and Wowhead link, with the gold "T" badge.

| Fit | Label |
|---|---|
| `bis`, pair known | `Primordial Robe of Rites (Chest), Method BiS stats Haste/Mastery: catalyst into tier` |
| `bis`, pair unknown (the exact item, with no stats on either side) | `Primordial Robe of Rites (Chest), Method BiS item: catalyst into tier` |
| `alternative` | `Hoarded Harvest Wrap (Chest), catalyst alternative: Mastery/Vers, Method BiS wants Haste/Mastery` |
| `unverified` | `Hoarded Harvest Wrap (Chest), catalyst into tier, stats unverified` |

An `alternative` tile gets a dashed border, and its slot line under the tile reads "alt". The difference never relies on color alone.

**Character page** (`character-page/DungeonPriority.tsx`). An `ItemCard` for the drop, with one of these detail lines:
- `Chest · Method BiS stats · weight 5`
- `Chest · Method BiS item · weight 5` (a `bis` credit with no known pair)
- `Chest · catalyst alternative (Mastery/Vers, BiS Haste/Mastery) · weight 4`
- `Chest · stats unverified · weight 5`

**Need lines** (`group-grid/cell-note.ts`, `bis-target/BisTarget.tsx`). These come from `targetStats` and `targetIsTierPiece` on the `BisView`. "(pair)" means the target pair, as in Haste/Mastery.

| Method row shape | Pair known | Pair unknown |
|---|---|---|
| Base to catalyze (`targetIsTierPiece` false) | `Need: tier, Haste/Mastery (catalyst Primordial Robe of Rites)` | `Need: tier (catalyst Primordial Robe of Rites)` |
| Tier piece itself (`targetIsTierPiece` true) | `Need: Enigmatic Dreamwatcher's Gauntlets (tier, Mastery/Vers)` | `Need: Enigmatic Dreamwatcher's Gauntlets (tier)` |

A `wrongStats` cell's note reads `Tier, Crit/Mastery; Method BiS wants Haste/Mastery`, with the equipped pair from `equippedStats`. Both pairs are always known in that state, because `wrongStats` requires them.

**Vault choices** (`vaultChoicesFor`) don't change. Vault items come only from SimC pastes, so their pairs are always unknown, and a stat rule there would never fire. #96 revisits this when SimC items gain pairs.

### 6. Parser fix

`isCatalyst` also matches a source ending in `/ Catalyst`, and that suffix is stripped from `source` as `(Catalyst)` is today. The flag is used only for display text, never for matching or crediting. Existing cached lists pick it up on their next Method refresh. This doesn't need a version bump, because no rule depends on the flag.

## Earlier specs this supersedes

The old specs stay as written. Where they disagree with this one, this spec wins:

- `2026-09-26-gear-tracker-design.md`: "Tier rows … match when the equipped item in that slot is any tier piece" and "Tier rows credit every season dungeon that drops an item for that slot". Both are replaced by decisions 3 and 4.
- `2026-09-30-plan-3a-dungeon-priority-design.md`: the tier eligibility row, and "Tier and Any credits are text".
- `2026-10-03-group-dungeon-priority-design.md`: "Tier/Any cards have no item link and invent no item ID", plus the out-of-scope line about showing candidate drops for tier credits. Tier credits now link the real drop and still invent no ID.
- `2026-10-04-group-page-layout-design.md` decision 7: "A tier chip shows the piece the member is hunting, not the dungeon drop". Tier chips now show the drop.

## Testing

Write the failing test first. Fixtures use made-up characters and trimmed responses.

- **Blizzard parsers:** `parseEquipment` reads secondary stats and skips primaries, stamina and negated stats. `parseItemInfo` reads `preview_item.stats`. A missing `stats` field gives `null`, and one with no secondaries gives `[]`.
- **Method parser:** `Ula'tek / Catalyst` gives `isCatalyst: true` and source `Ula'tek`. `(Tier Set)` with a plain source still gives `isTier: true, isCatalyst: false`.
- **Pair compare:**
  - `same` on equal pairs regardless of order;
  - `different` on known pairs that differ, **including equal item IDs**, the token-shape case;
  - `same` on equal IDs when either pair is unknown;
  - `unknown` on different IDs when either pair is unknown.
- **`evaluateGear`:**
  - a token-shape row (the Method item is the tier piece) with an equipped piece of the same item ID but a different known pair gives `wrongStats`;
  - a different-pair tier piece at Myth 6/6 gives `wrongStats`;
  - so does one on Hero;
  - an unknown pair keeps the track state;
  - a same pair keeps the track state;
  - set count and slot claiming are unchanged.
- **`rankDungeons`:**
  - two dungeons with different compatible chest drops each credit their own drop ID;
  - Method's base marked Tier Set with no Catalyst text credits its own dungeon as `bis`;
  - a same-pair drop elsewhere is also `bis`;
  - a different pair gives `alternative` with weight − 1, and the floor holds at 1;
  - an unknown pair gives `unverified` at full weight;
  - several compatible drops in one dungeon pick by the ranking in decision 4, then lowest ID;
  - no compatible drop gives no credit;
  - a `wrongStats` row credits only `bis` drops, at weight 1;
  - a split dungeon keeps its caveat.
- **Views and labels:**
  - `creditView` uses the drop's item, never the target's;
  - `chipLabel` and the character-page detail cover each fit;
  - the `stat-pair` helper;
  - the `bis` label and detail with no known pair;
  - the need line for both row shapes, each with and without a known pair;
  - the `wrongStats` state word, badge, tone and cell note;
  - `rowTone` returns `stats` for `wrongStats` and `null` while tracks are unknown;
  - character card: a `wrongStats` row is outside the BiS total, and its words appear only when N > 0;
  - `upgradeFor` offers an affordable upgrade on a `wrongStats` row.
- **Sync:**
  - a Blizzard sync stores equipped pairs;
  - a SimC import stores `null` pairs;
  - a stat change alone produces a new snapshot;
  - a Blizzard snapshot stored without pairs is backfilled in place on the next unchanged sync, and a newer SimC paste stays current;
  - `ensureTierTargets` fetches only tier row item IDs;
  - it fetches rows whose `stats_fetched_at` is `null`;
  - a 404 stores `null` stats and isn't retried within `DAY_MS`, but is retried after it;
  - no secondaries store `''`;
  - season sync stores loot pairs and names, and `season.v3` forces a refetch.

Hand checks: on the group page, hover a tier chip in two dungeons and confirm the two tooltips name different items. Then find a character whose tier piece has stats other than Method's, and confirm "Wrong stats" in the grid and on the character page.

## Out of scope

Each of these has an idea issue on the board:

- **Stat weights.** No stat values or weights, so a better pair never outranks Method's. Weights entered by hand, or from a Pawn string or a SimC export, belong to a separate feature (#95).
- **SimC stats.** Equipped SimC pieces borrow the pair from the latest Blizzard snapshot of the same item and bonus IDs (owner's request, 2026-10-07). Bag and Great Vault items, and pieces Blizzard hasn't seen yet, stay `unknown` (#96).
- **Manual confirmation.** No "this piece has the right stats" override for unknown pieces (#97).
- **Tertiary stats, sockets and cantrips.** These also carry over through the catalyst; this design ignores them (#98).
