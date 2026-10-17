# Weapon types a class can use

Status: written for the unattended loop on 2026-10-17 while the owner is away; the owner reviews it with the pull request. Owner answers on #172: 1. a table of weapon types per class; 2. off-hand rules (shields, held-in-off-hand items, dual wield) are part of the same check. Spec review round 1 (Opus reviewer; Codex was out of usage) folded in: S1.1 old catalog rows refetch and reads fall back to loot; S1.2 the check applies to the editor and dungeon ranking only; S1.3 Titan's Grip is out of scope with a follow-up; S1.4 the off-hand column is a usage rule and is worded so; S1.5 Devourer Demon Hunter weapons flagged for the owner; S1.6 every mapper listed; S1.7 weapon words defined.
Date: 2026-10-17
Issues: #172. Stacked on PR #187 (#171), itself on PR #186; all three touch `src/core/priority/rank.ts`.

## Goal

The BiS editor refuses a weapon or off-hand item the character's class can't use, with the reason in words. Dungeon ranking stops crediting an Any weapon or off-hand row with a drop the class can't use. The loot tab's "Needed by" needs no change: it skips Any rows and matches weapons by item ID, which the editor now guards.

## Decisions

- **A table per class, keyed by weapon type** (owner answer 1). The class side is a hand-written table in `src/core/priority/weapons.ts`. The item side still needs to know an item's weapon type: Blizzard gives it as the item's subclass (`item_class` 2, `item_subclass` id), so it is parsed and stored next to `armorType`. Inventory type alone can't tell a two-handed axe from a staff.
- **Unknown means allowed.** An item with no stored weapon type (a parse miss) passes the check, as an item with no armor type passes today.
- **Old catalog rows refetch on use.** `ensureItem` treats a catalog row whose inventory type is a weapon (`WEAPON`, `WEAPONMAINHAND`, `WEAPONOFFHAND`, `TWOHWEAPON`, `RANGED`, `RANGEDRIGHT`) and whose weapon type is null as incomplete and fetches it from Blizzard again. `findLocalItem` and `searchLocalItems` take the catalog value and fall back to the loot row's when the catalog's is null, so search results know weapon types as soon as the season reloads.
- **Titan's Grip is out of scope.** A two-hander only fits the main hand today (`slotsForInventoryType`), so a Fury Warrior's second two-hander in an Off Hand row is refused before and after this change. A follow-up issue covers it.
- **Season loot is refetched once:** `dungeon_loot` gains a column, so `SEASON_META_KEY` goes to `season.v7`.
- **Class level, not spec level.** Dual wield is allowed for the class when any of its specs can dual wield (Death Knight, Demon Hunter, Monk, Rogue, Shaman, Warrior). A Holy Paladin picking a second one-hander isn't stopped. Specs that can't dual wield within a dual-wield class are left for a follow-up if it matters.

## Data

- `WeaponType` in `src/core/types.ts`: `axe1h`, `axe2h`, `bow`, `gun`, `mace1h`, `mace2h`, `polearm`, `sword1h`, `sword2h`, `warglaive`, `staff`, `fist`, `dagger`, `crossbow`, `wand`. Parsed from weapon subclass ids 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15, 18, 19. Other ids give null.
- `parseItemInfo` returns `weaponType` (only for `item_class` 2).
- Columns `weapon_type` (nullable text) on `item_catalog` and `dungeon_loot`; `npm run db:generate -- --name weapon_types`.
- Types carrying it: `ItemInfo` (`src/core/blizzard/types.ts`), `CatalogItem`, `LootItem`, `DungeonLootRow`.
- Every mapper that must copy it, each with a read-back test: `parseItemInfo`; `fromCatalog` and `fromLoot` in `src/core/db/queries/item-catalog.ts`; `upsertCatalogItem`; the item literal in `ensureItem` (`src/core/bis/edits.ts`); the loot rows built in `loadSeasonLoot`; the loot mapping in `getSeasonLoot`.
- `SEASON_META_KEY` to `season.v7`, comment updated.

## The table

`src/core/priority/weapons.ts`:

```ts
interface ClassWeapons { weapons: ReadonlySet<WeaponType>; shield: boolean; holdable: boolean; dualWield: boolean }
export const CLASS_WEAPONS: Record<string, ClassWeapons>
```

| Class | Weapons | Shield | Held in off hand | Dual wield |
|---|---|---|---|---|
| Death Knight | axe1h, axe2h, mace1h, mace2h, polearm, sword1h, sword2h | no | no | yes |
| Demon Hunter | warglaive, axe1h, fist, sword1h | no | no | yes |
| Druid | dagger, fist, mace1h, mace2h, polearm, staff | no | yes | no |
| Evoker | axe1h, axe2h, dagger, fist, mace1h, mace2h, sword1h, sword2h, staff | no | yes | no |
| Hunter | axe1h, axe2h, bow, crossbow, dagger, fist, gun, polearm, staff, sword1h, sword2h | no | no | no |
| Mage | dagger, sword1h, staff, wand | no | yes | no |
| Monk | axe1h, fist, mace1h, polearm, staff, sword1h | no | yes | yes |
| Paladin | axe1h, axe2h, mace1h, mace2h, polearm, sword1h, sword2h | yes | yes | no |
| Priest | dagger, mace1h, staff, wand | no | yes | no |
| Rogue | axe1h, dagger, fist, mace1h, sword1h | no | no | yes |
| Shaman | axe1h, axe2h, dagger, fist, mace1h, mace2h, staff | yes | yes | yes |
| Warlock | dagger, staff, sword1h, wand | no | yes | no |
| Warrior | axe1h, axe2h, dagger, fist, mace1h, mace2h, polearm, staff, sword1h, sword2h | yes | no | yes |

Weapons, shields and dual wield follow the game's proficiencies. "Held in off hand" is a usage rule, not a game restriction: any class can equip one, but only the classes marked yes ever list one, so a "no" class picking one is almost surely a mistake. Devourer, the Midnight Demon Hunter spec, may use other weapon types; the PR asks the owner to check. A class the table doesn't know passes everything.

Words for each weapon type (`WEAPON_WORDS`), used in reasons: axe1h "one-handed axes", axe2h "two-handed axes", bow "bows", gun "guns", mace1h "one-handed maces", mace2h "two-handed maces", polearm "polearms", sword1h "one-handed swords", sword2h "two-handed swords", warglaive "warglaives", staff "staves", fist "fist weapons", dagger "daggers", crossbow "crossbows", wand "wands".

`weaponUse(item: { inventoryType; weaponType }, className, slot: 'MAIN_HAND' | 'OFF_HAND'): CanUse`:

- A known `weaponType` the class's set lacks: `"<Class> can't use <words>."` (for example "Mage can't use two-handed axes.").
- `SHIELD` without `shield`: "<Class> can't use shields." `HOLDABLE` without `holdable`: "<Class> doesn't use off-hand items."
- A weapon (`WEAPON` or `WEAPONOFFHAND`) in `OFF_HAND` without `dualWield`: "<Class> can't dual wield."
- Anything else: ok. Rings, armor and so on never reach it.

## Where it applies

- `classCanUse` (`src/core/bis/class-can-use.ts`) calls `weaponUse` when the row's slots include `MAIN_HAND` or `OFF_HAND` (using the row slot the item fits; `OFF_HAND` when the row is only the off hand). The editor's existing "can't use" path shows the reason.
- `fitsSlot` in `rank.ts` takes the class name instead of the armor type (it works the armor type out itself) and checks `weaponUse` for weapon slots, so Any weapon rows in `rankDungeons` skip unusable drops. Its callers in `drop-needs.ts` and `src/server/views/dungeon-loot-needs.ts` pass the class name; their results don't change, since they only call it for tier rows.

## Testing

- `parse.test.ts`: weapon subclasses map, armor items give null, unknown subclass gives null.
- `weapons.test.ts`: a weapon outside the class set refused with words; shield, holdable and dual-wield rules; unknown weapon type allowed; unknown class allowed; a two-hander in main hand allowed for a class that has it.
- `class-can-use.test.ts`: Mage choosing a two-handed axe for Main Hand refused; Warrior choosing a shield for Off Hand allowed; Druid choosing a one-hander for Off Hand refused.
- `priority.test.ts`: an Any Main Hand row isn't credited by an unusable drop and is by a usable one; an Any Off Hand row isn't credited by a shield for a Mage.
- Catalog tests: an old weapon row with null weapon type is refetched by `ensureItem`; search falls back to the loot value.
- Season sync and catalog tests: `weaponType` stored and read back; `season.v7` assertion.
- Gate: typecheck, lint, test, build.
