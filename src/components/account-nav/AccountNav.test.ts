import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

let path = '/group';
vi.mock('next/navigation', () => ({ usePathname: () => path }));

const { AccountNav } = await import('./AccountNav');
const { SettingsGear } = await import('@/components/settings-gear/SettingsGear');
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe('AccountNav', () => {
  it('is its own nav, after a divider, and only on desktop', () => {
    const html = render(createElement(AccountNav));
    expect(html).toContain('aria-label="Account"');
    expect(html).toContain('hidden');
    expect(html).toContain('w-px');
    expect(html).toContain('>Settings');
    expect(html).not.toContain('aria-current');
  });

  it('holds the gold underline and diamond on the Settings pages', () => {
    path = '/settings/bis';
    const html = render(createElement(AccountNav));
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('text-gold');
    expect(html).toContain('rotate-45');
  });
});

describe('SettingsGear', () => {
  it('is an icon-only link named Settings, hidden from lg up', () => {
    path = '/group';
    const html = render(createElement(SettingsGear));
    expect(html).toContain('aria-label="Settings"');
    expect(html).toContain('lg:hidden');
    expect(html).toContain('size-11');
    expect(html).not.toContain('aria-current');
    expect(html).not.toContain('>Settings<');
  });

  it('turns gold on a gold tint when current', () => {
    path = '/settings';
    const html = render(createElement(SettingsGear));
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('bg-gold-soft');
    expect(html).toContain('text-gold');
  });
});
