import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PickerSpecView } from '@/server/views/types';
import { SpecRow, SpecRowPhone } from './SpecRow';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

const spec = (over: Partial<PickerSpecView>): PickerSpecView =>
  ({ slug: 'frost-mage', specName: 'Frost', iconUrl: null, tracked: false, state: { kind: 'notFetched' }, characters: [], compares: 'mythicPlus', source: 'manual', ...over });
const row = (s: PickerSpecView) => renderToStaticMarkup(createElement(SpecRow, { spec: s, now: 3 }));

describe('SpecRow', () => {
  it('says Manual for an untracked manual spec, with no fetch button', () => {
    const html = row(spec({ state: { kind: 'manual' } }));
    expect(html).toContain('Manual');
    expect(html).not.toContain('<button');
  });

  it('says Manual beside the Tracked pill for a tracked manual spec', () => {
    const html = row(spec({ tracked: true, state: { kind: 'manual' } }));
    expect(html).toContain('Tracked');
    expect(html).toContain('Manual');
  });

  it('says Tracked once for a tracked spec on a fetched list', () => {
    const html = row(spec({ tracked: true, source: 'method', state: { kind: 'tracked' } }));
    expect(html.match(/Tracked/g)).toHaveLength(1);
  });

  it('keeps the label and fetch button for a fetched spec', () => {
    const html = row(spec({ source: 'method', state: { kind: 'notFetched' } }));
    expect(html).toContain('Not fetched');
    expect(html).toContain('Fetch');
  });

  it('matches the phone row, which already says Manual', () => {
    expect(renderToStaticMarkup(createElement(SpecRowPhone, { spec: spec({ state: { kind: 'manual' } }), now: 3 }))).toContain('Manual');
  });
});
