# Tier piece stats from a SimC paste: plan

Spec: `docs/superpowers/specs/2026-10-14-simc-tier-stats-design.md` (the authority).
Issue: #97. Branch: `feat/tier-stats-from-item-api`.

Each task: failing test first, watch it fail, implement, run the file's tests. One commit per task, `feat:` subject.

## Task 1: parse `redirected_base_stats`

- `src/core/simc/parse.ts`: `SimcItem.statsItemId: number | null`. In `parseItem`, `Number(options.get('redirected_base_stats'))`, kept only when a positive integer.
- `src/core/simc/parse.test.ts`: present (equipped and bag line), absent, `=0`.
- Fix other `SimcItem` literals the type change breaks (`npm run typecheck`).

## Task 2: `ensureItemStats`

- `src/core/sync/reference-sync.ts`, beside `syncTierTargets`, signature as in the spec. Reuse `getTierTargetRows`, `needsStats`, `upsertTierTargets`. No meta back-off. Return `Map<id, string[] | null>` read after the writes (one `getTierTargetRows` call).
- `src/core/sync/reference-sync.test.ts`: cached hit makes no request; uncached is requested and stored; 404 returns `null`, not re-requested within a day, re-requested after; thrown request returns `null`, stores nothing. Follow the file's existing fake-fetch / fake-blizzard setup.

## Task 3: import uses it

- `src/core/simc/import-simc.ts`: after `ensureItemDetails`, gather `statsItemId ?? itemId` for equipped items with `isTier`, call `ensureItemStats` once, set `secondaryStats` for those items. Drop the "SimC exports carry no item stats" comment.
- `src/core/simc/__fixtures__/export.txt`: add `redirected_base_stats=<id>` to one equipped tier line (made-up but valid shape).
- `src/core/simc/import-simc.test.ts`: the cases the spec lists, including the three re-paste cases with snapshot IDs.

## Gate

`npm run typecheck && npm run lint && npm test`. No pages or components change, so no build.

## Next

Draft PR, then the review-loop skill.
