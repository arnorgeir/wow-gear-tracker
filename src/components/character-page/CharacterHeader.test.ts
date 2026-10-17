import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CharacterPageView } from '@/server/views/types';
import { CharacterHeader } from './CharacterHeader';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

const view = {
  id: 3, name: 'Birkibjörn', realmName: 'Argent Dawn', region: 'eu', className: 'Druid', identity: 'Troll Guardian Druid', avatarUrl: null, classIconUrl: null,
  itemLevel: null, tierPieces: 0, snapshot: null, sourceAt: null, specIconUrl: 'https://render/guardian.jpg',
} as unknown as CharacterPageView;

describe('CharacterHeader', () => {
  it('puts the spec icon on the spec line', () => {
    const html = renderToStaticMarkup(createElement(CharacterHeader, { view, now: 0 }));
    expect(html).toContain('src="https://render/guardian.jpg"');
    expect(html).toContain('Troll Guardian Druid');
  });

  it('shows the item level under the spec', () => {
    const html = renderToStaticMarkup(createElement(CharacterHeader, { view: { ...view, itemLevel: 334.6 }, now: 0 }));
    expect(html).toContain('Item level <span class="font-mono">334.6</span>');
    expect(html.indexOf('Troll Guardian Druid')).toBeLessThan(html.indexOf('Item level'));
  });

  it('shows no item level when unknown', () => {
    expect(renderToStaticMarkup(createElement(CharacterHeader, { view, now: 0 }))).not.toContain('Item level');
  });
});

describe('CharacterHeader tier set chip', () => {
  const chip = '<span class="font-mono">4</span>-set';
  const html = (over: object) => renderToStaticMarkup(createElement(CharacterHeader, { view: { ...view, ...over }, now: 0 }));
  it('shows the chip after the item level', () => {
    const out = html({ itemLevel: 334.6, tierPieces: 4 });
    expect(out).toContain(chip);
    expect(out.indexOf('334.6')).toBeLessThan(out.indexOf(chip));
  });
  it('shows the chip alone when the item level is unknown', () => {
    const out = html({ tierPieces: 4 });
    expect(out).toContain(chip);
    expect(out).not.toContain('Item level');
  });
  it('shows no chip with 1 tier piece', () => expect(html({ itemLevel: 334.6, tierPieces: 1 })).not.toContain('-set'));
});
