import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RarityBox } from './RarityBox';

const render = (item: Parameters<typeof RarityBox>[0]['item']) => renderToStaticMarkup(createElement(RarityBox, { item }));

describe('RarityBox', () => {
  it('shows the icon in an Epic ring for a Rare base quality', () => {
    const html = render({ quality: 'RARE', iconUrl: 'https://render/icons/9.jpg' });
    expect(html).toContain('<img src="https://render/icons/9.jpg"');
    expect(html).toContain('border-color:#a335ee');
  });

  it('keeps an empty ring when no icon is cached', () => {
    const html = render({ quality: 'RARE', iconUrl: null });
    expect(html).not.toContain('<img');
    expect(html).toContain('border-color:#a335ee');
  });
});
