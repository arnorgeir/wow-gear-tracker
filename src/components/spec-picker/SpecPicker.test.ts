import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PickerSpecView, SpecPickerView } from '@/server/views/types';
import { SpecPicker } from './SpecPicker';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

const birki = { name: 'Birkibjörn', href: '/characters/eu/argent-dawn/birkibj%C3%B6rn', className: 'Druid', avatarUrl: 'https://render/b.jpg', classIconUrl: null };
const spec = (over: Partial<PickerSpecView>): PickerSpecView =>
  ({ slug: 'feral-druid', specName: 'Feral', iconUrl: 'https://render/feral.jpg', tracked: false, state: { kind: 'notFetched' }, characters: [], compares: 'mythicPlus', source: 'method', ...over });
const guardian = spec({ slug: 'guardian-druid', specName: 'Guardian', tracked: true, state: { kind: 'tracked' }, characters: [birki], compares: 'raid' });
const view: SpecPickerView = {
  tracked: [{ ...guardian, className: 'Druid', editedCount: 2 }],
  classes: [{
    className: 'Druid', iconUrl: 'https://render/druid.jpg', trackedCount: 1,
    specs: [guardian, spec({}), spec({ slug: 'balance-druid', specName: 'Balance', state: { kind: 'failed' } }), spec({ slug: 'restoration-druid', specName: 'Restoration', state: { kind: 'fetched', at: 0 } })],
  }],
};
const html = renderToStaticMarkup(createElement(SpecPicker, { view, now: 3 * 86_400_000 }));

describe('SpecPicker', () => {
  it('opens with the heading and an intro, then lists tracked specs as cards that link to the editor', () => {
    expect(html).toContain('>BiS lists<');
    expect(html).toContain('Your specs');
    expect(html).toContain('href="/settings/bis/guardian-druid"');
    expect(html).toContain('Method · Compares <strong class="font-semibold text-ink">Raid</strong> · 2 edited');
    expect(html).toContain('Birkibjörn');
  });

  it('names each tracked spec\'s source', () => {
    const icy = renderToStaticMarkup(createElement(SpecPicker, { view: { ...view, tracked: [{ ...view.tracked[0]!, source: 'icyVeins' }] }, now: 0 }));
    expect(icy).toContain('Icy Veins · Compares');
    const manual = renderToStaticMarkup(createElement(SpecPicker, { view: { ...view, tracked: [{ ...view.tracked[0]!, source: 'manual' }] }, now: 0 }));
    expect(manual).toContain('Manual · Compares');
  });

  it('names every state in words, never by color alone', () => {
    expect(html).toContain('Not fetched');
    expect(html).toContain('Fetch failed');
    expect(html).toContain('Fetched 3 days ago');
    expect(html).toContain('Tracked');
    expect(html).toContain('Tracked: Birkibjörn · compares Raid');
  });

  it('offers Fetch, Try again and Refresh, once per layout, and nothing for a tracked spec', () => {
    // Desktop card and phone accordion each render the rows.
    expect(html.match(/>Fetch</g)).toHaveLength(2);
    expect(html.match(/>Try again</g)).toHaveLength(2);
    expect(html.match(/>Refresh</g)).toHaveLength(2);
  });

  it('summarizes a class for the phone accordion, open when it has a tracked spec', () => {
    expect(html).toContain('1 tracked');
    expect(html).toMatch(/<details open=""/);
  });

  it('gives each class its icon from class_media', () => {
    expect(html).toContain('src="https://render/druid.jpg"');
  });
});
