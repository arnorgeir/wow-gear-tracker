import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GroupGridSkeleton } from './GroupGridSkeleton';

const render = (members: number, status?: string) => renderToStaticMarkup(createElement(GroupGridSkeleton, { members, status }));

describe('GroupGridSkeleton', () => {
  it('has one column per requested member and one row per slot, slot names real', () => {
    const html = render(3);
    expect(html).toContain('--members:3');
    expect(html.match(/data-skeleton-cell/g)).toHaveLength(3 * 16);
    expect(html).toContain('Main Hand');
  });

  it('never draws fewer than one column', () => {
    expect(render(0)).toContain('--members:1');
  });

  it('carries a status only when given one', () => {
    expect(render(2)).not.toContain('role="status"');
    expect(render(2, 'Loading group…').match(/role="status"/g)).toHaveLength(1);
  });
});
