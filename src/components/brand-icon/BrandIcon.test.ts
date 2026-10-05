import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandIcon } from './BrandIcon';

const render = (props: Parameters<typeof BrandIcon>[0]) => renderToStaticMarkup(createElement(BrandIcon, props));

describe('BrandIcon', () => {
  it('is a decorative 24 px icon that never shrinks, drawn in the current colour', () => {
    const html = render({ name: 'group' });
    expect(html).toMatch(/^<svg /);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain('width="24" height="24"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="3.2"');
    expect(html).toContain('class="shrink-0"');
  });

  it('takes a size and extra classes', () => {
    const html = render({ name: 'dungeons', size: 28, className: 'text-gold' });
    expect(html).toContain('width="28" height="28"');
    expect(html).toContain('class="shrink-0 text-gold"');
  });

  it('fills the diamond inside the vault and nowhere else', () => {
    expect(render({ name: 'vault' })).toContain('<path d="m32 23 4 5-4 6-4-6Z" fill="currentColor" stroke="none"></path>');
    expect(render({ name: 'characters' })).not.toContain('fill="currentColor"');
  });
});
