import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CharacterPageSkeleton } from './CharacterPageSkeleton';
import { DungeonRowsSkeleton } from './DungeonRowsSkeleton';
import { DungeonPrioritySkeleton } from './DungeonPrioritySkeleton';
import { GearTableSkeleton } from './GearTableSkeleton';
import { VaultSectionSkeleton } from './VaultSectionSkeleton';

const html = (el: ReactElement) => renderToStaticMarkup(el);
const statuses = (h: string) => h.match(/role="status"/g)?.length ?? 0;

describe('character page skeletons', () => {
  it('carry a status only when given one', () => {
    for (const C of [GearTableSkeleton, DungeonPrioritySkeleton, VaultSectionSkeleton]) {
      expect(statuses(html(createElement(C)))).toBe(0);
      const withStatus = html(createElement(C, { status: 'Loading list…' }));
      expect(statuses(withStatus)).toBe(1);
      expect(withStatus).toContain('<span role="status" class="sr-only">Loading list…</span>');
    }
  });

  it('keep the real headings and labels', () => {
    expect(html(createElement(GearTableSkeleton))).toContain('>Main Hand<');
    expect(html(createElement(DungeonPrioritySkeleton))).toContain('Dungeon priority</h2>');
    expect(html(createElement(VaultSectionSkeleton))).toContain('Great Vault</h2>');
  });

  it('builds the whole page with no status, under an optional heading', () => {
    const page = html(createElement(CharacterPageSkeleton, { heading: createElement('p', null, 'Adding birkibjörn – argent-dawn…') }));
    expect(page.indexOf('Adding birkibjörn')).toBeLessThan(page.indexOf('animate-pulse'));
    expect(page).toContain('aria-label="Gear by slot"');
    expect(page).toContain('aria-label="Dungeon priority"');
    expect(page).toContain('aria-label="Great Vault"');
    expect(statuses(page)).toBe(0);
  });

  it('draws one open dungeon row and three closed ones', () => {
    const rows = html(createElement(DungeonRowsSkeleton));
    expect(rows).toContain('flex flex-col gap-1.5');
    expect(rows.match(/<li/g)).toHaveLength(4);
    expect(rows.match(/h-\[58px\]/g)).toHaveLength(4);
    expect(rows.match(/h-\[62px\]/g)).toHaveLength(2);
  });
});
