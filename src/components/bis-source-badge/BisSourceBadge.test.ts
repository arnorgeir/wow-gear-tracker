import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BisSourceBadge } from './BisSourceBadge';

const render = (editedCount: number) => renderToStaticMarkup(createElement(BisSourceBadge, { specSlug: 'guardian-druid', editedCount }));

describe('BisSourceBadge', () => {
  it('links to the spec editor, plain when nothing is edited', () => {
    const html = render(0);
    expect(html).toContain('href="/settings/bis/guardian-druid"');
    expect(html).toContain('From Method');
    expect(html).not.toContain('edited');
    expect(html).toContain('border-line-strong');
    expect(html).toContain('<svg');
  });

  it('adds the edit count in gold, with a gold edge', () => {
    const html = render(3);
    expect(html).toContain('From Method');
    expect(html).toContain('3 edited');
    expect(html).toContain('border-gold-line');
    expect(html).toContain('text-gold');
  });
});
