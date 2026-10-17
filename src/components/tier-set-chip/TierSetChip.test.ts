import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TierSetChip } from './TierSetChip';

const render = (pieces: number) => renderToStaticMarkup(createElement(TierSetChip, { pieces }));

describe('TierSetChip', () => {
  it.each([0, 1])('renders nothing for %i pieces', (pieces) => expect(render(pieces)).toBe(''));

  it.each([2, 3])('shows an outlined 2-set for %i pieces', (pieces) => {
    const html = render(pieces);
    expect(html).toContain('<span class="font-mono">2</span>-set');
    expect(html).toContain('border-gold-line');
    expect(html).not.toContain('bg-gold');
    expect(html).toContain(`2-piece tier set bonus, ${pieces} tier pieces equipped`);
  });

  it.each([4, 5])('shows a solid 4-set for %i pieces', (pieces) => {
    const html = render(pieces);
    expect(html).toContain('<span class="font-mono">4</span>-set');
    expect(html).toContain('bg-gold');
    expect(html).toContain(`<span class="sr-only">4-piece tier set bonus, ${pieces} tier pieces equipped</span>`);
    expect(html).toContain(`title="4-piece tier set bonus, ${pieces} tier pieces equipped"`);
  });

  it('hides the visible text from screen readers', () => {
    expect(render(4)).toMatch(/<span aria-hidden="true">.*4.*-set<\/span>/);
  });
});
