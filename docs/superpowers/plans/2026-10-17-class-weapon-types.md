# Weapon types a class can use — plan

Spec: `docs/superpowers/specs/2026-10-17-class-weapon-types-design.md` (the authority). Issue #172. Branch `feat/class-weapon-types`, stacked on #187 (on #186). TDD, one commit per task, `feat:` subjects.

1. `WeaponType`, `parseItemInfo` weapon subclass parse, `ItemInfo` field. Tests.
2. Schema columns + `npm run db:generate -- --name weapon_types`; every mapper in spec "Data"; `ensureItem` refetch of incomplete weapon rows; search fallback to loot; `SEASON_META_KEY` v7. Read-back tests.
3. `src/core/priority/weapons.ts`: `CLASS_WEAPONS`, `WEAPON_WORDS`, `weaponUse`. Tests.
4. `classCanUse` uses `weaponUse`; `fitsSlot` takes class name and checks weapons; update callers (`rank.ts`, `drop-needs.ts`, `dungeon-loot-needs.ts`). Tests.

Gate: `npm run typecheck && npm run lint && npm test && npm run build`.
