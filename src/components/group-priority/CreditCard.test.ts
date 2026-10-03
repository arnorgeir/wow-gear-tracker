import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PriorityCreditView } from '@/server/views/types';
import { CreditCard } from './CreditCard';

const render = (credit: PriorityCreditView) => renderToStaticMarkup(createElement(CreditCard, { credit }));
const LONG = 'Ceremonialbracersofthehollowkingwhoneverstopsspeakingaboutthemarket';
const item = (iconUrl: string | null): PriorityCreditView => ({
  kind: 'item', slotLabel: 'Ring 2', weight: 4,
  item: { itemId: 101, name: LONG, itemLevel: null, quality: 'EPIC', bonusIds: [10, 20], iconUrl, trackLabel: null },
});

describe('CreditCard', () => {
  it('links a named item to Wowhead with its bonus IDs, icon, full name and slot', () => {
    const html = render(item('https://render.worldofwarcraft.com/icons/56/band.jpg'));
    expect(html).toContain('href="https://www.wowhead.com/item=101"');
    expect(html).toContain('data-wowhead="item=101&amp;bonus=10:20"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain('src="https://render.worldofwarcraft.com/icons/56/band.jpg"');
    expect(html).toContain(LONG);
    expect(html).toContain('Ring 2');
    expect(html).not.toContain('truncate');
    expect(html).not.toContain('ilvl=');
    expect(html).toContain('focus-visible:');
  });

  it('gives a named item without an icon a decorative placeholder', () => {
    const html = render(item(null));
    expect(html).not.toContain('<img');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(LONG);
  });

  it('shows tier and Any needs as plain cards with their slot, without a link or an item ID', () => {
    for (const credit of [
      { kind: 'tier', slotLabel: 'Chest', weight: 5 },
      { kind: 'any', slotLabel: 'Feet', weight: 3, minItemLevel: 334 },
    ] satisfies PriorityCreditView[]) {
      const html = render(credit);
      expect(html).not.toContain('<a');
      expect(html).not.toContain('wowhead');
      expect(html).not.toContain('<img');
      expect(html).toContain(credit.slotLabel);
    }
    expect(render({ kind: 'any', slotLabel: 'Feet', weight: 3, minItemLevel: 334 })).toContain('Any item, level 334+');
  });
});
