# Great Vault this week: implementation plan

Spec: `docs/superpowers/specs/2026-10-17-great-vault-this-week-design.md` (the authority; this plan follows it).
Issue: #176. Branch `feat/great-vault-this-week`, worktree `C:\workspace\wgt-176`.

TDD throughout: write each test, watch it fail, then the code. One commit per task, `feat: ...` subjects (repo `commit` skill rules, no AI attribution). Gate at the end: `npm run typecheck && npm run lint && npm test && npm run build` (build in the worktree only).

## Task 1: reset week module

Files: `src/core/vault/week.ts`, `src/core/vault/week.test.ts`.

- `RESETS: Record<Region, { day: number; hour: number }>` = `us {2,15}`, `eu {3,4}`, `kr {3,23}`, `tw {3,23}`. Comment: KR/TW unverified (spec).
- `weekStart(region, at)`: take `at`'s UTC date, set to `hour:00:00.000` UTC, step back `(getUTCDay() - day + 7) % 7` days; if result > `at`, subtract 7 days. Return ms.
- `formatWeek(region, start)`: `'Week of ' + Intl.DateTimeFormat('en-GB', { timeZone: ZONES[region], weekday: 'short', day: 'numeric', month: 'short' }).format(start)` with the commas the format adds removed (expected "Week of Wed 14 Oct").
- Tests (2026 timestamps via `Date.UTC`): per region, 1 ms before reset → previous week's start; at reset → that reset; 1 ms after → that reset; mid-week; near epoch (`at = 1000`, result <= at and > at − 7 days); `formatWeek('eu', Date.UTC(2026,9,14,4))` = "Week of Wed 14 Oct"; `formatWeek('kr', Date.UTC(2026,9,14,23))` = "Week of Thu 15 Oct".

## Task 2: `getLatestVaultPaste`

Files: `src/core/db/queries/snapshots.ts`, `snapshots.test.ts`.

- Signature from the spec. Query `gearSnapshots` where `characterId`, `source = 'simc'`, `createdAt >= from` (when set), `createdAt < before` (when set), and `exists (select 1 from snapshot_items where snapshot_id = gear_snapshots.id and location = 'vault')` (drizzle `exists` + subquery or `sql`). Order `createdAt desc, id desc`, `.get()`. Then read its items with `location = 'vault'` in `id` order, mapped like `getLatestSnapshot` (decode stats).
- Tests: later paste without vault items is skipped; paste exactly at `from` included; paste exactly at `before` excluded; a Blizzard snapshot is ignored; only vault items come back; no match → null.

## Task 3: member and views

Files: `src/server/views/member.ts`, `character-page.ts`, `group-page.ts`, `types.ts`, `views.test.ts`, `group-page.test.ts`.

- `MemberContext.now: number`; `MemberData.vault: { pastedAt: number | null; items: SnapshotItemInput[] }` from `getLatestVaultPaste(ctx.db, character.id, { from: weekStart(character.region, ctx.now) })`, read after `loadGear`, in sequence. Remove `vaultItems`; update callers (icon ids use `vault.items`).
- Character page: pass `now: time`; `vaultChoices` from `member.vault.items`; `vaultChoicesAt: member.vault.pastedAt`; `vaultHistoryBefore`: `start = weekStart(region, time)`; `(await getLatestVaultPaste(db, id, { before: start })) ? start : null`.
- Group page: pass `now: time` to its member context; `pastedAt: data.vault.pastedAt`.
- `CharacterPageView.vaultHistoryBefore: number | null`.
- Tests (2026 `now`): last week's vault paste only → `vaultChoicesAt: null`, `vaultChoices: []`, `vaultHistoryBefore` = this week's start; a paste this week → its choices and time; an identical paste after the reset keeps last week's time (known limit, pinned); group page `pastedAt` null for a member whose only vault paste is last week's. Update existing vault tests whose expectations change ("No item choices" state is gone: a paste with no vault items now gives `pastedAt: null`).

## Task 4: `VaultChoiceList` with BiS emphasis

Files: `src/components/vault-choice-list/VaultChoiceList.tsx`, `VaultChoiceList.test.ts`.

- Props `{ choices: VaultChoiceView[] }`. Each row: wrapper `flex items-center gap-3 rounded-xl border-2 p-1` plus `border-gold bg-gold-soft` (BiS) or `border-transparent` (not). `ItemCard` as today. BiS badge: `<span className="shrink-0 rounded-md bg-gold px-2 py-0.5 text-sm font-bold text-bg"><span aria-hidden="true">★ </span>BiS</span>`; non-BiS: `<span className="w-20 shrink-0 text-sm text-muted">Not BiS</span>`.
- No `'use client'`; importable from client components.
- Test via `renderToStaticMarkup`: BiS row has `border-gold` and `>BiS<`; non-BiS has `border-transparent` and `Not BiS`.

## Task 5: `VaultSection` and `GroupVault`

Files: `src/components/character-page/VaultSection.tsx`, `VaultSection.test.ts`, `src/components/group-vault/GroupVault.tsx`, `GroupVault.test.ts`, page `src/app/characters/[region]/[realm]/[name]/page.tsx`.

- Both use `VaultChoiceList`. Empty week: "No SimC import with Great Vault data this week." (character page adds "Paste SimC to see your Great Vault choices."). Drop the "No item choices in the vault in the last paste." branch.
- `VaultSection` props add `id`, `vaultHistoryBefore`, `region`; renders `<VaultHistory id before={vaultHistoryBefore} now />` when `vaultHistoryBefore !== null`. Page passes them.
- Tests: new wording on both; `VaultSection` renders the "Great Vault history" button only with `vaultHistoryBefore`.

## Task 6: history loader and route

Files: `src/server/views/vault-history.ts`, `vault-history.test.ts`, `src/server/views/types.ts` (`VaultWeekView`), `src/app/api/characters/[id]/vault-history/route.ts`, route test `src/app/api/characters/vault-history-route.test.ts`.

- `getVaultHistoryWeek(services, id, before)`: `getCharacter`; null → return `null` (route answers 404). `readTracks(db, time)`, `loadMember({ db, tracks, now: time, bisFor: createBisLookup(db, time, services.currentAccountId()) }, character)`. `paste = getLatestVaultPaste(db, id, { before })`; none → `{ week: null, nextBefore: null }`. `start = weekStart(region, paste.createdAt)`; icons `getItemIcons(db, ids)`; choices `vaultChoicesFor(paste.items, member.bis.lists?.[member.choice.listType] ?? [], icons, tracks)`; `nextBefore = (await getLatestVaultPaste(db, id, { before: start })) ? start : null`. All reads in sequence, no writes. Check `readTracks` does no writes; if it does, read tracks with the plain query instead.
- Route `GET`: `parseId`; `before = Number(searchParams.get('before'))`, must be a positive integer else `UserError('Unknown week.')` → 400 via `errorResponse`; unknown character → 404 `{ error: 'Unknown character' }`; else JSON.
- Tests: loader paging over two past weeks plus this week; nothing earlier; account override flips `isBis`. Route: bad `before` 400, unknown character 404, happy path 200.

## Task 7: `VaultHistory` client component

Files: `src/components/vault-history/VaultHistory.tsx`, `VaultHistory.test.ts`.

- `'use client'`. Props `{ id: number; before: number; now: number }`. State: `weeks: VaultWeekView[]`, `next: number | null` (starts at `before`), `loading`, `error`. Button text: "Great Vault history" before any load, then "Show an earlier week"; "Loading…" + disabled while loading; hidden when `next === null`. Fetch `/api/characters/${id}/vault-history?before=${next}`; on `!ok` show the body's `error` (or "Couldn't load that week.") in words beside the button. On success append the week and set `next = nextBefore`; if `week` is null set `next = null`. After weeks change, `useEffect` calls `window.$WowheadPower?.refreshLinks()`.
- Weeks render: heading `{label} · from SimC pasted {formatAge(pastedAt, now)}`, one line "Marked against today's BiS list." above the first week, then `VaultChoiceList`.
- Test: initial static markup shows the "Great Vault history" button and no weeks.

## Task 8: gate, push, PR

`npm run typecheck && npm run lint && npm test && npm run build` in the worktree. Push. PR per AGENTS.md and the brief.
