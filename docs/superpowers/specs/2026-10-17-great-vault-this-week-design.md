# Great Vault: this week's choices, with past weeks on demand

Status: written while the owner was away; open questions answered from the owner's comment on #176, the rest decided here and listed in the pull request under "Questions for Nóri". Spec review round 1 (Claude Opus reviewer; Codex at its usage limit) folded in: S1.1 KR/TW reset times marked unverified; S1.2 history shows the choices on offer, not the reward picked; S1.3 the history loader uses `loadMember` with the account's BiS lookup; S1.4 history icons may fall back; S1.5 the dedup limit gets a pinning test; S1.6 `vaultHistoryBefore` is computed on the character page only; S1.7 `VaultHistory` gets `id` and `now` as props; S1.8 non-BiS rows get the same padding; S1.9 tests use 2026 timestamps and pin the reset boundary.
Date: 2026-10-17
Issues: #176 (related: #9)

## Goal

The Great Vault section exists to show what is in **this week's** vault. Today the character page and the group page show the vault items of the latest SimC paste, whatever week it came from, so last week's vault passes for this week's. After this change:

1. The vault shows only choices from a paste made since the character's region last reset.
2. Without such a paste it says so plainly.
3. The character page can expand earlier weeks, one week at a time.
4. A BiS choice stands out clearly from a non-BiS one.

## Scope

In scope: the weekly reset per region, which paste counts as this week's, the empty-week wording, the history on the character page, and the BiS emphasis on both pages.

Out of scope:

- Any schema change or migration. Every paste is already a `gear_snapshots` row (`source = 'simc'`, `created_at`) with its vault items in `snapshot_items` (`location = 'vault'`).
- History on the group page (owner: "Only character pages show history").
- The "BiS items below Myth track" list in `VaultSection`. It comes from equipped gear, not the vault, and doesn't change.
- Judging a past week's choices against the BiS list of that week. The app keeps only the current lists, so history is judged against today's list (see "History").
- Daylight saving. Blizzard's resets are fixed in UTC (below).
- Which reward the player picked. A SimC paste lists the choices on offer, not the pick, so "what the character got" in the issue is read as **the choices the vault offered that week**. A paste taken after the pick has no vault items and so doesn't count (see "Which paste is this week's").

## Weekly reset per region

**Open question 1, answered by the owner:** follow the character's region. Every character already stores its `region` (`characters.region`: `eu`, `us`, `kr`, `tw`), so nothing new needs tracking.

| Region | Reset (UTC) | Local |
|---|---|---|
| `us` | Tuesday 15:00 | Tuesday 07:00 PST / 08:00 PDT |
| `eu` | Wednesday 04:00 | Wednesday 05:00 CET / 06:00 CEST |
| `kr` | Wednesday 23:00 | Thursday 08:00 KST |
| `tw` | Wednesday 23:00 | Thursday 07:00 CST (UTC+8) |

New pure module `src/core/vault/week.ts`:

- `RESETS: Record<Region, { day: number; hour: number }>`: UTC weekday (0 = Sunday, as `Date.getUTCDay`) and hour, from the table.
- `weekStart(region: Region, at: number): number`: the epoch ms of the latest reset at or before `at`. A paste exactly at the reset belongs to the new week.
- `formatWeek(region: Region, start: number): string`: the label for a past week, the reset date in the region's own time zone, as "Week of Wed 14 Oct". Time zones: `us` `America/New_York`, `eu` `Europe/Paris`, `kr` `Asia/Seoul`, `tw` `Asia/Taipei`, through `Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })`. US resets at 15:00 UTC, which is Tuesday in every US zone, so one zone per region is enough.

`now` comes from `Services.now()`, never `Date.now()`, so tests pin it.

US and EU match public reset trackers. **KR and TW are unverified:** public guides disagree, and no Blizzard source was found. Wednesday 23:00 UTC is the best guess and goes to the owner as a question. If any reset moves, the table is the only place to change.

## Which paste is this week's

A paste belongs to the week its `created_at` falls in, for the character's region. This week's vault is the **latest SimC snapshot since `weekStart(region, now)` that has at least one vault item**:

- A later paste this week with an empty vault (the player already picked a reward) doesn't hide an earlier paste's choices this week. The choices shown are still this week's, and the paste age beside them tells when they were seen.
- A paste from before the reset never shows as this week's, even when nothing was pasted since.

**Known limit.** `saveSnapshotIfChanged` keeps the old snapshot when a paste's content is unchanged, so an identical paste after the reset keeps the earlier week's `created_at` and the week shows as empty. With vault items in the paste that should not happen: the vault's contents are rerolled at every reset. Not worth a schema change; a test in `views.test.ts` pins the behavior so a later change to dedup is deliberate, and the PR's How to test names it.

New query in `src/core/db/queries/snapshots.ts`:

```ts
/** The latest SimC paste with vault items, with only its vault items, created in [from, before). */
export async function getLatestVaultPaste(db: Db, characterId: number, range: { from?: number; before?: number }): Promise<{ createdAt: number; items: SnapshotItemInput[] } | null>
```

It selects the newest `gear_snapshots` row (`created_at` desc, `id` desc) with `source = 'simc'`, in range, that has a `snapshot_items` row with `location = 'vault'` (an `EXISTS` subquery), then reads that snapshot's vault items in `id` order. Reads only, in sequence.

## Views

`src/server/views/member.ts`:

- `MemberContext` gains `now: number`.
- `MemberData.vaultItems` becomes `vault: { pastedAt: number | null; items: SnapshotItemInput[] }`, loaded with `getLatestVaultPaste(db, character.id, { from: weekStart(character.region, now) })`. No longer taken from `gear.simc`.

`CharacterPageView` (`src/server/views/types.ts`):

- `vaultChoicesAt` keeps its name and type; it is now this week's paste time, or null when there is none this week.
- New `vaultHistoryBefore: number | null`: this week's start when the character has a vault paste before it, else null. Computed in `character-page.ts` only, with one `getLatestVaultPaste(db, id, { before: weekStart })` call (not in `loadMember`, so the group page doesn't run it per member). The page shows the history button only when it is set.

`GroupVaultView.pastedAt` follows the same rule: this week's paste time, or null.

## Wording

| State | Character page | Group page |
|---|---|---|
| No vault paste this week | "No SimC import with Great Vault data this week." plus, as today, a hint to paste SimC | "No SimC import with Great Vault data this week." |
| Choices this week | Heading "This week's choices, from SimC pasted 2 days ago" | Name "· from SimC pasted 2 days ago" |

The old "No item choices in the vault in the last paste." state disappears: a paste with an empty vault no longer counts as this week's vault paste.

## BiS emphasis

Today a choice ends with "BiS" in `text-bags` or "Not BiS" in `text-muted`, the same weight. BiS must be clearly stronger.

New shared component `src/components/vault-choice-list/VaultChoiceList.tsx`, used by `VaultSection`, `GroupVault` and the history, so all three look the same:

- **BiS choice:** the row sits in a gold frame, `rounded-xl border-2 border-gold bg-gold-soft p-1`, and ends with a filled badge, `bg-gold text-bg font-bold`, reading "★ BiS" (the star `aria-hidden`).
- **Non-BiS choice:** no visible frame: `rounded-xl border-2 border-transparent p-1`, the same box as a BiS row so cards line up, and "Not BiS" in `text-muted` at normal weight.
- Words stay beside the color, so the state never rests on color alone (`AGENTS.md`, "UI rules").
- Order is the paste's order; BiS choices aren't moved.

## History (character page only)

**Open question 2, answered by the owner:** only character pages show history; show everything, paged so a week loads at a time.

- Under this week's choices, a button "Great Vault history" when `vaultHistoryBefore` is set. A click loads the latest earlier week that has a vault paste and shows it below, headed "Week of Wed 14 Oct · from SimC pasted 9 days ago". The button then reads "Show an earlier week" and loads the next one back, until there is none; then it goes away. Weeks with no vault paste are skipped, not shown empty.
- The client component `src/components/vault-history/VaultHistory.tsx` (`'use client'`, state only) takes `id`, `before` (from `vaultHistoryBefore`) and `now` (the page's `services.now()`, passed through `VaultSection`, never `Date.now()`) as props, holds the loaded weeks and calls the route below. While loading, the button reads "Loading…" and is disabled; on failure the error shows beside the button in words and the button stays, so a retry works. After weeks render it calls `window.$WowheadPower?.refreshLinks()` so the new cards get tooltips.
- Each week shows the latest vault paste in that week, judged against **today's** BiS list for the character's compared list. A line under the history heading says so: "Marked against today's BiS list."

New route `GET /api/characters/[id]/vault-history?before=<epoch ms>`:

- Reads only: no writes on `GET` (`AGENTS.md`, "Errors and HTTP"). Icons come from `getItemIcons`, cached icons only. A past vault item's icon is cached only if a page showed that paste; otherwise it falls back as `ItemCard` already handles. Acceptable for history.
- `before` must be a positive integer; otherwise `UserError` and 400. An unknown character is 404 as in `[id]/route.ts`.
- Loads the character and tracks (`readTracks`), then `loadMember` with `createBisLookup(db, time, services.currentAccountId())`, so BiS is judged against the same list (`member.choice.listType`) and account overrides the page uses, finds `getLatestVaultPaste(db, id, { before })`, and answers `{ week: VaultWeekView | null, nextBefore: number | null }`, where `VaultWeekView = { start: number; label: string; pastedAt: number; choices: VaultChoiceView[] }`, `start = weekStart(region, pastedAt)`, and `nextBefore` is `start` when another vault paste exists before `start`, else null.
- The loader lives in `src/server/views/vault-history.ts` (`getVaultHistoryWeek(services, id, before)`); the route stays thin.

## Testing

New tests use realistic 2026 timestamps, not `now: () => 1000`, where `weekStart` would be negative.

Unit (`src/core/vault/week.test.ts`): for each region, a time just before, exactly at and just after the reset; a time mid-week; a time near the epoch (start <= at); `formatWeek` for `eu` and `kr` (the KR reset is Thursday local).

Query (`snapshots.test.ts`): `getLatestVaultPaste` skips a later paste without vault items, includes a paste exactly at `from` and excludes one exactly at `before`, ignores Blizzard snapshots, and returns only vault items.

Views (`views.test.ts`, `group-page.test.ts`): with `now` after a reset, last week's vault paste gives `vaultChoicesAt: null` and `vaultHistoryBefore` set; a paste this week shows its choices; the group page's `pastedAt` is null for a member whose only vault paste is last week's.

Loader (`vault-history.test.ts`): two past weeks and this week; `before = this week's start` returns the newer past week with `nextBefore` set, then the older with `nextBefore: null`; nothing earlier gives `{ week: null, nextBefore: null }`; an account override that adds a vault item to the list flips its `isBis`. Views: an identical paste after the reset keeps last week's time (the known limit).

Route: a bad `before` is 400, an unknown character 404.

Markup: `VaultChoiceList` gives a BiS row the gold frame and the "BiS" badge and a non-BiS row "Not BiS" without the frame; `VaultSection` and `GroupVault` show the new empty-week wording; `VaultSection` shows the history button only with `vaultHistoryBefore`.

By hand: an EU character with a paste last week shows the empty-week line and the history button; the button loads last week, then hides when nothing is earlier; a fresh paste this week shows its choices with BiS framed in gold, at 1440 and 390 px.

## Decisions taken without the owner

1. KR and TW reset times (Wednesday 23:00 UTC) are unverified; US and EU match public trackers. All resets are fixed UTC hours in code, not from an API.
2. History is judged against today's BiS list, not the list of the week, since past lists aren't kept.
3. A later paste with an empty vault doesn't hide an earlier paste's choices from the same week, so after a pick the choices still show; the paste age tells when they were seen. History shows choices offered, not the reward picked.
4. One week per click, unlimited depth, empty weeks skipped.
5. A new read-only route `GET /api/characters/[id]/vault-history`.
