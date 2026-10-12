import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsSlotView, SettingsSpecView } from '@/server/views/types';
import { BisEditor } from './BisEditor';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

const item = { itemId: 10, name: 'Yoke of the Charging Bear', itemLevel: null, quality: 'EPIC' as const, bonusIds: [], iconUrl: null, trackLabel: null };
const method = (over: object = {}) => ({ kind: 'item' as const, ...item, isTier: false, isCatalyst: false, source: 'Kings’ Rest', targetStats: null, targetIsTierPiece: false, ...over });
const slot = (over: Partial<SettingsSlotView>): SettingsSlotView => ({ slotKey: 'Neck#1', slotLabel: 'Neck', method: method(), override: null, tierSlot: false, ...over });
const empty = { slots: [] as SettingsSlotView[], orphans: [], editedCount: 0 };

const view: SettingsSpecView = {
  slug: 'guardian-druid', className: 'Druid', specName: 'Guardian', listType: 'mythicPlus', statsMatter: true, editing: 'mythicPlus',
  source: 'method', copiedFrom: null, copiedAt: null,
  hasLists: true, fetchState: { kind: 'tracked' }, fetchedAt: 0, iconUrl: 'https://render/guardian.jpg', classIconUrl: 'https://render/druid.jpg',
  characters: [{ name: 'Birkibjörn', href: '/characters/eu/argent-dawn/birkibj%C3%B6rn', className: 'Druid', avatarUrl: null, classIconUrl: null }],
  lists: {
    overall: empty,
    raid: { ...empty, editedCount: 1 },
    mythicPlus: {
      editedCount: 1,
      slots: [
        slot({}),
        slot({ slotKey: 'Head#1', slotLabel: 'Head', tierSlot: true, method: method({ name: 'Spare Speaker’s Hood', isTier: true, isCatalyst: true }),
          override: { ...item, itemId: 31, name: 'Woven Hood', catalyst: true } }),
        slot({ slotKey: 'Hands#1', slotLabel: 'Hands', method: { kind: 'any' as const, minItemLevel: 334, source: '' } }),
      ],
      orphans: [{ ...item, itemId: 40, name: 'Signet of the Hollow Moon', slotKey: 'Ring#3' }],
    },
  },
};
const html = renderToStaticMarkup(createElement(BisEditor, { view, now: 3 * 3_600_000 }));

describe('BisEditor', () => {
  it('opens with the spec, who uses it and when Method’s list was fetched', () => {
    expect(html).toContain('Guardian Druid');
    expect(html).toContain('Used by');
    expect(html).toContain('href="/characters/eu/argent-dawn/birkibj%C3%B6rn"');
    expect(html).toContain('Method list fetched 3 h ago');
  });

  it('offers the three lists as real radio inputs with the compared one checked', () => {
    expect(html).toContain('Compare against');
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html.match(/checked=""/g)).toHaveLength(2); // the Mythic+ radio and the stats checkbox
    expect(html).toContain('Tier pieces must have the list&#x27;s stats');
  });

  it('marks the compared tab in words and counts every tab’s edits', () => {
    expect(html).toContain('Compared');
    expect(html).toContain('no edits');
    expect(html).toContain('1 edited');
    expect(html).toContain('Compared · 1 edited');
  });

  it('reads Follows Method for an unedited slot, with Override', () => {
    expect(html).toContain('Follows Method');
    expect(html).toContain('>Override<');
  });

  it('shows an edited slot with its pill, Method’s pick struck through, and Reset', () => {
    expect(html).toContain('>Edited<');
    expect(html).toContain('Woven Hood → catalyst into tier');
    expect(html).toContain('line-through');
    expect(html).toContain('Tier piece (catalyst Spare Speaker’s Hood)');
    expect(html).toContain('>Reset<');
  });

  it('shows an Any row by its item level', () => {
    expect(html).toContain('Any 334');
    expect(html).toContain('Any item at item level 334 or higher');
  });

  it('lists a pick for a slot Method dropped, with Remove', () => {
    expect(html).toContain('No longer in Method&#x27;s list');
    expect(html).toContain('Method dropped these slots. Your picks for them aren&#x27;t applied.');
    expect(html).toContain('Was your pick for Ring 3');
    expect(html).toContain('>Remove<');
  });

  it('says so when Method has no list of the edited type', () => {
    const none = renderToStaticMarkup(createElement(BisEditor, { view: { ...view, editing: 'raid' }, now: 0 }));
    expect(none).toContain('Method has no Raid list for this spec.');
  });
});
