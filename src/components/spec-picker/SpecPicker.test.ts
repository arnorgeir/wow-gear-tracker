import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SpecPickerView } from '@/server/views/types';
import { SpecPicker } from './SpecPicker';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

const view: SpecPickerView = {
  classes: [{
    className: 'Druid', iconUrl: null,
    specs: [
      { slug: 'guardian-druid', specName: 'Guardian', tracked: true, state: { kind: 'tracked' } },
      { slug: 'feral-druid', specName: 'Feral', tracked: false, state: { kind: 'notFetched' } },
      { slug: 'balance-druid', specName: 'Balance', tracked: false, state: { kind: 'failed' } },
    ],
  }],
};

describe('SpecPicker', () => {
  it('names each state in words and links every spec to its editor', () => {
    const html = renderToStaticMarkup(createElement(SpecPicker, { view, now: 0 }));
    expect(html).toContain('href="/settings/bis/guardian-druid"');
    expect(html).toContain('Tracked');
    expect(html).toContain('Not fetched');
    expect(html).toContain('Fetch failed, try again');
  });

  it('offers a fetch for a spec Method has not been asked for, and not for a tracked one', () => {
    const html = renderToStaticMarkup(createElement(SpecPicker, { view, now: 0 }));
    expect(html.match(/Fetch Method list/g)).toHaveLength(1);
    expect(html.match(/Refresh/g)).toHaveLength(1);
  });
});
