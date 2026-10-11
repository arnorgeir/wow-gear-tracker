import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/settings/bis/guardian-druid' }));
const { SettingsNav } = await import('./SettingsNav');

describe('SettingsNav', () => {
  it('marks BiS lists as current with a gold diamond, on its spec pages too', () => {
    const html = renderToStaticMarkup(createElement(SettingsNav));
    expect(html).toContain('aria-label="Settings sections"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('bg-gold');
  });

  it('shows General as disabled, soon on a phone and Coming soon on desktop', () => {
    const html = renderToStaticMarkup(createElement(SettingsNav));
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('>soon<');
    expect(html).toContain('>Coming soon<');
  });
});
