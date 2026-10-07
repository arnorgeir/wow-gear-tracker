# Catalyst stat matching and honest tier credits

Status: design approved by the owner on 2026-10-07; written spec awaiting the owner's review.
Date: 2026-10-07
Issue: #79. Correct dungeon catalyst item attribution and distinguish preferred BiS bases

## Goal

In Midnight Season 2 the catalyst keeps the input item's secondary stats, so a tier piece made from a Haste/Mastery chest differs from one made from a Vers/Mastery chest. The app ignores this in two places:

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
- **Blizzard's item endpoint returns base stats in `preview_item.stats`.** Primordial Robe of Rites (273785) is Haste/Mastery. Hoarded Harvest Wrap (251147) is Vers/Mastery. Values scale with item level; the stat types don't.
- **SimC pastes carry no stats.** A SimC item's stat pair is unknown.
- **Method tier rows take three shapes:**
  - a base item marked `(Tier Set)` with a plain source, such as Primordial Robe of Rites from Altar of Fangs;
  - a base item with the source `Ula'tek / Catalyst`;
  - the tier piece itself, such as 271529 from `Entombed Sentinels (Tier Token)`.

  The parser sets `isCatalyst` only for `(Catalyst)` in parentheses, so the second shape reads as `false`.

## Decisions and reasons

### 1. Compare stat pairs, not origins

Origin can't be known, but stats can. A **stat pair** is an item's set of secondary stat types: `CRIT_RATING`, `HASTE_RATING`, `MASTERY_RATING` and `VERSATILITY`. Stored sorted and comma-joined, for example `HASTE_RATING,MASTERY_RATING`. Values, primary stats, stamina and negated stats (`is_negated: true`) are ignored. An item with one secondary has a one-entry pair.

A pure function in `src/core/gear/` compares two items for a tier row:

| Result | When |
|---|---|
| `same` | Item IDs are equal, or both pairs are known and equal |
| `different` | Both pairs are known and differ |
| `unknown` | Either pair is unknown |

The target pair is the Method row item's pair. For the tier-token shape, that item is the tier piece itself, and its pair is still the right target.

### 2. Where stat pairs come from

| Item | Source | Stored on |
|---|---|---|
| Equipped, from Blizzard | `stats` in the equipment response | new `snapshot_items.secondary_stats` |
| Equipped, from SimC | none | `null` (unknown) |
| Method row item | item endpoint, `preview_item.stats` | new `item_details.secondary_stats` |
| Dungeon loot | item endpoint, during season sync | new `dungeon_loot.secondary_stats` |

- **`null` means unknown, and `''` means the item has no secondaries.** `ensureItemDetails` refetches rows whose `secondary_stats` is `null`, so rows from before this change fill in once. After a failed lookup the value stays `null`, and the next page load retries, as today's details lookups do.
- **`ensureItemDetails` must cover the priority list's Method item IDs,** not only SimC items, so the engine gets target pairs. Every loader that evaluates gear passes them.
- **One migration** adds the three nullable text columns: `npm run db:generate -- --name catalyst-stat-pairs`.
- **The season cache is versioned.** `dungeon_loot` gains a column, so bump `SEASON_META_KEY` in `src/core/sync/season-sync.ts`.
- **A snapshot changes when its stats change.** The snapshot-change key in `snapshots.ts` includes the stat pair, so a re-catalyzed piece with the same item ID and bonus IDs still produces a new snapshot.
- **The types:** `GearItem`, `LootItem` and `ItemDetails` gain `secondaryStats: string[] | null`. `BisItemRow` has no column for it. Loaders join the target pair from `item_details` and pass it to the logic functions as a map keyed by item ID. Logic functions stay free of database access.

### 3. A new state, `wrongStats`

`ItemState` gains `wrongStats`. In `evaluateGear`, a tier row still matches any tier piece in its slots, so the slot is claimed and the set count is unchanged. Then:

- `same` or `unknown`: today's track states (`done`, `mythUpgradable`, `belowMyth`).
- `different`: `wrongStats`, whatever the track. The card still shows the track, and the crest upgrade badge still appears when one is affordable.

`ITEM_STATES` order becomes `done, mythUpgradable, wrongStats, belowMyth, inBags, missing`.

Words and tone:
- The state badge says "Wrong stats".
- The group grid's state word says "Wrong stats".
- The row tone sits between `mythUpgradable` and `belowMyth`. It differs from both in lightness, not just hue, and gets a new semantic token in `globals.css`, not a hardcoded hex.
- Character card counts include the new state.

The word always appears beside the color.

### 4. Tier credits name the local drop

`rankDungeons` rewrites tier crediting. Non-tier item rows, Any rows, ring and trinket weighting, the Overall fallback and split dungeons keep today's behavior.

**Which drop.** For a tier row, a dungeon's compatible drops are its loot in one of the row's slots and in the character's armor type, as today. The dungeon contributes at most one credit per row, from its best drop:

1. the Method row's exact item;
2. a drop with a `same` pair;
3. a drop with an `unknown` pair;
4. a drop with a `different` pair.

The lowest item ID breaks ties within a rank. A dungeon with no compatible drop gives no credit.

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

All stat words come from one helper, `src/components/shared/stat-pair.ts`, with unit tests. It maps types to Crit, Haste, Mastery and Vers, and joins them with `/`, for example "Haste/Mastery".

**Group chips** (`group-priority/CreditChip.tsx`, `chip-label.ts`). The drop's icon and Wowhead link, with the gold "T" badge.

| Fit | Label |
|---|---|
| `bis` | `Hoarded Harvest Wrap (Chest), Method BiS stats Haste/Mastery: catalyst into tier` |
| `alternative` | `Hoarded Harvest Wrap (Chest), catalyst alternative: Vers/Mastery, Method BiS wants Haste/Mastery` |
| `unverified` | `Hoarded Harvest Wrap (Chest), catalyst into tier, stats unverified` |

An `alternative` tile gets a dashed border, and its slot line under the tile reads "alt". The difference never relies on color alone.

**Character page** (`character-page/DungeonPriority.tsx`). An `ItemCard` for the drop, with one of these detail lines:
- `Chest · Method BiS stats · weight 5`
- `Chest · catalyst alternative (Vers/Mastery, BiS Haste/Mastery) · weight 4`
- `Chest · stats unverified · weight 5`

**Need lines** (`group-grid/cell-note.ts`, `bis-target/BisTarget.tsx`). A tier need names the target pair and the base: `Need: tier, Haste/Mastery (catalyst Primordial Robe of Rites)`. The pair is left out when unknown. A `wrongStats` cell's note reads `Tier, Crit/Mastery; Method BiS wants Haste/Mastery`.

**Vault choices** (`vaultChoicesFor`). A tier vault item is flagged BiS only when its pair is `same` or `unknown`. SimC vault items have no stats, so they stay `unknown` and are flagged as today.

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
- **Pair compare:** `same` on equal pairs regardless of order, `same` on equal IDs with unknown pairs, `different`, and `unknown` when either side is unknown.
- **`evaluateGear`:**
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
  - the need line with and without a known pair;
  - the `wrongStats` state word, badge and tone.
- **Sync:**
  - a Blizzard sync stores equipped pairs;
  - a stat change alone produces a new snapshot;
  - `ensureItemDetails` refetches `null` rows and stores `''` for no secondaries;
  - season sync stores loot pairs, and the bumped meta key forces a refetch.

Hand checks: on the group page, hover a tier chip in two dungeons and confirm the two tooltips name different items. Then find a character whose tier piece has stats other than Method's, and confirm "Wrong stats" in the grid and on the character page.

## Out of scope

Each of these has an idea issue on the board:

- **Stat weights.** No stat values or weights, so a better pair never outranks Method's. Weights entered by hand, or from a Pawn string or a SimC export, belong to a separate feature (#95).
- **SimC stats.** SimC tier pieces stay `unknown`. Borrowing the pair from a Blizzard snapshot of the same item and bonus IDs is a separate change (#96).
- **Manual confirmation.** No "this piece has the right stats" override for unknown pieces (#97).
- **Tertiary stats, sockets and cantrips.** These also carry over through the catalyst; this design ignores them (#98).
