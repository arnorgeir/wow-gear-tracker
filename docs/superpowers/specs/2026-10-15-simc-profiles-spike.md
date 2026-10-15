# Spike: SimulationCraft profiles as a BiS source

Issue: #127. Related: #124 (BiS sources spike), #125 (BiS source per spec).
Checked: 2026-10-15, Midnight Season 2 (`MID2`). Read from `simulationcraft/simc`, branch `midnight`, and compared with Method lists cached in a local `data/app.db`.

## Summary

| Question | Answer |
|---|---|
| Where | `profiles/MID2/MID2_<Class>_<Spec>[_<Hero>].simc` on the `midnight` branch. Raw files from `raw.githubusercontent.com` answer 200 with no bot check. |
| Spec coverage | 29 of 40 specs. No healers, no Augmentation. Balance, Guardian and Devastation had MID1 profiles but are still commented out for MID2. |
| Freshness | Season folder set up 2026-07-25, most specs filled 2026-08-05 to 08-12, some weeks later. Gear lines still change about weekly. |
| Raid only? | No. The name means a raid-style sim: one target, full raid buffs. The gear mixes raid, Mythic+ and crafted items. There is one set per profile, with no Raid, Mythic+ or Overall split. |
| Item format | `id=` plus `bonus_id=` (`/`-separated), sometimes `ilevel=`, `crafted_stats=`, `redirected_base_stats=`. Our SimC parser reads it already, apart from `ilevel=`. |
| License | GPL-3.0 repo. We would store item IDs per slot, which are facts, and link back. |

**Recommendation for #125: don't add SimC as a BiS source. If a sim view is wanted later, show it as a labelled "sim gear set", not a BiS list.**

## Where the profiles live

- The repo's default branch is the current expansion (`midnight`). Each season gets its own folder: `profiles/MID1/`, `profiles/MID2/`. The URL needs the season prefix, so it can't be hardcoded across seasons.
- `profiles/MID2_Raid.simc` lists the active profiles, one per line. Commented-out lines (`# MID2_Druid_Balance.simc`) are profiles that aren't ready. It is a good index to read instead of listing the folder.
- 47 files cover 29 specs. Hero-talent variants get their own file (`MID2_Mage_Frost_Frostfire.simc`); the file without a suffix is the default hero tree.
- Fetching: `raw.githubusercontent.com` returned 200 with `Cache-Control: max-age=300`, about 11 KB per file. No API key needed. The GitHub contents API also works but is limited to 60 requests an hour without a token, so raw files are the better path.

## Coverage

| Covered (29) | Missing (11) |
|---|---|
| All Death Knight, Demon Hunter (Devourer, Havoc, Vengeance), Hunter, Mage, Rogue, Warlock and Warrior specs. Feral, Brewmaster, Windwalker, Protection and Retribution Paladin, Shadow, Elemental, Enhancement. | Balance, Guardian, Restoration Druid. Devastation, Augmentation, Preservation. Holy Paladin. Discipline, Holy Priest. Mistweaver. Restoration Shaman. |

- **Healers never get profiles.** SimC sims damage; healer gear isn't simmed this way.
- **Some specs lag a season.** Balance, Guardian and Devastation had MID1 profiles but are still commented out in `MID2_Raid.simc` twelve weeks after the folder was set up.
- A BiS source with a quarter of the specs missing would leave the source picker in #125 showing an option that is empty for many specs.

## Freshness

From `git log -p -- profiles/MID2`, counting commits that changed a gear line (`head=`, `trinket1=` and so on):

- **Set-up:** folder created 2026-07-25, first regeneration 2026-08-05. Most specs got hand-tuned profiles between 2026-08-08 and 2026-08-12 (Hunter, Paladin, Shaman, Priest, Vengeance, Assassination).
- **Late specs:** Devourer on 2026-08-26, Feral on 2026-09-10. Three specs still have none.
- **Churn:** 51 commits changed gear lines: 1 in July, 36 in August, 11 in September, 3 so far in October. Most are the bot's "Update Generated Files". 8 profiles changed gear since 2026-09-15; the latest change was 2026-10-14.
- **After a patch:** profiles follow the PTR and the SimC developers, not a schedule. Inferred from the log: a new season's folder is ready around its launch for most DPS specs, then tuned over the first month. A fetch once a day would be more than enough.

We don't know the exact season launch date from the repo, so "ready at launch" is inferred, not checked.

## Raid only?

The issue guessed the profiles are raid gear only. They aren't, but they're not a Mythic+ list either.

- "Raid" in `MID2_Raid.simc` means the sim setup: `optimal_raid=1` (every raid buff), a single target fight. It says nothing about where the gear drops.
- Of 143 distinct items across all MID2 profiles, 23 are in our cached Season 2 dungeon loot. All but three profiles carry at least one dungeon item. The rest is raid loot, crafted gear and tier.
- There is one gear set per profile. Nothing maps onto our three lists (`overall`, `raid`, `mythicPlus`). The closest fit is `overall`.

## Item and bonus ID format

A gear line looks like this (from `MID2_Mage_Frost.simc`, trimmed):

```
head=crown_of_the_primal_leywarden,id=271564,bonus_id=13692/13698/13750/13846/13848,gem_id=240967,enchant_id=8017,redirected_base_stats=271874
legs=baleful_graveknights_greaves,id=271473,bonus_id=40/13693/13698/13846,ilevel=344,enchant_id=8159,content_tuning=8078
waist=martyrs_waistwrap,id=239649,bonus_id=8790/8960/12384/13750/13751/13836/9627,gem_id=240890,crafted_stats=32/49
```

- **Slots** use the same keys as a SimC paste. `src/core/simc/parse.ts` already maps them, reads `id`, `bonus_id` and `redirected_base_stats`, and tolerates the leading item name.
- **Item level** comes three ways:
  - an upgrade-track bonus ID, like `12854` ("Myth 6/6"), which our Raidbots tables decode;
  - a flat item-level bonus ID, like `13848` (item level 344), which Raidbots `bonuses.json` has but our `upgrade_tracks` table doesn't keep;
  - an explicit `ilevel=` override, in 36 of 47 profiles. Our parser ignores it today.
- **Catalyst and tier:** tier pieces carry `redirected_base_stats=<base item>`, the same field the SimC tier stats work (`docs/superpowers/specs/2026-10-14-simc-tier-stats-design.md`) reads at import.
- **Bonus IDs Raidbots doesn't know:** a few, like `13690` and `13692`, aren't in Raidbots' live `bonuses.json`. They look like server-side or PTR tags. They would be stored and ignored, as with SimC pastes.
- **Gems, enchants, `crafted_stats`, `content_tuning`:** not needed for a BiS list. Ignore them.
- **Profiles pick specific "Venomcursed" variants** (bonus `13846`, `13987`), a Season 2 effect. Our BiS model doesn't track effect variants, so these picks would show as the plain item.

## How it compares with Method

For the 8 specs where both a base SimC profile and a cached Method list exist, matching item IDs anywhere in the list:

| Spec | SimC items | Also in Method Overall |
|---|---|---|
| Feral Druid | 15 | 7 |
| Beast Mastery Hunter | 15 | 7 |
| Arcane Mage | 16 | 12 |
| Protection Paladin | 16 | 7 |
| Retribution Paladin | 15 | 14 |
| Assassination Rogue | 16 | 8 |
| Enhancement Shaman | 16 | 14 |
| Protection Warrior | 16 | 8 |
| **Total** | **125** | **77 (62%)** |

Overlap with Method's Raid list is lower (about half). Two specs agree almost fully; five differ on about half their slots. The SimC set is one sim's answer for one fight; Method's lists are written for a range of content.

## Is a sim gear set a fair BiS list? (owner decision)

This one is yours. My recommendation: **no, not as a BiS source.**

- **It answers a different question.** A profile is the gear one sim uses for a five-minute, single-target fight with every raid buff. A BiS list is a writer's pick across fights and content. A tank's or a cleave spec's single-target set can be wrong for Mythic+.
- **It doesn't fit our lists.** One set per spec, no Raid or Mythic+ split. It would fill `overall` only.
- **Coverage is thin.** 29 of 40 specs, no healers, and specs can be missing all season.
- **It disagrees with Method on about 4 slots in 10.** Shown beside written guides, that reads as a contradiction the app can't explain.
- **Icy Veins covers what SimC doesn't.** #124 found all 40 specs with all three lists. SimC adds nothing #125 needs.

If you still want it, the cheap version is a read-only "Sim gear set" reference row, labelled as such, using the existing SimC parser plus `ilevel=` support. That is a separate idea, not #125.

## If it's ever built

- Read `profiles/<SEASON>_Raid.simc` to find active profiles. The season prefix (`MID2`) needs a setting or a mapping per season.
- Map file names to our spec slugs (`MID2_Hunter_Beast_Mastery` to `beast-mastery-hunter`), and pick the base file over hero variants.
- Reuse `parseSimc` slot handling. Add `ilevel=`.
- Fetch through `fetchJson` or `fetchWithRetry`, once a day.
- Fixtures: trimmed profile files. They are GPL-3.0: note the source in the fixture folder.
