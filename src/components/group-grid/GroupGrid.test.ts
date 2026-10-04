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
const render = (members: GroupMemberView[], grid: GroupGridRow[]) =>
  renderToStaticMarkup(createElement(GroupEditsProvider, { keys: members.map((m) => m.key) }, createElement(GroupGrid, { members, grid, tracksKnown: true }))).replace(/<link[^>]*\/>/g, '');

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
    expect(html).toContain('title="Myth Mistcrest: 85, 4 steps"');
    expect(html).toContain('Overall list');
    expect(html).toContain('title="Birkibjörn"');
  });

  it('asks for a paste when a member has no crests yet', () => {
    expect(render([member({ character: summary(3, 'Birkibjörn') })], [])).toContain('No SimC');
  });

  it('makes each cell a button with a full label, a state word and its own details card', () => {
    const upgrade = { steps: 4, currencyId: 3446, currencyName: 'Myth Mistcrest', costPerStep: 20, iconUrl: null };
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({ upgrade })] }]);
    expect(html).toContain('aria-label="Birkibjörn, Head: Enigmatic Dreamwatcher’s Somnolent Stare, item level 321, upgrade with crests, can upgrade now"');
    expect(html).toMatch(/<button[^>]*popoverTarget="[^"]+"/);
    expect(html).toContain('>Crests<');
    expect(html).toContain('popover="auto"');
    expect(html).toContain('Myth 2/6 · 321');
  });

  it('puts the Wowhead tooltip on the icon link, which Wowhead can scan, not on the button', () => {
    const html = render([member({ character: summary(3, 'Birkibjörn') })], [{ slot: 'HEAD', label: 'Head', cells: [cell({})] }]);
    expect(html).toMatch(/<a[^>]*data-wowhead="item=271528[^"]*"/);
    expect(html).not.toMatch(/<button[^>]*data-wowhead/);
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
});
