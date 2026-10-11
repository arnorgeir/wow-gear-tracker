import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SpecIcon } from './SpecIcon';

const render = (props: Parameters<typeof SpecIcon>[0]) => renderToStaticMarkup(createElement(SpecIcon, props));

describe('SpecIcon', () => {
  it('draws the icon with a class-colored border for headline icons', () => {
    const html = render({ url: 'https://render/guardian.jpg', className: 'Druid', size: 48, ring: 'class' });
    expect(html).toContain('src="https://render/guardian.jpg"');
    expect(html).toContain('border-color:#FF7C0A');
    expect(html).toContain('alt=""');
  });

  it('can fill the box around it', () => {
    expect(render({ url: 'https://render/x.jpg', className: 'Druid', size: 'fill' })).toContain('width:100%');
  });

  it('keeps a neutral border inside lists, and an empty box without a URL', () => {
    expect(render({ url: 'https://render/x.jpg', className: 'Druid', size: 32 })).toContain('border-color:var(--color-line-strong)');
    expect(render({ url: null, className: 'Druid', size: 32 })).not.toContain('<img');
  });
});
