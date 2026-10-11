import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GroupLayout } from './GroupLayout';

const buttons = (dungeonCount: number) =>
  renderToStaticMarkup(createElement(GroupLayout, { legend: null, gear: null, dungeons: null, vault: null, dungeonCount }))
    .split('<button ').slice(1).map((b) => b.slice(0, b.indexOf('</button>')));

describe('GroupLayout', () => {
  it('sizes the phone tabs to their content, each with an icon, its label and the dungeon count', () => {
    const [gear, dungeons, vault] = buttons(12);
    for (const [tab, label] of [[gear!, 'Gear'], [dungeons!, 'Dungeons'], [vault!, 'Vault']] as const) {
      expect(tab).toContain('flex-auto');
      expect(tab).not.toContain('flex-1');
      expect(tab).toMatch(/<svg[^>]*aria-hidden="true"/);
      expect(tab).toContain(`</svg>${label}`);
    }
    expect(dungeons).toContain('>12</span>');
  });

  it('keeps the rail switch halves equal, each with an icon and its label', () => {
    const [, , , railDungeons, railVault] = buttons(8);
    for (const [button, label] of [[railDungeons!, 'Dungeons'], [railVault!, 'Great Vault']] as const) {
      expect(button).toContain('flex-1');
      expect(button).toMatch(/<svg[^>]*aria-hidden="true"/);
      expect(button).toMatch(new RegExp(`</svg>${label}$`));
    }
  });

  it('hides the dungeon count when it is unknown', () => {
    const html = renderToStaticMarkup(createElement(GroupLayout, { legend: null, gear: null, dungeons: null, vault: null, dungeonCount: null }));
    expect(html).not.toContain('font-mono text-xs text-muted');
  });
});
