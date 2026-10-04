# Group Page Layout and Crest Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this project, `docs/workflow.md` says implementation runs inline with superpowers:executing-plans.

**Goal:** Rebuild the Group page so five members' gear and the dungeon priority list fit on one desktop screen (a compact grid beside a sticky rail) and sit one tap apart on smaller screens (tabs), and show crest icons instead of crest names everywhere crests appear.

**Architecture:** The panels stay server components. One small client component, `GroupLayout`, holds a single `view` state and switches panels with Tailwind breakpoint classes from a pure function, so the first paint is right at every width. Crest icon names come from Wowhead's currency tooltip endpoint, looked up by a new `src/core/wowhead` client that wraps the Raidbots fetcher, and are stored in a new `upgrade_tracks.currency_icon` column; images are hotlinked from `wow.zamimg.com`.

**Tech Stack:** Next.js 16.3 App Router, React 19.3 (native `popover`, `popoverTarget`, `onToggle`), Tailwind v4 (`@theme` tokens in `src/app/globals.css`), Drizzle with libsql SQLite, Vitest 5 with `renderToStaticMarkup` component tests.

**Spec:** `docs/superpowers/specs/2026-10-04-group-page-layout-design.md` (issues #75 and #63). The spec wins when it and this plan disagree.

## Global Constraints

- Branch: `docs/group-page-layout` holds the spec and this plan. Implementation goes on a new branch `feat/group-page-layout` cut from the latest `origin/main` after this branch merges, or rebased onto it; see `AGENTS.md`, "Branches, commits and pull requests".
- Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (`AGENTS.md`).
- Desktop breakpoint is `xl` (1280 px). Phone breakpoint is `sm` (640 px).
- Group page side padding: `px-4 sm:px-8 2xl:px-16`. Rail width: 380 px. Rail max height: `calc(100dvh - 3rem)`.
- Grid columns: slot column 44 px below `sm`, 64 px from `sm`; member columns `minmax(0, 1fr)`.
- Cell state words: Done, Crests, Vault, Bags, Need, and Need tier for a missing tier piece.
- Crest icon URL: `https://wow.zamimg.com/images/wow/icons/medium/<icon>.jpg`. Tooltip endpoint: `https://nether.wowhead.com/tooltip/currency/<id>`. Icon names must match `^[a-z0-9_]+$`. At most 4 lookups at a time.
- `TRACKS_META_KEY` becomes `tracks.v3.fetchedAt`.
- Every database write goes through `withWriteLock` (already true for `replaceTracks`).
- Every external request goes through `fetchJson` or `fetchWithRetry`.
- `src/core` never imports `next`, `react`, `src/app`, `src/components` or `src/server`.
- Components live in their own kebab-case directory; branching logic goes in a tested `.ts` beside the component.
- Color is never the only signal: every state has a word.
- Every member name has its `CharacterAvatar` beside it.
- Fixtures use made-up names such as Birkibjörn; never real players.
- Commit subjects `type: lowercase imperative summary`, bodies say why, no AI attribution or co-author trailers.
- Gate before calling work done: `npm run typecheck && npm run lint && npm test`, plus `npm run build` (stop `npm run dev` first).

## Review Focus

1. **A long character name or long item name** (a name like Þórhildurdóttir, "Enigmatic Dreamwatcher's Somnolent Stare") must truncate in grid headers and cells without widening a column, and read in full in the details card. The full-text half is pinned in Task 8 (the card renders the whole name and the header carries it in `title`); truncation is CSS, so it is a hand check in Task 10.
2. **The crest icon host blocked or returning 404** must show the crest's first word and count, never a broken image or an empty chip. Pinned by the `CrestIcon` fallback test in Task 4; the browser case is a hand check in Task 10.
3. **A Wowhead lookup failing for one currency** (timeout, 500, odd JSON) must leave that crest nameless-iconed while the others get icons and the tracks still save. Pinned in Task 2.
4. **A member with no character, a sync error, or not found** must keep today's wording and button, now in the notice row, while other members' columns render normally. Pinned in Task 8.
5. **A tier credit whose piece has no icon** must still show a labeled "T" tile with the piece's name and slot. Pinned in Task 6.

---

## File Structure

| File | Status | Job |
|---|---|---|
| `src/core/types.ts` | modify | `Track.currencyIcon` |
| `src/core/db/schema.ts`, `drizzle/0008_crest-icons.sql` | modify, generate | `currency_icon` column |
| `src/core/wowhead/currency.ts` (+ test, fixture) | create | Tooltip lookup and `withCurrencyIcons` wrapper |
| `src/core/wowhead/icons.ts` (+ test) | create | Icon name to image URL |
| `src/core/raidbots/tracks.ts` | modify | Parsed tracks carry `currencyIcon: null` |
| `src/core/sync/reference-sync.ts` (+ test) | modify | Meta key v3 |
| `src/server/services.ts` | modify | Wrap the Raidbots fetcher |
| `src/core/gear/crests.ts` (+ test) | modify | Icon URLs on costs, balances and upgrades |
| `src/components/crest-chip/CrestIcon.tsx`, `CrestChip.tsx`, `crest-label.ts` (+ test) | create | Crest icon with fallback, chip, label |
| `src/components/crest-summary/CrestSummary.tsx` | modify | Chips with icons |
| `src/components/upgrade-badge/UpgradeBadge.tsx` | modify | Crest icon before steps |
| `src/components/character-card/crest-line.ts` (+ test), `CharacterCard.tsx` | modify | Balances as data, chips on the card |
| `src/core/priority/rank.ts` (+ test) | modify | Tier credit carries its piece |
| `src/server/views/types.ts`, `member.ts`, `group-page.ts`, `character-page.ts` | modify | Tier credit item view and icons |
| `src/components/character-page/DungeonPriority.tsx` (+ test) | modify | Tier piece shown as an item card |
| `src/components/state-badge/state-labels.ts` | create | Badge wording shared by the badge and cell labels |
| `src/components/group-grid/state-word.ts`, `slot-short.ts`, `cell-label.ts`, `member-notices.ts` (+ tests) | create | Pure grid helpers |
| `src/components/group-grid/cell-note.ts` (+ test) | modify | Tier need names the piece |
| `src/components/group-priority/credit-slot.ts`, `chip-label.ts` (+ tests) | create | Pure chip helpers |
| `src/components/group-priority/credit-text.ts` (+ test), `CreditCard.tsx` (+ test), `DungeonCard.tsx`, `MemberNeeds.tsx` | delete | Replaced by chips and rows |
| `src/components/group-priority/CreditChip.tsx`, `DungeonRow.tsx` | create | Chips and collapsible dungeon rows |
| `src/components/group-priority/GroupPriority.tsx` (+ test), `DungeonThumbnail.tsx` | modify | Rows, smaller thumbnail, no outer box |
| `src/components/cell-details/CellDetails.tsx`, `position.ts` (+ test) | create | Details popover and its placement |
| `src/components/group-grid/GroupCell.tsx`, `MemberHeader.tsx`, `MemberNotices.tsx`, `GroupGrid.tsx` (+ test) | modify, create | Compact grid |
| `src/components/group-vault/GroupVault.tsx` | modify | No outer box |
| `src/components/group-layout/GroupLayout.tsx`, `panel-classes.ts` (+ test) | create | View state, tabs, rail |
| `src/components/group-members/GroupMembers.tsx` | modify | Spec hidden below `sm` |
| `src/app/group/page.tsx` | modify | Wire the layout, padding |
| `AGENTS.md` | modify | External data fact for the Wowhead endpoint |

---

### Task 1: Check Wowhead tooltips on a button

The cell design depends on Wowhead's script showing a tooltip for `data-wowhead` on a `<button>`. Check it before building the cell. Nothing from this task is committed.

**Files:** none committed.

**Interfaces:**
- Produces: a decision recorded in the pull request's Testing section, "Wowhead tooltip on button: works" or "does not work". Task 8 Step 3 uses it.

- [ ] **Step 1: Start the app and open a group**

Run: `npm run dev`, then open `http://localhost:3000/group` with at least one tracked member.

- [ ] **Step 2: Add a test button from the browser console**

```js
const b = document.createElement('button');
b.type = 'button';
b.textContent = 'Tooltip test';
b.setAttribute('data-wowhead', 'item=271528');
b.style.cssText = 'position:fixed;top:12px;left:12px;z-index:9999;padding:12px';
document.body.append(b);
window.$WowheadPower?.refreshLinks?.();
```

- [ ] **Step 3: Hover the button**

Expected: a Wowhead item tooltip appears. Write down "works" or "does not work". Task 8 Step 3 has the code for each case. Stop the dev server before any build.

---

### Task 2: Store crest icon names with the tracks

**Files:**
- Create: `src/core/wowhead/currency.ts`, `src/core/wowhead/currency.test.ts`, `src/core/wowhead/__fixtures__/currency-3446.json`
- Modify: `src/core/types.ts:43-53`, `src/core/db/schema.ts:98-107`, `src/core/raidbots/tracks.ts:31-42`, `src/core/sync/reference-sync.ts:15`, `src/core/sync/reference-sync.test.ts`, `src/server/services.ts:7,32`
- Generate: `drizzle/0008_crest-icons.sql` and its `drizzle/meta` snapshot

**Interfaces:**
- Produces: `Track.currencyIcon?: string | null`; `parseCurrencyIcon(data: unknown): string | null`; `createCurrencyIconFetcher(fetchFn?: FetchFn): (currencyId: number) => Promise<string | null>`; `withCurrencyIcons(fetchRaidbots: () => Promise<RaidbotsData>, fetchIcon: (currencyId: number) => Promise<string | null>): () => Promise<RaidbotsData>`.

- [ ] **Step 1: Add the trimmed fixture**

`src/core/wowhead/__fixtures__/currency-3446.json`:

```json
{"icon":"inv_121_crest_myth","name":"Myth Mistcrest","tooltip":"<table><tr><td><b>Myth Mistcrest</b></td></tr></table>","tooltip2":""}
```

- [ ] **Step 2: Write the failing tests**

`src/core/wowhead/currency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fakeFetch, json, on } from '@/test/fake-fetch';
import type { Track } from '../types';
import fixture from './__fixtures__/currency-3446.json';
import { createCurrencyIconFetcher, currencyTooltipUrl, parseCurrencyIcon, withCurrencyIcons } from './currency';

const track = (bonusId: number, currencyId: number | null): Track => ({
  bonusId, name: 'Myth', step: 2, max: 6, group: 618, currencyId, currencyName: currencyId ? 'Myth Mistcrest' : null, costPerStep: currencyId ? 20 : null,
});

describe('parseCurrencyIcon', () => {
  it('reads the icon name from a tooltip answer', () => {
    expect(parseCurrencyIcon(fixture)).toBe('inv_121_crest_myth');
  });

  it('rejects names with other characters, and answers without one', () => {
    expect(parseCurrencyIcon({ icon: '../evil' })).toBeNull();
    expect(parseCurrencyIcon({ icon: 'INV Crest' })).toBeNull();
    expect(parseCurrencyIcon({ name: 'Myth Mistcrest' })).toBeNull();
    expect(parseCurrencyIcon(null)).toBeNull();
  });
});

describe('createCurrencyIconFetcher', () => {
  it('asks Wowhead for the currency and returns its icon name', async () => {
    const { fn, calls } = fakeFetch([on('/tooltip/currency/3446', () => json(fixture))]);
    expect(await createCurrencyIconFetcher(fn)(3446)).toBe('inv_121_crest_myth');
    expect(calls[0]!.url).toBe(currencyTooltipUrl(3446));
  });

  it('returns null instead of throwing when Wowhead fails', async () => {
    const { fn } = fakeFetch([on('/tooltip/currency/', () => json({ error: 'down' }, 500))]);
    expect(await createCurrencyIconFetcher(fn)(3446)).toBeNull();
  });
});

describe('withCurrencyIcons', () => {
  it('looks up each currency once and adds its icon to every track that costs it', async () => {
    const asked: number[] = [];
    const fetchIcon = async (id: number) => { asked.push(id); return id === 3446 ? 'inv_121_crest_myth' : null; };
    const fetchRaidbots = async () => ({ tracks: [track(1, 3446), track(2, 3446), track(3, 3445), track(4, null)], qualities: [] });
    const { tracks } = await withCurrencyIcons(fetchRaidbots, fetchIcon)();
    expect(asked.sort()).toEqual([3445, 3446]);
    expect(tracks.map((t) => t.currencyIcon)).toEqual(['inv_121_crest_myth', 'inv_121_crest_myth', null, null]);
  });

  it('keeps the tracks when one lookup fails', async () => {
    const fetchIcon = async (id: number) => { if (id === 3445) throw new Error('timeout'); return 'inv_121_crest_myth'; };
    const fetchRaidbots = async () => ({ tracks: [track(1, 3446), track(3, 3445)], qualities: [] });
    const { tracks } = await withCurrencyIcons(fetchRaidbots, fetchIcon)();
    expect(tracks.map((t) => t.currencyIcon)).toEqual(['inv_121_crest_myth', null]);
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/core/wowhead/currency.test.ts`
Expected: FAIL, cannot find module `./currency`.

- [ ] **Step 4: Add the field, the column and the client**

In `src/core/types.ts`, inside `interface Track`, after `currencyName`:

```ts
  /** Wowhead's icon name for the crest currency, such as `inv_121_crest_myth`. Absent or null when unknown. */
  currencyIcon?: string | null;
```

In `src/core/db/schema.ts`, inside `upgradeTracks`, after `currencyName`:

```ts
  currencyIcon: text('currency_icon'),
```

In `src/core/raidbots/tracks.ts`, in `parseRaidbotsBonuses`, after `currencyName: amount?.name ?? null,`:

```ts
      currencyIcon: null,
```

`src/core/wowhead/currency.ts`:

```ts
import { createLimiter, fetchJson, type FetchFn } from '../http';
import type { RaidbotsData } from '../raidbots/tracks';

// Undocumented: Wowhead's own tooltip script uses it. Only the icon name is read.
export const currencyTooltipUrl = (currencyId: number) => `https://nether.wowhead.com/tooltip/currency/${currencyId}`;
const ICON_NAME = /^[a-z0-9_]+$/;

/** The icon name in a tooltip answer, or null when it is missing or looks wrong. */
export function parseCurrencyIcon(data: unknown): string | null {
  const icon = (data as { icon?: unknown } | null)?.icon;
  return typeof icon === 'string' && ICON_NAME.test(icon) ? icon : null;
}

/** Looks up a currency's icon name. Never throws: a failed lookup is just a missing icon. */
export function createCurrencyIconFetcher(fetchFn: FetchFn = fetch) {
  return async (currencyId: number): Promise<string | null> => {
    try {
      return parseCurrencyIcon(await fetchJson<unknown>(fetchFn, currencyTooltipUrl(currencyId)));
    } catch {
      return null;
    }
  };
}

/** Wraps the Raidbots fetcher so each crest currency's icon name rides along with the tracks that cost it. */
export function withCurrencyIcons(
  fetchRaidbots: () => Promise<RaidbotsData>,
  fetchIcon: (currencyId: number) => Promise<string | null>,
): () => Promise<RaidbotsData> {
  return async () => {
    const data = await fetchRaidbots();
    const limit = createLimiter(4);
    const ids = [...new Set(data.tracks.flatMap((t) => (t.currencyId === null ? [] : [t.currencyId])))];
    const lookup = async (id: number) => {
      try {
        return [id, await fetchIcon(id)] as const;
      } catch {
        return [id, null] as const;
      }
    };
    const icons = new Map(await Promise.all(ids.map((id) => limit(() => lookup(id)))));
    return { ...data, tracks: data.tracks.map((t) => ({ ...t, currencyIcon: t.currencyId === null ? null : icons.get(t.currencyId) ?? null })) };
  };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/core/wowhead/currency.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Write the failing cache-version test**

In `src/core/sync/reference-sync.test.ts`, inside `describe('ensureTracks', ...)`, add:

```ts
  it('stores crest icon names and refetches over a fresh v2 cache', async () => {
    const db = await openTestDb();
    await setMeta(db, 'tracks.v2.fetchedAt', '1', 1);
    const withIcon = { ...data, tracks: [{ ...tracks[0]!, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, currencyIcon: 'inv_121_crest_myth' }] };
    let calls = 0;
    const result = await ensureTracks({ db, fetchRaidbots: async () => { calls++; return withIcon; }, now: 2 });
    expect(calls).toBe(1);
    expect(result.tracks.get(1)?.currencyIcon).toBe('inv_121_crest_myth');
  });
```

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: FAIL. The v2 key counts as fresh, so `calls` is 0, and the column does not exist yet.

- [ ] **Step 7: Bump the key and generate the migration**

In `src/core/sync/reference-sync.ts:15`:

```ts
const TRACKS_META_KEY = 'tracks.v3.fetchedAt';
```

Run: `npm run db:generate -- --name crest-icons`
Expected: a new `drizzle/0008_crest-icons.sql` containing `ALTER TABLE \`upgrade_tracks\` ADD \`currency_icon\` text;` and an updated `drizzle/meta` journal and snapshot.

Run: `npx vitest run src/core/sync/reference-sync.test.ts`
Expected: PASS.

- [ ] **Step 8: Wire the wrapper into services**

In `src/server/services.ts`, add the import:

```ts
import { createCurrencyIconFetcher, withCurrencyIcons } from '@/core/wowhead/currency';
```

and replace `fetchRaidbots: createRaidbotsFetcher(),` with:

```ts
    fetchRaidbots: withCurrencyIcons(createRaidbotsFetcher(), createCurrencyIconFetcher()),
```

- [ ] **Step 9: Run the gate for this task**

Run: `npm run typecheck && npx vitest run src/core`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/core/types.ts src/core/db/schema.ts drizzle src/core/raidbots/tracks.ts src/core/wowhead src/core/sync/reference-sync.ts src/core/sync/reference-sync.test.ts src/server/services.ts
git commit -m "feat: store crest icon names with the upgrade tracks"
```

Body:

```
Blizzard's APIs expose no currency icons, so the names come from
Wowhead's currency tooltip endpoint, looked up once per crest when the
Raidbots tracks refresh. A failed lookup leaves that crest without an
icon and never fails the tracks sync. The cache key moves to v3 so
existing installs refetch instead of keeping rows without icons.
```

---

### Task 3: Carry icon URLs through the crest views

**Files:**
- Create: `src/core/wowhead/icons.ts`, `src/core/wowhead/icons.test.ts`
- Modify: `src/core/gear/crests.ts`, `src/core/gear/crests.test.ts`

**Interfaces:**
- Consumes: `Track.currencyIcon` (Task 2).
- Produces: `wowIconUrl(icon: string): string`; `CrestCost.iconUrl: string | null`; `CrestBalance.iconUrl: string | null`; `UpgradeOption.currencyId: number` and `UpgradeOption.iconUrl: string | null`.

- [ ] **Step 1: Write the failing tests**

`src/core/wowhead/icons.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { wowIconUrl } from './icons';

describe('wowIconUrl', () => {
  it('builds the medium icon URL on Wowhead’s image host', () => {
    expect(wowIconUrl('inv_121_crest_myth')).toBe('https://wow.zamimg.com/images/wow/icons/medium/inv_121_crest_myth.jpg');
  });
});
```

In `src/core/gear/crests.test.ts`, change the track helper so the Myth crest has an icon, and update the expectations:

```ts
const t = (bonusId: number, name: string, step: number, group: number | null, cost: [number, string, number] | null): Track => ({
  bonusId, name, step, max: 6, group,
  currencyId: cost?.[0] ?? null, currencyName: cost?.[1] ?? null, costPerStep: cost?.[2] ?? null,
  currencyIcon: cost?.[0] === 3446 ? 'inv_121_crest_myth' : null,
});
const MYTH_ICON = 'https://wow.zamimg.com/images/wow/icons/medium/inv_121_crest_myth.jpg';
```

```ts
    expect(costs.get(618)).toEqual({ group: 618, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, iconUrl: MYTH_ICON });
```

```ts
    expect(affordableUpgrade(tracks[0]!, costs, balances)).toEqual({ steps: 4, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, iconUrl: MYTH_ICON });
```

```ts
    expect(summarizeCrests(new Map([[3445, 140], [3446, 85], [1234, 5]]), costs)).toEqual([
      { currencyId: 3446, name: 'Myth Mistcrest', quantity: 85, steps: 4, iconUrl: MYTH_ICON },
      { currencyId: 3445, name: 'Hero Mistcrest', quantity: 140, steps: 7, iconUrl: null },
    ]);
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/wowhead/icons.test.ts src/core/gear/crests.test.ts`
Expected: FAIL, missing module and missing `iconUrl` fields.

- [ ] **Step 3: Implement**

`src/core/wowhead/icons.ts`:

```ts
/** Wowhead's hosted copy of a game icon. Hotlinked, never stored. */
export const wowIconUrl = (icon: string) => `https://wow.zamimg.com/images/wow/icons/medium/${icon}.jpg`;
```

In `src/core/gear/crests.ts`:

```ts
import { wowIconUrl } from '../wowhead/icons';
```

Add `iconUrl: string | null;` to `CrestCost` and `CrestBalance`, and `currencyId: number;` and `iconUrl: string | null;` to `UpgradeOption`. In `crestCostsByGroup`, add to the object:

```ts
      iconUrl: track.currencyIcon ? wowIconUrl(track.currencyIcon) : null,
```

In `affordableUpgrade`, return:

```ts
  return steps > 0 ? { steps, currencyId: cost.currencyId, currencyName: cost.currencyName, costPerStep: cost.costPerStep, iconUrl: cost.iconUrl } : null;
```

In `summarizeCrests`, push:

```ts
    summary.push({ currencyId: cost.currencyId, name: cost.currencyName, quantity, steps: Math.floor(quantity / cost.costPerStep), iconUrl: cost.iconUrl });
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/core && npm run typecheck`
Expected: PASS. If a view test compares a whole `CrestBalance` or `UpgradeOption` with `toEqual`, add `iconUrl: null` (and `currencyId` for upgrades) to its expectation.

- [ ] **Step 5: Commit**

```bash
git add src/core/wowhead/icons.ts src/core/wowhead/icons.test.ts src/core/gear src/server
git commit -m "feat: give crest balances and upgrades their icon URL"
```

---

### Task 4: Show crest icons everywhere crests appear

**Files:**
- Create: `src/components/crest-chip/CrestIcon.tsx`, `src/components/crest-chip/CrestChip.tsx`, `src/components/crest-chip/crest-label.ts`, `src/components/crest-chip/crest-label.test.ts`, `src/components/crest-chip/CrestChip.test.ts`
- Modify: `src/components/crest-summary/CrestSummary.tsx`, `src/components/upgrade-badge/UpgradeBadge.tsx`, `src/components/character-card/crest-line.ts`, `src/components/character-card/crest-line.test.ts`, `src/components/character-card/CharacterCard.tsx`

**Interfaces:**
- Consumes: `CrestBalance.iconUrl`, `UpgradeOption.iconUrl` (Task 3).
- Produces: `<CrestChip balance={CrestBalance} />`; `<CrestIcon url={string | null} size={number} fallback={ReactNode} />`; `crestLabel(b: CrestBalance): string`; `crestLine(...)` now returns `{ balances: CrestBalance[]; text: string; tone: string }`.

- [ ] **Step 1: Write the failing tests**

`src/components/crest-chip/crest-label.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { crestLabel, crestShortName } from './crest-label';

const myth = { currencyId: 3446, name: 'Myth Mistcrest', quantity: 85, steps: 4, iconUrl: null };

describe('crestLabel', () => {
  it('names the crest, its count and the steps it pays for', () => {
    expect(crestLabel(myth)).toBe('Myth Mistcrest: 85, 4 steps');
    expect(crestLabel({ ...myth, quantity: 20, steps: 1 })).toBe('Myth Mistcrest: 20, 1 step');
  });

  it('shortens the name to its first word for the fallback', () => {
    expect(crestShortName(myth)).toBe('Myth');
  });
});
```

`src/components/crest-chip/CrestChip.test.ts`:

```ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CrestChip } from './CrestChip';

const myth = { currencyId: 3446, name: 'Myth Mistcrest', quantity: 85, steps: 4, iconUrl: 'https://wow.zamimg.com/images/wow/icons/medium/inv_121_crest_myth.jpg' };
const render = (balance: typeof myth | (Omit<typeof myth, 'iconUrl'> & { iconUrl: null })) => renderToStaticMarkup(createElement(CrestChip, { balance }));

describe('CrestChip', () => {
  it('shows the icon and count, with the full label for hover and screen readers', () => {
    const html = render(myth);
    expect(html).toContain('src="https://wow.zamimg.com/images/wow/icons/medium/inv_121_crest_myth.jpg"');
    expect(html).toContain('>85<');
    expect(html).toContain('title="Myth Mistcrest: 85, 4 steps"');
    expect(html).toContain('<span class="sr-only">Myth Mistcrest: 85, 4 steps</span>');
  });

  it('falls back to the first word of the name without an icon', () => {
    const html = render({ ...myth, iconUrl: null });
    expect(html).not.toContain('<img');
    expect(html).toContain('>Myth<');
  });
});
```

Replace `src/components/character-card/crest-line.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { crestLine } from './crest-line';

const DAY = 24 * 60 * 60 * 1000;
const now = 10 * DAY;
const myth = { currencyId: 3446, name: 'Myth Mistcrest', quantity: 12, steps: 0, iconUrl: null };
const crests = (balances: (typeof myth)[]) => ({ balances, pastedAt: now - 2 * DAY });

describe('crestLine', () => {
  it('asks for a paste when crests are unknown', () => {
    expect(crestLine({ crests: null, gearFromSimc: false, upgradesReady: 0 }, now))
      .toEqual({ balances: [], text: 'Crests unknown: paste SimC', tone: 'text-muted' });
  });

  it('returns the balances as data and says when nothing is affordable', () => {
    expect(crestLine({ crests: crests([myth]), gearFromSimc: true, upgradesReady: 0 }, now))
      .toEqual({ balances: [myth], text: 'No BiS upgrades affordable', tone: 'text-muted' });
  });

  it('says so when the paste had no crests at all', () => {
    expect(crestLine({ crests: crests([]), gearFromSimc: true, upgradesReady: 0 }, now).text).toBe('No crests: no BiS upgrades affordable');
  });

  it('counts ready upgrades in the singular and plural', () => {
    expect(crestLine({ crests: crests([myth]), gearFromSimc: true, upgradesReady: 1 }, now))
      .toEqual({ balances: [myth], text: '1 BiS upgrade ready', tone: 'text-upgrade' });
    expect(crestLine({ crests: crests([myth]), gearFromSimc: true, upgradesReady: 3 }, now).text).toBe('3 BiS upgrades ready');
  });

  it('says how old the paste is when the gear itself came from Blizzard', () => {
    expect(crestLine({ crests: crests([myth]), gearFromSimc: false, upgradesReady: 0 }, now).text)
      .toBe('Pasted 2 days ago: no BiS upgrades affordable');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/crest-chip src/components/character-card`
Expected: FAIL.

- [ ] **Step 3: Implement the label and the components**

`src/components/crest-chip/crest-label.ts`:

```ts
import type { CrestBalance } from '@/core/gear/crests';

/** What a crest chip says on hover and to screen readers. */
export const crestLabel = (b: CrestBalance) => `${b.name}: ${b.quantity}, ${b.steps} ${b.steps === 1 ? 'step' : 'steps'}`;

/** The visible name when the icon is missing: "Myth" for Myth Mistcrest, as the character card always said. */
export const crestShortName = (b: CrestBalance) => b.name.split(' ')[0]!;
```

`src/components/crest-chip/CrestIcon.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';

/**
 * A crest icon that falls back when the URL is null or the image fails to load. Remembering which
 * URL failed lets a new URL from a later refresh load, and never retries the same one in a loop.
 */
export function CrestIcon({ url, size, fallback }: { url: string | null; size: number; fallback: ReactNode }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) return <>{fallback}</>;
  return (
    <img src={url} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-sm" style={{ width: size, height: size }}
      onError={() => setFailedUrl(url)}
      // A server-rendered image can fail before hydration attaches onError; catch that on mount.
      ref={(el) => { if (el?.complete && el.naturalWidth === 0) setFailedUrl(url); }} />
  );
}
```

`src/components/crest-chip/CrestChip.tsx`:

```tsx
import type { CrestBalance } from '@/core/gear/crests';
import { crestLabel, crestShortName } from './crest-label';
import { CrestIcon } from './CrestIcon';

/** A crest as its icon and count. Without an icon it shows the crest's first word instead. */
export function CrestChip({ balance }: { balance: CrestBalance }) {
  const label = crestLabel(balance);
  return (
    <span title={label} className="inline-flex h-6 min-w-0 max-w-full items-center gap-1 rounded-full border border-line bg-surface-2 px-1.5 text-xs">
      <CrestIcon url={balance.iconUrl} size={16} fallback={<span aria-hidden="true" className="truncate">{crestShortName(balance)}</span>} />
      <span aria-hidden="true" className="font-mono">{balance.quantity}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
```

- [ ] **Step 4: Rework `crestLine` and the character card**

`src/components/character-card/crest-line.ts`:

```ts
import type { CrestBalance } from '@/core/gear/crests';
import { formatAge } from '@/core/format';

interface CrestLineInput {
  crests: { balances: CrestBalance[]; pastedAt: number } | null;
  /** When the gear itself came from the same paste, its age is already shown beside the source. */
  gearFromSimc: boolean;
  upgradesReady: number;
}

/** The crest line on a character card: balances to show as chips, then how many BiS upgrades they pay for. */
export function crestLine({ crests, gearFromSimc, upgradesReady }: CrestLineInput, now: number): { balances: CrestBalance[]; text: string; tone: string } {
  if (!crests) return { balances: [], text: 'Crests unknown: paste SimC', tone: 'text-muted' };
  const ready = upgradesReady === 0 ? 'no BiS upgrades affordable' : `${upgradesReady} BiS ${upgradesReady === 1 ? 'upgrade' : 'upgrades'} ready`;
  const tone = upgradesReady === 0 ? 'text-muted' : 'text-upgrade';
  const lead = crests.balances.length === 0 ? 'No crests' : gearFromSimc ? '' : `Pasted ${formatAge(crests.pastedAt, now)}`;
  const text = lead ? `${lead}: ${ready}` : ready.charAt(0).toUpperCase() + ready.slice(1);
  return { balances: crests.balances, text, tone };
}
```

In `src/components/character-card/CharacterCard.tsx`, import `CrestChip` from `@/components/crest-chip/CrestChip` and replace `<span className={`text-sm ${crests.tone}`}>{crests.text}</span>` with:

```tsx
          <span className="flex flex-wrap items-center gap-1.5">
            {crests.balances.map((b) => <CrestChip key={b.currencyId} balance={b} />)}
            <span className={`text-sm ${crests.tone}`}>{crests.text}</span>
          </span>
```

- [ ] **Step 5: Use the icons in `CrestSummary` and `UpgradeBadge`**

In `src/components/crest-summary/CrestSummary.tsx`, import `CrestChip` and replace the `crests.balances.map(...)` block with:

```tsx
      {crests.balances.map((b) => <CrestChip key={b.currencyId} balance={b} />)}
```

In `src/components/upgrade-badge/UpgradeBadge.tsx`, import `CrestIcon` from `@/components/crest-chip/CrestIcon` and insert before `{steps}`:

```tsx
      <CrestIcon url={upgrade.iconUrl} size={13} fallback={null} />
```

The badge's `title` already names the crest and cost, so a missing icon leaves today's badge.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/components && npm run typecheck`
Expected: PASS. Fix any component test that built a `CrestBalance` or `UpgradeOption` without `iconUrl` by adding `iconUrl: null`.

- [ ] **Step 7: Commit**

```bash
git add src/components/crest-chip src/components/crest-summary src/components/upgrade-badge src/components/character-card
git commit -m "feat: show crest icons instead of crest names"
```

Body:

```
Crests now show as their icon and count on the group headers, the
character page, character cards and upgrade badges, with the full name
on hover. When the icon is missing or the browser can't load it, the
chip shows the crest's first word, as the character card always did.
```

---

### Task 5: Tier credits carry the tier piece

**Files:**
- Modify: `src/core/priority/rank.ts:16-19,51-55`, `src/core/priority/priority.test.ts:64`, `src/server/views/types.ts:71-74`, `src/server/views/member.ts` (`creditView`), `src/server/views/group-page.ts:69`, `src/server/views/character-page.ts:37`, `src/components/character-page/DungeonPriority.tsx`, `src/components/character-page/DungeonPriority.test.ts`

**Interfaces:**
- Produces: `Credit` tier variant `{ kind: 'tier'; slotLabel: string; weight: number; itemId: number; name: string; bonusIds: number[] }`; `PriorityCreditView` tier variant `{ kind: 'tier'; slotLabel: string; weight: number; item: ItemView }`.

- [ ] **Step 1: Write the failing engine test**

In `src/core/priority/priority.test.ts:64`, change the expectation to:

```ts
    expect(ranks[0]!.characters[0]!.credits).toEqual([{ kind: 'tier', slotLabel: 'CHEST', weight: 4, itemId: 80, name: 'BiS 80', bonusIds: [] }]);
```

Run: `npx vitest run src/core/priority`
Expected: FAIL, the credit lacks `itemId`, `name` and `bonusIds`.

- [ ] **Step 2: Carry the piece in the engine**

In `src/core/priority/rank.ts`, change the tier variant of `Credit`:

```ts
  | { kind: 'tier'; slotLabel: string; weight: number; itemId: number; name: string; bonusIds: number[] }
```

and in `creditFor`:

```ts
  if (row.isTier) return { kind: 'tier', slotLabel: row.slotLabel, weight, itemId: row.itemId, name: row.name, bonusIds: row.bonusIds };
```

Run: `npx vitest run src/core/priority`
Expected: PASS. Scores and order are unchanged; only the credit shape grew.

- [ ] **Step 3: Carry the item view through the loaders**

In `src/server/views/types.ts`, change the tier variant of `PriorityCreditView`:

```ts
  | { kind: 'tier'; slotLabel: string; weight: number; item: ItemView }
```

In `src/server/views/member.ts`, replace `creditView`:

```ts
export function creditView(cr: Credit, icons: ReadonlyMap<number, string | null>): PriorityCreditView {
  if (cr.kind === 'any') return cr;
  const item = itemView({ itemId: cr.itemId, name: cr.name, itemLevel: null, quality: 'EPIC', bonusIds: cr.bonusIds }, icons, null);
  return cr.kind === 'item'
    ? { kind: 'item', slotLabel: cr.slotLabel, weight: cr.weight, item }
    : { kind: 'tier', slotLabel: cr.slotLabel, weight: cr.weight, item };
}
```

In `src/server/views/group-page.ts:69` and `src/server/views/character-page.ts:37`, collect icons for tier credits too, changing `(cr.kind === 'item' ? [cr.itemId] : [])` to:

```ts
(cr.kind === 'any' ? [] : [cr.itemId])
```

- [ ] **Step 4: Show the piece on the character page**

In `src/components/character-page/DungeonPriority.test.ts`, change the tier credit fixture at line 17 to carry an item and add an expectation:

```ts
        { kind: 'tier', slotLabel: 'Chest', weight: 4,
          item: { itemId: 80, name: 'Enigmatic Dreamwatcher’s Robe', itemLevel: null, quality: 'EPIC', bonusIds: [], iconUrl: null, trackLabel: null } },
```

```ts
    expect(html).toContain('Enigmatic Dreamwatcher’s Robe');
    expect(html).toContain('Chest · tier via catalyst · weight 4');
```

Run: `npx vitest run src/components/character-page`
Expected: FAIL.

In `src/components/character-page/DungeonPriority.tsx`, replace the `Credit` function:

```tsx
function Credit({ credit }: { credit: PriorityCreditView }) {
  if (credit.kind !== 'any') {
    const detail = credit.kind === 'tier' ? `${credit.slotLabel} · tier via catalyst · weight ${credit.weight}` : `${credit.slotLabel} · weight ${credit.weight}`;
    return (
      <ItemCard itemId={credit.item.itemId} name={credit.item.name} quality={credit.item.quality} iconUrl={credit.item.iconUrl}
        bonusIds={credit.item.bonusIds} itemLevel={null} detail={detail} />
    );
  }
  return (
    <p className="text-[15px]">
      <span className="font-semibold">{credit.slotLabel}</span>
      <span className="text-muted"> · Any item, level {credit.minItemLevel}+ · weight {credit.weight}</span>
    </p>
  );
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: the group-priority tests that build `{ kind: 'tier', slotLabel, weight }` without `item` fail typecheck. Task 7 replaces those files; for now add the same `item` object to the tier fixtures in `GroupPriority.test.ts`, `CreditCard.test.ts` and `credit-text.test.ts` so the suite is green at this commit.

- [ ] **Step 6: Commit**

```bash
git add src/core/priority src/server/views src/components/character-page src/components/group-priority
git commit -m "feat: name the tier piece a dungeon need is for"
```

---

### Task 6: Pure helpers for cells and chips

**Files:**
- Create: `src/components/state-badge/state-labels.ts`, `src/components/group-grid/state-word.ts`, `src/components/group-grid/state-word.test.ts`, `src/components/group-grid/slot-short.ts`, `src/components/group-grid/slot-short.test.ts`, `src/components/group-grid/cell-label.ts`, `src/components/group-grid/cell-label.test.ts`, `src/components/group-priority/credit-slot.ts`, `src/components/group-priority/credit-slot.test.ts`, `src/components/group-priority/chip-label.ts`, `src/components/group-priority/chip-label.test.ts`
- Modify: `src/components/state-badge/StateBadge.tsx`, `src/components/group-grid/cell-note.ts`, `src/components/group-grid/cell-note.test.ts:23`

**Interfaces:**
- Produces: `STATE_LABELS: Record<ItemState, { text: string; className: string }>`; `stateWord(state: ItemState, tierNeed: boolean): { word: string; className: string }`; `SLOT_SHORT: Record<SlotType, string>`; `cellLabel(memberName: string, slotLabel: string, cell: GearRowView): string`; `creditSlot(label: string): string`; `chipLabel(credit: PriorityCreditView): string`.

- [ ] **Step 1: Write the failing tests**

`src/components/group-grid/state-word.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stateWord } from './state-word';

describe('stateWord', () => {
  it('gives each state one short word, in its state color', () => {
    expect(stateWord('done', false)).toEqual({ word: 'Done', className: 'text-gold' });
    expect(stateWord('mythUpgradable', false)).toEqual({ word: 'Crests', className: 'text-crest' });
    expect(stateWord('belowMyth', false)).toEqual({ word: 'Vault', className: 'text-vault' });
    expect(stateWord('inBags', false)).toEqual({ word: 'Bags', className: 'text-bags' });
    expect(stateWord('missing', false)).toEqual({ word: 'Need', className: 'text-muted' });
  });

  it('says Need tier for a missing tier piece, and only for missing', () => {
    expect(stateWord('missing', true).word).toBe('Need tier');
    expect(stateWord('done', true).word).toBe('Done');
  });
});
```

`src/components/group-grid/slot-short.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SLOT_TYPES } from '@/core/types';
import { SLOT_SHORT } from './slot-short';

describe('SLOT_SHORT', () => {
  it('gives every slot a label of at most seven characters', () => {
    for (const slot of SLOT_TYPES) expect(SLOT_SHORT[slot].length).toBeLessThanOrEqual(7);
  });

  it('numbers rings and trinkets and shortens the long ones', () => {
    expect([SLOT_SHORT.SHOULDER, SLOT_SHORT.FINGER_2, SLOT_SHORT.TRINKET_1, SLOT_SHORT.MAIN_HAND, SLOT_SHORT.OFF_HAND])
      .toEqual(['Shldr', 'Ring 2', 'Trink 1', 'Weap', 'Off-h']);
  });
});
```

`src/components/group-grid/cell-label.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GearRowView } from '@/server/views/types';
import { cellLabel } from './cell-label';

const equipped = { itemId: 1, name: 'Enigmatic Dreamwatcher’s Somnolent Stare', itemLevel: 321, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: 'Myth 2/6' };
const bis = { kind: 'item' as const, ...equipped, isTier: false, isCatalyst: false, source: '' };
const cell = (over: Partial<GearRowView>): GearRowView => ({ slotLabel: 'Head', slot: 'HEAD', state: 'mythUpgradable', equipped, upgrade: null, bis, ...over });

describe('cellLabel', () => {
  it('reads member, slot, item, item level and state in full', () => {
    expect(cellLabel('Birkibjörn', 'Head', cell({}))).toBe('Birkibjörn, Head: Enigmatic Dreamwatcher’s Somnolent Stare, item level 321, upgrade with crests');
  });

  it('adds the upgrade, and says when nothing is equipped', () => {
    const upgrade = { steps: 4, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, iconUrl: null };
    expect(cellLabel('Birkibjörn', 'Head', cell({ upgrade }))).toMatch(/, can upgrade now$/);
    expect(cellLabel('Skjaldbaka', 'Ring 1', cell({ equipped: null, state: 'missing' }))).toBe('Skjaldbaka, Ring 1: nothing equipped, missing');
  });
});
```

`src/components/group-priority/credit-slot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { creditSlot } from './credit-slot';

describe('creditSlot', () => {
  it('shortens Method’s long slot labels', () => {
    expect(['Shoulder', 'Shoulders', 'Trinket', 'Weapon', 'Main Hand', 'Main-Hand', 'Off Hand', 'Off-Hand'].map(creditSlot))
      .toEqual(['Shldr', 'Shldr', 'Trink', 'Weap', 'Weap', 'Weap', 'Off-h', 'Off-h']);
  });

  it('keeps the other Method labels as they are, rings unnumbered', () => {
    const kept = ['Head', 'Neck', 'Cloak', 'Back', 'Chest', 'Wrist', 'Wrists', 'Gloves', 'Hands', 'Belt', 'Waist', 'Legs', 'Boots', 'Feet', 'Ring'];
    expect(kept.map(creditSlot)).toEqual(kept);
  });

  it('returns an unknown label unchanged', () => {
    expect(creditSlot('Relic')).toBe('Relic');
  });
});
```

`src/components/group-priority/chip-label.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chipLabel } from './chip-label';

const item = (name: string) => ({ itemId: 1, name, itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null });

describe('chipLabel', () => {
  it('names an item and its slot', () => {
    expect(chipLabel({ kind: 'item', slotLabel: 'Cloak', weight: 3, item: item('Cloak of the Restless Tribes') })).toBe('Cloak of the Restless Tribes (Cloak)');
  });

  it('names the tier piece and how it is earned', () => {
    expect(chipLabel({ kind: 'tier', slotLabel: 'Shoulders', weight: 5, item: item('Enigmatic Dreamwatcher’s Plumage') }))
      .toBe('Enigmatic Dreamwatcher’s Plumage (Shoulders), tier: catalyst a shoulders drop from this dungeon');
  });

  it('describes an Any need by slot and level', () => {
    expect(chipLabel({ kind: 'any', slotLabel: 'Ring', weight: 2, minItemLevel: 334 })).toBe('Any ring, level 334+');
  });
});
```

In `src/components/group-grid/cell-note.test.ts:23`, change the tier expectation:

```ts
    expect(needText(row({ ...named, isTier: true }))).toBe('Need: Greathelm (tier, via catalyst)');
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/group-grid src/components/group-priority/credit-slot.test.ts src/components/group-priority/chip-label.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/components/state-badge/state-labels.ts`:

```ts
import type { ItemState } from '@/core/types';

/** The badge wording for each state. Cells reuse it in their accessible names. */
export const STATE_LABELS: Record<ItemState, { text: string; className: string }> = {
  done: { text: 'Done', className: 'text-gold' },
  mythUpgradable: { text: 'Upgrade with crests', className: 'text-crest' },
  belowMyth: { text: 'Great Vault target', className: 'text-vault' },
  inBags: { text: 'BiS in bags', className: 'text-bags' },
  missing: { text: 'Missing', className: 'text-muted' },
};
```

In `src/components/state-badge/StateBadge.tsx`, delete the local `LABELS` and use `STATE_LABELS` from `./state-labels`.

`src/components/group-grid/state-word.ts`:

```ts
import { STATE_LABELS } from '@/components/state-badge/state-labels';
import type { ItemState } from '@/core/types';

const WORDS: Record<ItemState, string> = { done: 'Done', mythUpgradable: 'Crests', belowMyth: 'Vault', inBags: 'Bags', missing: 'Need' };

/** The compact cell's one word. A missing tier piece says so, since the icon shows the equipped item. */
export function stateWord(state: ItemState, tierNeed: boolean): { word: string; className: string } {
  return { word: state === 'missing' && tierNeed ? 'Need tier' : WORDS[state], className: STATE_LABELS[state].className };
}
```

`src/components/group-grid/slot-short.ts`:

```ts
import type { SlotType } from '@/core/types';

/** Slot labels that fit a 44 px phone column. The full label stays for screen readers. */
export const SLOT_SHORT: Record<SlotType, string> = {
  HEAD: 'Head', NECK: 'Neck', SHOULDER: 'Shldr', BACK: 'Cloak', CHEST: 'Chest', WRIST: 'Wrist', HANDS: 'Gloves',
  WAIST: 'Belt', LEGS: 'Legs', FEET: 'Boots', FINGER_1: 'Ring 1', FINGER_2: 'Ring 2', TRINKET_1: 'Trink 1',
  TRINKET_2: 'Trink 2', MAIN_HAND: 'Weap', OFF_HAND: 'Off-h',
};
```

`src/components/group-grid/cell-label.ts`:

```ts
import { STATE_LABELS } from '@/components/state-badge/state-labels';
import type { GearRowView } from '@/server/views/types';

/** The compact cell button's accessible name: everything the cell abbreviates, in words. */
export function cellLabel(memberName: string, slotLabel: string, cell: GearRowView): string {
  const item = cell.equipped
    ? `${cell.equipped.name}${cell.equipped.itemLevel ? `, item level ${cell.equipped.itemLevel}` : ''}`
    : 'nothing equipped';
  const upgrade = cell.upgrade ? ', can upgrade now' : '';
  return `${memberName}, ${slotLabel}: ${item}, ${STATE_LABELS[cell.state].text.toLowerCase()}${upgrade}`;
}
```

`src/components/group-priority/credit-slot.ts`:

```ts
const SHORT: Record<string, string> = {
  Shoulder: 'Shldr', Shoulders: 'Shldr', Trinket: 'Trink', Weapon: 'Weap', 'Main Hand': 'Weap', 'Main-Hand': 'Weap', 'Off Hand': 'Off-h', 'Off-Hand': 'Off-h',
};

/** Method's slot label, short enough to sit under a 32 px chip. Unknown labels pass through. */
export const creditSlot = (label: string) => SHORT[label] ?? label;
```

`src/components/group-priority/chip-label.ts`:

```ts
import type { PriorityCreditView } from '@/server/views/types';

/** What a need chip says on hover and to screen readers. */
export function chipLabel(credit: PriorityCreditView): string {
  switch (credit.kind) {
    case 'item': return `${credit.item.name} (${credit.slotLabel})`;
    case 'tier': return `${credit.item.name} (${credit.slotLabel}), tier: catalyst a ${credit.slotLabel.toLowerCase()} drop from this dungeon`;
    case 'any': return `Any ${credit.slotLabel.toLowerCase()}, level ${credit.minItemLevel}+`;
  }
}
```

In `src/components/group-grid/cell-note.ts`, in `needText`, change the tier line to:

```ts
  if (cell.bis.isTier) return `Need: ${cell.bis.name} (tier, via catalyst)`;
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/state-badge src/components/group-grid src/components/group-priority
git commit -m "feat: add the word, label and slot helpers for compact cells and chips"
```

---

### Task 7: Collapsible dungeon rows with need chips

**Files:**
- Create: `src/components/group-priority/CreditChip.tsx`, `src/components/group-priority/DungeonRow.tsx`
- Modify: `src/components/group-priority/GroupPriority.tsx`, `src/components/group-priority/GroupPriority.test.ts`, `src/components/group-priority/DungeonThumbnail.tsx`
- Delete: `src/components/group-priority/CreditCard.tsx`, `CreditCard.test.ts`, `DungeonCard.tsx`, `MemberNeeds.tsx`, `credit-text.ts`, `credit-text.test.ts`

**Interfaces:**
- Consumes: `chipLabel`, `creditSlot` (Task 6); tier `item` on `PriorityCreditView` (Task 5).
- Produces: `<GroupPriority priority={GroupPriorityView} />` rendering a heading and rows with no outer box; Task 9 boxes it.

- [ ] **Step 1: Rewrite the structure tests**

In `src/components/group-priority/GroupPriority.test.ts`, give the tier fixture an item, keep the notice tests (`ranks dungeons…`, `says the ranking is unavailable…`, `names who a partial ranking covers…`, `says the group needs nothing…`, `shows the season states…`, `keeps two members with the same display name apart`), and replace the structure tests (`gives each ranked dungeon its own card…`, `shows a lazy decorative thumbnail…`, `lists each member under their name…`, `puts the split warning inside…`) with:

```ts
const plumage = { itemId: 271526, name: 'Enigmatic Dreamwatcher’s Plumage', itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: 'https://render.worldofwarcraft.com/icons/56/plumage.jpg', trackLabel: null };

  it('makes each dungeon a details row, the first one open', () => {
    const html = render({ ...base, ranking: { dungeons: [dungeon({}), dungeon({ challengeModeId: 502, name: 'Beta Spire', shortName: 'BS' })], nothingFrom: [] } });
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html.indexOf('<details open=""')).toBeLessThan(html.indexOf('Alpha Hollow'));
    expect(html.indexOf('Alpha Hollow')).toBeLessThan(html.indexOf('Beta Spire'));
    expect(html.match(/<details open=""/g)).toHaveLength(1);
  });

  it('shows each benefiting member in the summary with avatar and need count', () => {
    const html = render({ ...base, ranking: { dungeons: [dungeon({ members: [{ ...credits, credits: [band, band] }] })], nothingFrom: [] } });
    const summary = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));
    expect(summary).toContain('title="Birkibjörn: 2 needs"');
    expect(summary).toContain('<span class="sr-only">Birkibjörn: </span>2');
  });

  it('shows a tier need as the tier piece with a T badge and its slot, labeled in full', () => {
    const tier: PriorityCreditView = { kind: 'tier', slotLabel: 'Shoulders', weight: 5, item: plumage };
    const html = render({ ...base, ranking: { dungeons: [dungeon({ members: [{ ...credits, credits: [tier] }] })], nothingFrom: [] } });
    expect(html).toContain('href="https://www.wowhead.com/item=271526"');
    expect(html).toContain('aria-label="Enigmatic Dreamwatcher’s Plumage (Shoulders), tier: catalyst a shoulders drop from this dungeon"');
    expect(html).toContain('>T</span>');
    expect(html).toContain('>Shldr</span>');
  });

  it('falls back to a labeled T tile for a tier piece without an icon', () => {
    const tier: PriorityCreditView = { kind: 'tier', slotLabel: 'Chest', weight: 5, item: { ...plumage, iconUrl: null, name: 'Enigmatic Dreamwatcher’s Robe' } };
    const html = render({ ...base, ranking: { dungeons: [dungeon({ members: [{ ...credits, credits: [tier] }] })], nothingFrom: [] } });
    expect(html).not.toContain('<img src="null"');
    expect(html).toContain('aria-label="Enigmatic Dreamwatcher’s Robe (Chest), tier: catalyst a chest drop from this dungeon"');
  });

  it('shows an Any need as its item level, with the slot and the weight on hover', () => {
    const any: PriorityCreditView = { kind: 'any', slotLabel: 'Ring', weight: 2, minItemLevel: 334 };
    const html = render({ ...base, ranking: { dungeons: [dungeon({ members: [{ ...credits, credits: [any] }] })], nothingFrom: [] } });
    expect(html).toContain('>334<');
    expect(html).toContain('Any ring, level 334+');
    expect(html).toContain('title="Any ring, level 334+ · weight 2"');
  });

  it('puts the split warning inside its own row, above its members', () => {
    const html = render({ ...base, ranking: { dungeons: [dungeon({ split: true })], nothingFrom: [] } });
    const row = html.slice(html.indexOf('<details'), html.indexOf('</details>'));
    expect(row.indexOf('Split dungeon: loot shown for the whole instance.')).toBeGreaterThan(row.indexOf('</summary>'));
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/group-priority/GroupPriority.test.ts`
Expected: FAIL.

- [ ] **Step 3: Shrink the thumbnail**

In `src/components/group-priority/DungeonThumbnail.tsx`, change `BOX` to `'h-9 w-12 shrink-0 rounded-md'`, the fallback text to `text-[10px]`, and the image's `width={48} height={36}`.

- [ ] **Step 4: Write `CreditChip`**

`src/components/group-priority/CreditChip.tsx`:

```tsx
import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import type { PriorityCreditView } from '@/server/views/types';
import { chipLabel } from './chip-label';
import { creditSlot } from './credit-slot';

const TILE = 'relative flex size-8 shrink-0 items-center justify-center rounded-md border-2';
const DASHED = `${TILE} border-dashed border-[#a335ee] bg-surface-2 text-[#c58cf5]`;

/** One need: a 32 px tile with its slot under it. Items and tier pieces link to Wowhead. */
export function CreditChip({ credit }: { credit: PriorityCreditView }) {
  const label = chipLabel(credit);
  return (
    <span title={`${label} · weight ${credit.weight}`} className="flex w-11 flex-col items-center gap-0.5">
      {credit.kind === 'any' ? (
        <span className={`${DASHED} font-mono text-[11px]`}>
          <span aria-hidden="true">{credit.minItemLevel}</span>
          <span className="sr-only">{label}</span>
        </span>
      ) : (
        <a href={`https://www.wowhead.com/item=${credit.item.itemId}`} data-wowhead={wowheadData(credit.item.itemId, credit.item.bonusIds, null)}
          target="_blank" rel="noreferrer" aria-label={label}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
          {credit.item.iconUrl ? (
            <span className={TILE} style={{ borderColor: (QUALITY_STYLES[credit.item.quality] ?? QUALITY_STYLES.EPIC).ring }}>
              <img src={credit.item.iconUrl} alt="" width={28} height={28} className="size-7 rounded-sm" />
              {credit.kind === 'tier' && <TierBadge />}
            </span>
          ) : (
            <span className={`${DASHED} font-display text-sm font-bold`}>{credit.kind === 'tier' ? 'T' : ''}</span>
          )}
        </a>
      )}
      <span aria-hidden="true" className="max-w-full truncate text-[10px] text-muted">{creditSlot(credit.slotLabel)}</span>
    </span>
  );
}

function TierBadge() {
  return <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 rounded bg-gold px-1 text-[9px] font-bold leading-tight text-bg">T</span>;
}
```

- [ ] **Step 5: Write `DungeonRow`**

`src/components/group-priority/DungeonRow.tsx`:

```tsx
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { classTextColor } from '@/components/shared/class-colors';
import { SPLIT_DUNGEON } from '@/components/shared/priority-copy';
import type { GroupDungeonView } from '@/server/views/types';
import { CreditChip } from './CreditChip';
import { DungeonThumbnail } from './DungeonThumbnail';

/** One ranked dungeon as a native disclosure: who benefits in the summary, their needs inside. */
export function DungeonRow({ dungeon, rank }: { dungeon: GroupDungeonView; rank: number }) {
  return (
    <details open={rank === 1} className="group rounded-xl border border-line-strong bg-raised">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl p-2.5 focus-visible:outline-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
        <span className="w-7 shrink-0 text-center font-mono text-lg font-bold">{rank}</span>
        <DungeonThumbnail imageUrl={dungeon.imageUrl} shortName={dungeon.shortName} />
        <span className="flex min-w-0 grow flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 truncate font-display text-base font-bold">{dungeon.name}</h3>
            <span className="shrink-0 font-mono text-gold"><span className="sr-only">Score </span>{dungeon.score}</span>
          </span>
          <span className="flex flex-wrap gap-1">
            {dungeon.members.map((m) => (
              <span key={m.key} title={`${m.name}: ${m.credits.length} ${m.credits.length === 1 ? 'need' : 'needs'}`}
                className="inline-flex h-[22px] items-center gap-1 rounded-full border border-line bg-surface pl-0.5 pr-1.5 font-mono text-xs">
                <CharacterAvatar name={m.name} className={m.className} avatarUrl={m.avatarUrl} classIconUrl={m.classIconUrl} size={18} />
                <span className="sr-only">{m.name}: </span>{m.credits.length}
              </span>
            ))}
          </span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" className="shrink-0 text-muted transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className="flex flex-col gap-2.5 px-2.5 pb-3 sm:pl-12">
        {dungeon.split && <p className="text-xs text-muted">{SPLIT_DUNGEON}</p>}
        {dungeon.members.map((m) => (
          <div key={m.key} className="flex items-start gap-2">
            <span className="flex w-28 min-w-0 shrink-0 items-center gap-1.5 pt-1.5">
              <CharacterAvatar name={m.name} className={m.className} avatarUrl={m.avatarUrl} classIconUrl={m.classIconUrl} size={20} />
              <span className="truncate text-sm font-semibold" style={{ color: classTextColor(m.className) }}>{m.name}</span>
            </span>
            <ul className="flex flex-wrap gap-1">
              {m.credits.map((c, j) => <li key={j}><CreditChip credit={c} /></li>)}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
```

- [ ] **Step 6: Use the rows in `GroupPriority`**

In `src/components/group-priority/GroupPriority.tsx`, replace the `DungeonCard` import with `import { DungeonRow } from './DungeonRow';`, render the list as:

```tsx
      <ol className="flex flex-col gap-1.5">
        {dungeons.map((d, i) => <li key={d.challengeModeId} className="min-w-0"><DungeonRow dungeon={d} rank={i + 1} /></li>)}
      </ol>
```

and change the `<section>` class to `flex flex-col gap-3` (the outer box moves to `GroupLayout` in Task 9). Keep every notice, its wording and order.

Delete `CreditCard.tsx`, `CreditCard.test.ts`, `DungeonCard.tsx`, `MemberNeeds.tsx`, `credit-text.ts` and `credit-text.test.ts`.

- [ ] **Step 7: Run tests, typecheck and lint**

Run: `npx vitest run src/components/group-priority && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A src/components/group-priority
git commit -m "feat: collapse dungeon priority rows and show needs as chips"
```

Body:

```
With five members the mini cards pushed the list far down. Each
dungeon is now a native disclosure, the first one open, and each need
is a 32 px chip with its slot underneath, so the slot reads without
hovering. A tier need shows the tier piece itself with a T badge. This
replaces the mini cards of the dungeon priority spec's decision 3.
```

---

### Task 8: The compact gear grid

**Files:**
- Create: `src/components/group-grid/member-notices.ts`, `src/components/group-grid/member-notices.test.ts`, `src/components/group-grid/MemberNotices.tsx`, `src/components/cell-details/CellDetails.tsx`, `src/components/cell-details/position.ts`, `src/components/cell-details/position.test.ts`
- Modify: `src/components/group-grid/GroupCell.tsx`, `src/components/group-grid/MemberHeader.tsx`, `src/components/group-grid/GroupGrid.tsx`, `src/components/group-grid/GroupGrid.test.ts`

**Interfaces:**
- Consumes: `stateWord`, `SLOT_SHORT`, `cellLabel`, `needText` (Task 6); `CrestChip` (Task 4); Task 1's tooltip decision.
- Produces: `<GroupGrid members grid tracksKnown />` (the `now` prop is dropped); `memberNotices(member: GroupMemberView): MemberNotice[]`; `placeBeside(cell: Box, card: Size, viewport: Size): { top: number; left: number }`.

- [ ] **Step 1: Write the failing helper tests**

`src/components/group-grid/member-notices.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GroupMemberView } from '@/server/views/types';
import { memberNotices } from './member-notices';

const member = (over: Partial<GroupMemberView>): GroupMemberView => ({
  key: 'eu.argent-dawn.birkibjörn', name: 'Birkibjörn', realmSlug: 'argent-dawn', character: null, state: 'ready',
  syncError: null, bisError: null, hasRows: true, listType: 'mythicPlus', fellBack: false, crests: null, ...over,
});

describe('memberNotices', () => {
  it('has nothing to say about a ready member', () => {
    expect(memberNotices(member({}))).toEqual([]);
  });

  it('keeps today’s wording for each problem', () => {
    expect(memberNotices(member({ state: 'untracked' }))).toEqual([{ kind: 'untracked', text: 'Not tracked · argent-dawn' }]);
    expect(memberNotices(member({ state: 'notFound' }))).toEqual([{ kind: 'notFound', text: 'Blizzard can’t find this character' }]);
    expect(memberNotices(member({ syncError: 'Blizzard returned 503' }))).toEqual([{ kind: 'syncError', text: 'Couldn’t sync: Blizzard returned 503' }]);
    expect(memberNotices(member({ bisError: 'Method is down' }))).toEqual([{ kind: 'bisError', text: 'Method is down' }]);
  });

  it('lists a sync error and a BiS error together', () => {
    expect(memberNotices(member({ syncError: 'timeout', bisError: 'Method is down' })).map((n) => n.kind)).toEqual(['syncError', 'bisError']);
  });
});
```

`src/components/cell-details/position.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { placeBeside } from './position';

const viewport = { width: 1280, height: 800 };
const card = { width: 320, height: 240 };
const cell = (left: number, top: number) => ({ left, top, right: left + 140, bottom: top + 56 });

describe('placeBeside', () => {
  it('puts the card below the cell, aligned to its left edge', () => {
    expect(placeBeside(cell(100, 100), card, viewport)).toEqual({ top: 164, left: 100 });
  });

  it('puts it above when there is no room below', () => {
    expect(placeBeside(cell(100, 700), card, viewport)).toEqual({ top: 452, left: 100 });
  });

  it('keeps it inside the viewport on the right and at the top', () => {
    expect(placeBeside(cell(1200, 100), card, viewport).left).toBe(952);
    expect(placeBeside(cell(100, 100), { width: 320, height: 790 }, viewport).top).toBe(8);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/group-grid/member-notices.test.ts src/components/cell-details`
Expected: FAIL.

- [ ] **Step 3: Implement the helpers**

`src/components/group-grid/member-notices.ts`:

```ts
import type { GroupMemberView } from '@/server/views/types';

export type MemberNotice = { kind: 'untracked' | 'notFound' | 'syncError' | 'bisError'; text: string };

/** What a member's notice row says. Wording is unchanged from the old column header. */
export function memberNotices(m: GroupMemberView): MemberNotice[] {
  if (m.state === 'untracked') return [{ kind: 'untracked', text: `Not tracked · ${m.realmSlug}` }];
  if (m.state === 'notFound') return [{ kind: 'notFound', text: 'Blizzard can’t find this character' }];
  const notices: MemberNotice[] = [];
  if (m.syncError) notices.push({ kind: 'syncError', text: `Couldn’t sync: ${m.syncError}` });
  if (m.bisError) notices.push({ kind: 'bisError', text: m.bisError });
  return notices;
}
```

`src/components/cell-details/position.ts`:

```ts
export interface Box { left: number; top: number; right: number; bottom: number }
export interface Size { width: number; height: number }

const MARGIN = 8;

/** Below the cell, or above it when there is no room below, always inside the viewport. */
export function placeBeside(cell: Box, card: Size, viewport: Size): { top: number; left: number } {
  const below = cell.bottom + MARGIN;
  const above = cell.top - MARGIN - card.height;
  const top = below + card.height <= viewport.height - MARGIN ? below : above;
  const left = Math.min(cell.left, viewport.width - MARGIN - card.width);
  return { top: Math.max(MARGIN, top), left: Math.max(MARGIN, left) };
}
```

Run: `npx vitest run src/components/group-grid/member-notices.test.ts src/components/cell-details`
Expected: PASS.

- [ ] **Step 4: Rewrite the grid tests**

Replace the two tests in `src/components/group-grid/GroupGrid.test.ts` (keep the imports, mocks and helpers; drop `now: 0` from `render`) with:

```ts
const equipped = { itemId: 271528, name: 'Enigmatic Dreamwatcher’s Somnolent Stare', itemLevel: 321, quality: 'EPIC' as const, bonusIds: [12], iconUrl: 'https://render.worldofwarcraft.com/icons/56/stare.jpg', trackLabel: 'Myth 2/6' };
const cell = (over: Partial<GearRowView>): GearRowView => ({
  slotLabel: 'Head', slot: 'HEAD', state: 'mythUpgradable', equipped, upgrade: null,
  bis: { kind: 'item', ...equipped, isTier: false, isCatalyst: false, source: '' }, ...over,
});

  it('puts member problems in one notice row, with avatar, name, wording and button', () => {
    const html = render([
      member({ key: 'eu.argent-dawn.gnúpur', name: 'gnúpur', state: 'untracked', hasRows: false }),
      member({ key: 'eu.argent-dawn.sólrún', name: 'Sólrún', state: 'noGear', hasRows: false, syncError: 'Blizzard returned 503', character: summary(7, 'Sólrún') }),
      member({ key: 'eu.argent-dawn.ylfa', name: 'Ylfa', state: 'notFound', hasRows: false }),
    ], [{ slot: 'HEAD', label: 'Head', cells: [null, null, null] }]);
    const notices = html.slice(html.indexOf('aria-label="Member notices"'));
    expect(notices).toContain('Not tracked · argent-dawn');
    expect(notices).toContain('Couldn’t sync: Blizzard returned 503');
    expect(notices).toContain('Blizzard can’t find this character');
    expect(notices).toContain('Remove from group');
    expect(notices).toContain('Track');
  });

  it('leaves out the notice row when nobody has a problem', () => {
    expect(render([member({ character: summary(3, 'Birkibjörn') })], [])).not.toContain('Member notices');
  });

  it('shows crests as chips and labels the Overall list', () => {
    const crests = { balances: [{ currencyId: 3446, name: 'Myth Mistcrest', quantity: 85, steps: 4, iconUrl: null }], pastedAt: 0 };
    const html = render([member({ listType: 'overall', fellBack: true, crests, character: summary(3, 'Birkibjörn') })], []);
    expect(html).toContain('title="Myth Mistcrest: 85, 4 steps"');
    expect(html).toContain('Overall list');
    expect(html).toContain('title="Birkibjörn"');
  });

  it('makes each cell a button with a full label, a state word, and its own details card', () => {
    const upgrade = { steps: 4, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, iconUrl: null };
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ upgrade })] }]);
    expect(html).toContain('aria-label="Birkibjörn, Head: Enigmatic Dreamwatcher’s Somnolent Stare, item level 321, upgrade with crests, can upgrade now"');
    expect(html).toMatch(/<button[^>]*popovertarget="[^"]+"/);
    expect(html).toContain('>Crests<');
    expect(html).toContain('popover="auto"');
    expect(html).toContain('Enigmatic Dreamwatcher’s Somnolent Stare</a>');
    expect(html).toContain('Myth 2/6 · 321');
  });

  it('says Need tier for a missing tier piece, and the card names the piece', () => {
    const bis = { kind: 'item' as const, ...equipped, name: 'Enigmatic Dreamwatcher’s Plumage', isTier: true, isCatalyst: true, source: '' };
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'SHOULDER', label: 'Shoulders', cells: [cell({ state: 'missing', slot: 'SHOULDER', bis })] }]);
    expect(html).toContain('>Need tier<');
    expect(html).toContain('Need: Enigmatic Dreamwatcher’s Plumage (tier, via catalyst)');
    expect(html).toContain('>Shldr<');
  });
```

Add `GearRowView` to the type import at the top.

Run: `npx vitest run src/components/group-grid/GroupGrid.test.ts`
Expected: FAIL.

- [ ] **Step 5: Write `CellDetails`**

`src/components/cell-details/CellDetails.tsx`:

```tsx
'use client';

import { useRef, type RefObject, type ToggleEvent } from 'react';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { needText } from '@/components/group-grid/cell-note';
import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import { classTextColor } from '@/components/shared/class-colors';
import { StateBadge } from '@/components/state-badge/StateBadge';
import { UpgradeBadge } from '@/components/upgrade-badge/UpgradeBadge';
import type { CharacterSummary, GearRowView } from '@/server/views/types';
import { placeBeside } from './position';

interface Props { id: string; anchor: RefObject<HTMLElement | null>; cell: GearRowView; slotLabel: string; character: CharacterSummary | null; memberName: string }

/** Everything a compact cell abbreviates, in full. A native popover: Escape and outside clicks close it. */
export function CellDetails({ id, anchor, cell, slotLabel, character, memberName }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const onToggle = (e: ToggleEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (e.newState !== 'open' || !el || !anchor.current) return;
    if (window.matchMedia('(min-width: 40rem)').matches) {
      const card = el.getBoundingClientRect();
      const { top, left } = placeBeside(anchor.current.getBoundingClientRect(), card, { width: window.innerWidth, height: window.innerHeight });
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
    }
    el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  };
  const eq = cell.equipped;
  const q = eq ? QUALITY_STYLES[eq.quality] ?? QUALITY_STYLES.COMMON : null;
  const need = needText(cell);
  return (
    <div ref={ref} id={id} popover="auto" onToggle={onToggle}
      className="fixed inset-x-3 top-auto bottom-3 m-0 max-h-[70dvh] w-auto overflow-y-auto rounded-xl border border-line-strong bg-surface p-3 text-ink shadow-2xl sm:inset-auto sm:w-80">
      <div className="flex items-start gap-2">
        <span className="flex min-w-0 grow items-center gap-1.5 text-sm font-semibold">
          {character && <CharacterAvatar name={character.name} className={character.className} avatarUrl={character.avatarUrl} classIconUrl={character.classIconUrl} size={20} />}
          <span style={character ? { color: classTextColor(character.className) } : undefined}>{memberName}</span>
          <span className="text-muted">· {slotLabel}</span>
        </span>
        <button type="button" data-autofocus popoverTarget={id} popoverTargetAction="hide" aria-label="Close item details"
          className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div className="mt-2 flex items-start gap-2.5">
        {eq?.iconUrl
          ? <img src={eq.iconUrl} alt="" width={44} height={44} className="size-11 shrink-0 rounded-md border-2" style={{ borderColor: q!.ring }} />
          : <span aria-hidden="true" className="size-11 shrink-0 rounded-md border-2 border-dashed border-line-strong" />}
        <div className="flex min-w-0 flex-col gap-0.5">
          {eq ? (
            <a href={`https://www.wowhead.com/item=${eq.itemId}`} data-wowhead={wowheadData(eq.itemId, eq.bonusIds, eq.itemLevel)} target="_blank" rel="noreferrer"
              className="font-semibold wrap-anywhere no-underline" style={{ color: q!.text }}>{eq.name}</a>
          ) : <span className="text-muted">Nothing equipped</span>}
          {eq && <span className="font-mono text-[13px] text-muted">{[eq.trackLabel ?? 'no track', eq.itemLevel].filter(Boolean).join(' · ')}</span>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StateBadge state={cell.state} />
        {cell.upgrade && <UpgradeBadge upgrade={cell.upgrade} />}
      </div>
      {need && <p className="mt-2 text-sm wrap-anywhere text-[#cfc7b8]">{need}</p>}
    </div>
  );
}
```

If `ToggleEvent` is not exported from `react` in this version, type the handler as `(e: React.SyntheticEvent<HTMLDivElement> & { newState?: string })` and read `(e.nativeEvent as ToggleEvent).newState`.

- [ ] **Step 6: Write the compact cell**

Replace `src/components/group-grid/GroupCell.tsx`:

```tsx
'use client';

import { useId, useRef } from 'react';
import { CellDetails } from '@/components/cell-details/CellDetails';
import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import { ROW_TONE_STYLES, rowTone } from '@/components/shared/row-tone';
import type { CharacterSummary, GearRowView } from '@/server/views/types';
import { cellLabel } from './cell-label';
import { stateWord } from './state-word';

interface Props { cell: GearRowView | null; tracksKnown: boolean; slotLabel: string; memberName: string; character: CharacterSummary | null }

/** One compact cell: icon, item level, track and a state word. Pressing it opens the details card. */
export function GroupCell({ cell, tracksKnown, slotLabel, memberName, character }: Props) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  if (!cell) return <div className="p-1 text-center text-muted">&mdash;</div>;
  const tone = rowTone(cell.state, tracksKnown);
  const word = stateWord(cell.state, cell.bis.kind === 'item' && cell.bis.isTier);
  const eq = cell.equipped;
  const q = eq ? QUALITY_STYLES[eq.quality] ?? QUALITY_STYLES.COMMON : null;
  return (
    <>
      <button ref={ref} type="button" popoverTarget={id} aria-label={cellLabel(memberName, slotLabel, cell)}
        data-wowhead={eq ? wowheadData(eq.itemId, eq.bonusIds, eq.itemLevel) : undefined}
        className="relative flex min-h-[76px] w-full min-w-0 flex-col items-center gap-0.5 rounded-lg border border-line bg-surface-2 px-0.5 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:min-h-14 sm:flex-row sm:gap-1.5 sm:p-1.5"
        style={tone ? ROW_TONE_STYLES[tone] : undefined}>
        {eq?.iconUrl
          ? <img src={eq.iconUrl} alt="" width={36} height={36} className="size-[34px] shrink-0 rounded-md border-2 sm:size-9" style={{ borderColor: q!.ring }} />
          : <span aria-hidden="true" className="size-[34px] shrink-0 rounded-md border-2 border-dashed border-line-strong sm:size-9" />}
        <span aria-hidden="true" className="flex min-w-0 max-w-full flex-col items-center leading-tight sm:items-start">
          <span className="font-mono text-[11px] text-ink sm:text-xs">{eq?.itemLevel ?? '–'}</span>
          <span className="hidden max-w-full truncate text-xs text-muted sm:block">{eq?.trackLabel ?? 'no track'}</span>
          <span className={`text-[10px] font-bold sm:text-xs ${word.className}`}>{word.word}</span>
        </span>
        {cell.upgrade && (
          <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full border border-[#3e8a4d] bg-[#173020] text-upgrade">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </span>
        )}
      </button>
      <CellDetails id={id} anchor={ref} cell={cell} slotLabel={slotLabel} character={character} memberName={memberName} />
    </>
  );
}
```

**If Task 1 found tooltips do not work on a button:** remove `data-wowhead` from the button, and put the icon in its own link before the button instead, as a sibling inside a `relative flex` wrapper:

```tsx
<a href={`https://www.wowhead.com/item=${eq.itemId}`} data-wowhead={wowheadData(eq.itemId, eq.bonusIds, eq.itemLevel)} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true">
  <img ... />
</a>
```

with the button holding only the text column. The link is out of the tab order because the button and the card's link already reach the same item.

- [ ] **Step 7: Slim the header and add the notice row**

Replace `src/components/group-grid/MemberHeader.tsx`:

```tsx
import Link from 'next/link';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { CrestChip } from '@/components/crest-chip/CrestChip';
import { classTextColor } from '@/components/shared/class-colors';
import type { GroupMemberView } from '@/server/views/types';

/** Avatar, name and crests. Problems live in the notice row below, so every header is the same height. */
export function MemberHeader({ member }: { member: GroupMemberView }) {
  const c = member.character;
  if (!c) return <div className="min-w-0 p-1.5"><span className="block truncate text-sm font-semibold" title={member.name}>{member.name}</span></div>;
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 p-1 sm:items-start sm:p-2">
      <Link href={`/characters/${c.id}`} title={c.name} className="flex min-w-0 max-w-full items-center gap-1.5 font-semibold no-underline" style={{ color: classTextColor(c.className) }}>
        <CharacterAvatar name={c.name} className={c.className} avatarUrl={c.avatarUrl} classIconUrl={c.classIconUrl} size={26} />
        <span className="sr-only truncate sm:not-sr-only">{c.name}</span>
      </Link>
      {member.crests ? (
        member.crests.balances.length > 0
          ? <div className="flex min-w-0 max-w-full flex-col items-center gap-1 sm:flex-row sm:flex-wrap">{member.crests.balances.map((b) => <CrestChip key={b.currencyId} balance={b} />)}</div>
          : <span className="text-xs text-muted">No crests</span>
      ) : <Link href={`/characters/${c.id}`} className="text-xs">No SimC</Link>}
      {member.listType === 'overall' && (
        <span className="text-xs text-muted" title={member.fellBack ? 'Method has no Mythic+ list for this spec' : undefined}>Overall list</span>
      )}
    </div>
  );
}
```

`src/components/group-grid/MemberNotices.tsx`:

```tsx
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { RefreshButton } from '@/components/refresh-button/RefreshButton';
import { RemoveFromGroupButton } from '@/components/remove-from-group/RemoveFromGroupButton';
import { classTextColor } from '@/components/shared/class-colors';
import { TrackButton } from '@/components/track-button/TrackButton';
import type { GroupMemberView } from '@/server/views/types';
import { memberNotices } from './member-notices';

/** One full-width row of member problems, under the column headers. Absent when nobody has one. */
export function MemberNotices({ members }: { members: GroupMemberView[] }) {
  const rows = members.flatMap((m) => memberNotices(m).map((n) => ({ m, n })));
  if (rows.length === 0) return null;
  return (
    <ul aria-label="Member notices" className="col-span-full flex flex-col gap-1.5 border-b border-line px-1 py-2 text-sm">
      {rows.map(({ m, n }) => (
        <li key={`${m.key}-${n.kind}`} className="flex flex-wrap items-center gap-2">
          {m.character && <CharacterAvatar name={m.character.name} className={m.character.className} avatarUrl={m.character.avatarUrl} classIconUrl={m.character.classIconUrl} size={20} />}
          <span className="font-semibold" style={m.character ? { color: classTextColor(m.character.className) } : undefined}>{m.name}</span>
          <span role={n.kind === 'syncError' || n.kind === 'notFound' ? 'alert' : undefined}
            className={n.kind === 'untracked' ? 'text-muted' : 'text-[#f3c9a2]'}>{n.text}</span>
          {n.kind === 'untracked' && <TrackButton memberKey={m.key} name={m.name} />}
          {n.kind === 'notFound' && <RemoveFromGroupButton memberKey={m.key} name={m.name} variant="text" />}
          {n.kind === 'syncError' && m.character && <RefreshButton id={m.character.id} />}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 8: Rebuild `GroupGrid`**

Replace `src/components/group-grid/GroupGrid.tsx`:

```tsx
import type { CSSProperties } from 'react';
import type { GroupGridRow, GroupMemberView } from '@/server/views/types';
import { cellNote } from './cell-note';
import { GroupCell } from './GroupCell';
import { MemberHeader } from './MemberHeader';
import { MemberNotices } from './MemberNotices';
import { SLOT_SHORT } from './slot-short';

interface Props { members: GroupMemberView[]; grid: GroupGridRow[]; tracksKnown: boolean }

const COLUMNS = 'grid-cols-[44px_repeat(var(--members),minmax(0,1fr))] sm:grid-cols-[64px_repeat(var(--members),minmax(0,1fr))]';

export function GroupGrid({ members, grid, tracksKnown }: Props) {
  const notes = members.map((m) => cellNote(m.state, m.hasRows));
  // A member without rows still gets a cell in every row, so the column reads as a column.
  const rows = grid.length > 0 ? grid : [{ slot: 'HEAD' as const, label: '', cells: members.map(() => null) }];
  return (
    <section aria-label="Gear by slot" className="rounded-2xl border border-line bg-surface p-1 sm:p-2">
      <div className={`grid gap-[3px] sm:gap-1.5 ${COLUMNS}`} style={{ '--members': members.length } as CSSProperties}>
        <span className="self-end p-1 text-xs font-semibold uppercase tracking-wider text-muted"><span className="sr-only sm:not-sr-only">Slot</span></span>
        {members.map((m) => <MemberHeader key={m.key} member={m} />)}
        <MemberNotices members={members} />
        {rows.map((row) => (
          <div key={row.slot} className="contents">
            <span className="flex items-center text-xs font-semibold text-muted sm:text-sm">
              <span aria-hidden="true" className="sm:hidden">{SLOT_SHORT[row.slot]}</span>
              <span className="sr-only sm:not-sr-only">{row.label}</span>
            </span>
            {row.cells.map((cell, i) => {
              const note = notes[i];
              if (note) return <div key={i} className={`p-1 text-xs ${note.dim ? 'text-muted opacity-60' : 'text-muted'}`}>{note.text}</div>;
              const m = members[i]!;
              return <GroupCell key={i} cell={cell} tracksKnown={tracksKnown} slotLabel={row.label} memberName={m.name} character={m.character} />;
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
```

`src/app/group/page.tsx` still passes `now` until Task 9; remove it there now (`<GroupGrid members={view.members} grid={view.grid} tracksKnown={view.tracksKnown} />`) so typecheck passes.

- [ ] **Step 9: Run tests, typecheck and lint**

Run: `npx vitest run src/components && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/group-grid src/components/cell-details src/app/group/page.tsx
git commit -m "feat: compact the group gear grid with a details card per cell"
```

Body:

```
Five member columns now fit beside the dungeon rail and on a phone.
Each cell keeps a state word, so color is never the only signal, and
pressing it opens a card with the full item name, its track and what
replaces it, reachable by touch and keyboard. Member problems moved to
one notice row, because a sync error and its button cannot fit a 57 px
column.
```

---

### Task 9: Tabs, the rail and the page

**Files:**
- Create: `src/components/group-layout/GroupLayout.tsx`, `src/components/group-layout/panel-classes.ts`, `src/components/group-layout/panel-classes.test.ts`
- Modify: `src/app/group/page.tsx`, `src/components/group-vault/GroupVault.tsx`, `src/components/group-members/GroupMembers.tsx`

**Interfaces:**
- Consumes: `GroupGrid` (Task 8), `GroupPriority` (Task 7), `GroupVault`.
- Produces: `panelClasses(view: GroupView): PanelClasses`; `<GroupLayout gear dungeons vault dungeonCount />`.

- [ ] **Step 1: Write the failing test**

`src/components/group-layout/panel-classes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { panelClasses } from './panel-classes';

describe('panelClasses', () => {
  it('opens on the grid with the rail on Dungeons at xl, and on Gear alone below', () => {
    expect(panelClasses('gear')).toEqual({
      gear: 'block', rail: 'hidden xl:flex', dungeons: 'hidden xl:block', vault: 'hidden', railDungeonsPressed: true,
    });
  });

  it('shows Dungeons alone below xl, beside the grid at xl', () => {
    expect(panelClasses('dungeons')).toEqual({
      gear: 'hidden xl:block', rail: 'flex', dungeons: 'block', vault: 'hidden', railDungeonsPressed: true,
    });
  });

  it('shows the Vault alone below xl, in the rail at xl', () => {
    expect(panelClasses('vault')).toEqual({
      gear: 'hidden xl:block', rail: 'flex', dungeons: 'hidden', vault: 'block', railDungeonsPressed: false,
    });
  });
});
```

Run: `npx vitest run src/components/group-layout`
Expected: FAIL.

- [ ] **Step 2: Implement `panelClasses`**

`src/components/group-layout/panel-classes.ts`:

```ts
export type GroupView = 'gear' | 'dungeons' | 'vault';
export interface PanelClasses { gear: string; rail: string; dungeons: string; vault: string; railDungeonsPressed: boolean }

/**
 * One view state drives both layouts. Below xl only the chosen panel shows; at xl the grid always
 * shows, and the rail shows Dungeons unless the Vault was chosen. Pure classes, so the server's
 * first paint is right at every width.
 */
export function panelClasses(view: GroupView): PanelClasses {
  return {
    gear: view === 'gear' ? 'block' : 'hidden xl:block',
    rail: view === 'gear' ? 'hidden xl:flex' : 'flex',
    dungeons: view === 'vault' ? 'hidden' : view === 'gear' ? 'hidden xl:block' : 'block',
    vault: view === 'vault' ? 'block' : 'hidden',
    railDungeonsPressed: view !== 'vault',
  };
}
```

Run: `npx vitest run src/components/group-layout`
Expected: PASS.

- [ ] **Step 3: Write `GroupLayout`**

`src/components/group-layout/GroupLayout.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { panelClasses, type GroupView } from './panel-classes';

const TAB = 'flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg font-bold';
const tabTone = (on: boolean) => (on ? 'bg-raised text-ink' : 'text-muted');

interface Props { gear: ReactNode; dungeons: ReactNode; vault: ReactNode; dungeonCount: number }

/** Tabs below xl, the grid beside a sticky rail at xl. The panels are server-rendered slots. */
export function GroupLayout({ gear, dungeons, vault, dungeonCount }: Props) {
  const [view, setView] = useState<GroupView>('gear');
  const c = panelClasses(view);
  const tabs: [GroupView, string][] = [['gear', 'Gear'], ['dungeons', 'Dungeons'], ['vault', 'Vault']];
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Show" className="flex gap-1 rounded-xl border border-line bg-surface p-1 xl:hidden">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`${TAB} ${tabTone(view === id)}`}>
            {label}
            {id === 'dungeons' && <span className="font-mono text-xs text-muted">{dungeonCount}</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className={`${c.gear} min-w-0 xl:flex-1`}>{gear}</div>
        <aside className={`${c.rail} flex-col xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:w-[380px] xl:shrink-0 xl:gap-3 xl:rounded-2xl xl:border xl:border-line xl:bg-surface xl:p-4`}>
          <div role="group" aria-label="Show" className="hidden gap-1 rounded-xl border border-line bg-bg p-1 xl:flex">
            <button type="button" aria-pressed={c.railDungeonsPressed} onClick={() => setView('dungeons')} className={`${TAB} ${tabTone(c.railDungeonsPressed)}`}>Dungeons</button>
            <button type="button" aria-pressed={!c.railDungeonsPressed} onClick={() => setView('vault')} className={`${TAB} ${tabTone(!c.railDungeonsPressed)}`}>Great Vault</button>
          </div>
          <div role="region" tabIndex={0} aria-label={view === 'vault' ? 'Great Vault' : 'Dungeon priority'}
            className="min-h-0 rounded-lg focus-visible:outline-2 focus-visible:outline-gold xl:overflow-y-auto xl:overscroll-contain">
            <div className={c.dungeons}>{dungeons}</div>
            <div className={c.vault}>{vault}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Drop the vault's outer box and hide the spec on phones**

In `src/components/group-vault/GroupVault.tsx`, change the `<section>` class from `flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5` to `flex flex-col gap-5`.

In `src/components/group-members/GroupMembers.tsx`, change `<span className="text-sm text-muted">{m.character.spec}</span>` to `<span className="hidden text-sm text-muted sm:inline">{m.character.spec}</span>`.

- [ ] **Step 5: Wire the page**

In `src/app/group/page.tsx`, import `GroupLayout` from `@/components/group-layout/GroupLayout`, change the `<main>` class to `mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-12 sm:px-8 2xl:px-16`, and replace the `<>…</>` branch for members with:

```tsx
          <GroupLayout
            dungeonCount={view.priority.ranking?.dungeons.length ?? 0}
            gear={<div className="flex flex-col gap-4"><StateLegend /><GroupGrid members={view.members} grid={view.grid} tracksKnown={view.tracksKnown} /></div>}
            dungeons={<GroupPriority priority={view.priority} />}
            vault={<GroupVault vault={view.vault} now={now} />}
          />
```

Below `xl` the Dungeons and Vault panels have no box of their own; give them one by wrapping the two slots: `dungeons={<div className="rounded-2xl border border-line bg-surface p-4 xl:border-0 xl:bg-transparent xl:p-0"><GroupPriority … /></div>}`, and the same for the vault.

- [ ] **Step 6: Run the gate**

Stop `npm run dev` if it is running. Then run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/group-layout src/components/group-vault src/components/group-members src/app/group/page.tsx
git commit -m "feat: put the gear grid beside a dungeon rail, with tabs below 1280 px"
```

Body:

```
One view state drives both layouts through breakpoint classes, so the
server's first paint is right at every width without a media-query
hook. At 1280 px and up the grid sits beside a sticky rail that scrolls
on its own, so every dungeon, every vault choice and the switch stay
reachable without scrolling past the grid. Below that, Gear, Dungeons
and Vault are tabs.
```

---

### Task 10: Docs, hand checks and the pull request

**Files:**
- Modify: `AGENTS.md` ("External data facts")

- [ ] **Step 1: Record the Wowhead endpoint**

Add to `AGENTS.md` under "External data facts":

```md
- **Wowhead's currency tooltip endpoint is undocumented.** `nether.wowhead.com/tooltip/currency/<id>` gives a crest's icon name, and only the name is stored; images are hotlinked from `wow.zamimg.com`. If it changes, crests fall back to their names.
```

Commit: `docs: note the wowhead currency tooltip endpoint`.

- [ ] **Step 2: Run the hand checks**

Start `npm run dev` with a group of five, at least one with a SimC paste. Check each item from the spec's "By hand" list and record the result:

- 1440, 1280, 1024, 768 and 390 px with five members: matches the approved boards; nothing scrolls sideways at 390 px. Repeat 1280 and 390 px with the longest name in the group, with `wow.zamimg.com` blocked in devtools (Network request blocking), and with one member untracked and one with a sync error.
- At 1280 × 720 with every dungeon row open, and on the Vault switch: every dungeon, choice and the switch are reachable by wheel and keyboard without scrolling past the grid.
- Phone width with `wowhead.com` blocked: a long equipped and replacement name both read in full in the card, with the track label.
- Tabs switch panels; resizing across 1280 px keeps a sensible panel.
- A cell opens its card by mouse, touch emulation and Enter; Escape and an outside click close it; focus returns to the cell.
- Hovering a cell shows the Wowhead tooltip (per Task 1's decision).
- Dungeon rows open and close by mouse and keyboard; the first is open on load.
- Crest icons on group headers, character page, character cards and upgrade badges; names when the icon host is blocked.

- [ ] **Step 3: Push and open the pull request**

Rebase onto the latest `origin/main` if it moved, push `feat/group-page-layout`, and open the pull request as `AGENTS.md` describes: `Closes #75, closes #63.`, a `## What changes` list, `## Data` (the `currency_icon` migration and `tracks.v3`), `## Testing` with the test count, gate results, Task 1's decision, every hand check and its result, and the stated gap that there are no browser-level tests. End with `Spec: docs/superpowers/specs/2026-10-04-group-page-layout-design.md`. Move #75 and #63 to In review.
