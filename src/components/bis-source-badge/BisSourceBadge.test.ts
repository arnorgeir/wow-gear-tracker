import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BisSourceBadge } from './BisSourceBadge';

describe('BisSourceBadge', () => {
  it('links to the spec editor and counts edits', () => {
    const html = renderToStaticMarkup(createElement(BisSourceBadge, { specSlug: 'guardian-druid', editedCount: 2 }));
    expect(html).toContain('href="/settings/bis/guardian-druid"');
    expect(html).toContain('Method · 2 edited');
  });
});
