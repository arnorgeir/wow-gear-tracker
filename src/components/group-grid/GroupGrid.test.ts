import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterSummary, GearRowView, GroupGridRow, GroupMemberView } from '@/server/views/types';
import { GroupEditsProvider } from '@/components/group-edits/GroupEditsProvider';
import { GroupGrid } from './GroupGrid';

// Client children need the App Router context, which a static render doesn't have. vi.mock is hoisted above the imports.
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const summary = (id: number, name: string): CharacterSummary => ({
  id, name, realmName: 'Argent Dawn', realmId: 1, region: 'eu', className: 'Druid', activeSpec: 'Guardian', spec: 'Guardian', specSlug: 'guardian-druid',
  status: 'ok', lastSyncedAt: 5, lastSyncError: null, priorityList: 'mythicPlus', snapshot: null, sourceAt: null, race: null, faction: null,
  avatarUrl: null, classIconUrl: null, identity: 'Guardian Druid',
});
const member = (over: Partial<GroupMemberView>): GroupMemberView => ({
  key: 'eu.argent-dawn.birkibjörn', name: 'Birkibjörn', realmSlug: 'argent-dawn', character: null, state: 'ready',
  syncError: null, bisError: null, hasRows: true, listType: 'mythicPlus', fellBack: false, crests: null, ...over,
});
const render = (members: GroupMemberView[], grid: GroupGridRow[], tracksKnown = true) =>
  renderToStaticMarkup(createElement(GroupEditsProvider, { keys: members.map((m) => m.key) }, createElement(GroupGrid, { members, grid, tracksKnown }))).replace(/<link[^>]*\/>/g, '');

const equipped = { itemId: 271528, name: 'Enigmatic Dreamwatcher’s Somnolent Stare', itemLevel: 321, quality: 'EPIC' as const, bonusIds: [12], iconUrl: 'https://render.worldofwarcraft.com/icons/56/stare.jpg', trackLabel: 'Myth 2/6' };
const cell = (over: Partial<GearRowView>): GearRowView => ({
  slotLabel: 'Head', slot: 'HEAD', state: 'mythUpgradable', equipped, upgrade: null,
  bis: { kind: 'item', ...equipped, isTier: false, isCatalyst: false, source: '' }, ...over,
});

describe('GroupGrid', () => {
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
    expect(html).toContain('data-wowhead="currency=3446"');
    expect(html).toContain('Overall list');
    expect(html).toContain('title="Birkibjörn"');
  });

  it('asks for a paste when a member has no crests yet', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], []);
    expect(html).toContain('Import SimC');
    expect(html).not.toContain('No SimC');
  });

  it('makes each cell a button with a full label, a state word and its own details card', () => {
    const upgrade = { steps: 4, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, iconUrl: null };
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ upgrade })] }]);
    expect(html).toContain('aria-label="Birkibjörn, Head: Enigmatic Dreamwatcher’s Somnolent Stare, item level 321, upgrade with crests, can upgrade now"');
    expect(html).toMatch(/<button[^>]*popoverTarget="[^"]+"/);
    expect(html).toContain('>Crests<');
    expect(html).toContain('popover="auto"');
    expect(html).toContain('>Myth 2/6</span> · 321');
  });

  it('puts the Wowhead tooltip on the icon link, which Wowhead can scan, not on the button', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({})] }]);
    expect(html).toMatch(/<a[^>]*data-wowhead="item=271528[^"]*"/);
    expect(html).not.toMatch(/<button[^>]*data-wowhead/);
  });

  it('says No track for an equipped item on no track, with a hedged hint, and never claims a season', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ equipped: { ...equipped, trackLabel: null } })] }]);
    expect(html).toContain('>No track<');
    expect(html).not.toContain('Legacy');
    expect(html).toContain('title="Not on a current season upgrade track. Often an item from an earlier season."');
  });

  it('shows no hint when the track data is unavailable, and no track at all when nothing is equipped', () => {
    const m = [member({ character: summary(3, 'Birkibjörn') })];
    const unknown = render(m, [{ slot: 'HEAD', label: 'Head', cells: [cell({ equipped: { ...equipped, trackLabel: null } })] }], false);
    expect(unknown).not.toContain('Legacy');
    expect(unknown).toContain('>No track<');
    expect(unknown).not.toContain('earlier season');
    expect(unknown).not.toContain('text-legacy');
    const empty = render(m, [{ slot: 'HEAD', label: 'Head', cells: [cell({ equipped: null, state: 'missing' })] }]);
    expect(empty).not.toContain('Legacy');
    expect(empty).not.toContain('No track');
  });

  it('colors the track by name', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({})] }]);
    expect(html).toMatch(/text-track-myth[^>]*>Myth 2[/]6</);
  });

  it('shows what is needed when hovering a cell that still needs something', () => {
    const missing = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ state: 'missing', bis: { kind: 'item', ...equipped, name: 'Greathelm of Temptation', isTier: false, isCatalyst: false, source: 'Kings’ Rest' } })] }]);
    expect(missing).toMatch(/<button[^>]*title="Need: Greathelm of Temptation"/);
    const done = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ state: 'done' })] }]);
    expect(done).not.toMatch(/<button[^>]*title=/);
  });

  it('shows the needed item as a card in the details, like the gear overview, and not when nothing is needed', () => {
    const bis = { kind: 'item' as const, ...equipped, itemId: 251126, name: 'Greathelm of Temptation', isTier: false, isCatalyst: false, source: 'Kings’ Rest' };
    const missing = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ state: 'missing', bis })] }]);
    expect(missing).toContain('Needed');
    expect(missing).toContain('href="https://www.wowhead.com/item=251126"');
    expect(missing).toContain('Kings’ Rest');
    const done = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ state: 'done' })] }]);
    expect(done).not.toContain('Needed');
  });

  it('lets the needed item’s name wrap in the details card instead of clipping', () => {
    const bis = { kind: 'item' as const, ...equipped, name: 'Enigmatic Dreamwatcher’s Somnolent Stare of the Endless Night', isTier: true, isCatalyst: true, source: 'Kings’ Rest' };
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ state: 'missing', bis })] }]);
    const needed = html.slice(html.indexOf('>Needed<'));
    expect(needed).toContain('Tier piece (catalyst Enigmatic Dreamwatcher’s Somnolent Stare of the Endless Night)');
    expect(needed).toContain('wrap-anywhere');
    expect(needed).not.toContain('truncate');
  });

  it('colors the Need word and the Missing badge so they stand out', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ state: 'missing' })] }]);
    expect(html).toMatch(/text-missing[^>]*>Need</);
  });

  it('says Need tier for a missing tier piece, and the card names the piece', () => {
    const bis = { kind: 'item' as const, ...equipped, name: 'Enigmatic Dreamwatcher’s Plumage', isTier: true, isCatalyst: true, source: '' };
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'SHOULDER', label: 'Shoulders', cells: [cell({ state: 'missing', slot: 'SHOULDER', bis })] }]);
    expect(html).toContain('>Need tier<');
    expect(html).toContain('Need: Enigmatic Dreamwatcher’s Plumage (tier, via catalyst)');
    expect(html).toContain('>Shldr<');
  });

  it('shows an empty slot as an empty icon and the Need word', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ equipped: null, state: 'missing' })] }]);
    expect(html).toContain('Nothing equipped');
    expect(html).toContain('>Need<');
  });

  it('makes each cell a size container whose name line shows only from 180 px, in the quality colour', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({})] }]);
    expect(html).toContain('class="@container relative flex');
    expect(html).toContain('<span class="hidden max-w-full truncate text-xs font-semibold @min-[162px]:block" style="color:#c58cf5">Enigmatic Dreamwatcher’s Somnolent Stare</span>');
  });

  it('keeps a wide cell name clear of the upgrade arrow', () => {
    const upgrade = { steps: 4, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, iconUrl: null };
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ upgrade })] }]);
    expect(html).toContain('@min-[162px]:block pr-3.5"');
  });

  it('shows no name for an empty slot, not even the BiS item', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ equipped: null, state: 'missing' })] }]);
    expect(html).not.toContain('@min-[162px]:block');
  });

  it('puts item level and track on one line in a wide cell', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({})] }]);
    expect(html).toMatch(/<span class="flex max-w-full min-w-0 flex-col items-center gap-px sm:items-start @min-\[162px\]:flex-row @min-\[162px\]:gap-1\.5"><span class="font-mono[^"]*">321<\/span><span class="[^"]*">Myth 2\/6<\/span><\/span>/);
  });
});
