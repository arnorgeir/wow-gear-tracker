import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ListTabs } from '@/components/character-page/ListTabs';
import { ListSwitchProvider } from './ListSwitchProvider';
import { WhileListSettled } from './WhileListSettled';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

const counts = { overall: { bis: 4, total: 16 }, raid: { bis: 2, total: 16 }, mythicPlus: { bis: 9, total: 16 } };
const href = '/characters/eu/argent-dawn/birkibj%C3%B6rn';

describe('list switch', () => {
  it('renders each tab as a link to its list and marks the rendered list', () => {
    const html = renderToStaticMarkup(createElement(ListSwitchProvider, { listType: 'raid' }, createElement(ListTabs, { href, counts })));
    expect(html).toContain(`href="${href}?list=overall"`);
    expect(html).toContain(`href="${href}?list=mythicPlus"`);
    expect(html).toMatch(/<a[^>]*href="[^"]*\?list=raid"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="[^"]*\?list=raid"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('shows the settled content when nothing is pending', () => {
    const html = renderToStaticMarkup(createElement(ListSwitchProvider, { listType: 'raid' },
      createElement(WhileListSettled, { fallback: createElement('p', null, 'skeleton') }, createElement('p', null, 'gear'))));
    expect(html).toBe('<p>gear</p>');
  });
});
