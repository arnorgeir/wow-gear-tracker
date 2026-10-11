import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DungeonDisclosure } from './DungeonDisclosure';

const render = (rank: number, summaryExtra?: string) => {
  const props = { rank, name: 'Alpha Hollow', score: 8, imageUrl: null, shortName: 'AH', summaryExtra, children: null };
  return renderToStaticMarkup(createElement(DungeonDisclosure, props, 'Body text')).replace(/<link[^>]*\/>/g, '');
};

describe('DungeonDisclosure', () => {
  it('opens only rank 1', () => {
    expect(render(1)).toMatch(/^<details open=""/);
    expect(render(2)).not.toContain('open=""');
  });

  it('puts rank, name, score and the extra line in the summary, and children in the body', () => {
    const html = render(3, 'Chips here');
    const summary = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));
    expect(summary).toContain('>3<');
    expect(summary).toMatch(/<h3 class="min-w-0 truncate[^"]*">Alpha Hollow<\/h3>/);
    expect(summary).toContain('<span class="sr-only">Score </span>8');
    expect(summary).toContain('Chips here');
    expect(html.indexOf('Body text')).toBeGreaterThan(html.indexOf('</summary>'));
  });

  it('leaves out the extra line when none is given', () => {
    expect(render(1)).not.toContain('flex flex-wrap gap-1');
  });
});
