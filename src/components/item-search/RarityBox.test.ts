import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RarityBox } from './RarityBox';

const render = (props: Parameters<typeof RarityBox>[0]) => renderToStaticMarkup(createElement(RarityBox, props)).replace(/<link[^>]*\/>/g, '');

describe('RarityBox', () => {
  it('shows the icon in a ring of the quality it is given', () => {
    const html = render({ quality: 'EPIC', iconUrl: 'https://render/icons/9.jpg' });
    expect(html).toContain('<img src="https://render/icons/9.jpg"');
    expect(html).toContain('border-color:#a335ee');
  });

  it('keeps an empty ring when no icon is cached', () => {
    const html = render({ quality: 'RARE', iconUrl: null });
    expect(html).not.toContain('<img');
    expect(html).toContain('border-color:#0070dd');
  });
});
