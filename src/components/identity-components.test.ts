import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CharacterAvatar } from './CharacterAvatar';
import { FactionBadge } from './FactionBadge';

// React 19 hoists <link rel="preload"> tags for images ahead of the markup.
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<link[^>]*\/>/g, '');
const base = { name: 'Testbear', className: 'Druid', size: 52 };

describe('CharacterAvatar', () => {
  it('shows the avatar in a class-colored ring', () => {
    const html = render(createElement(CharacterAvatar, { ...base, avatarUrl: 'https://render/a.jpg', classIconUrl: 'https://i/druid.jpg' }));
    expect(html).toContain('src="https://render/a.jpg"');
    expect(html).toContain('border-color:#FF7C0A');
  });

  it('falls back to the class icon, then to the initial', () => {
    expect(render(createElement(CharacterAvatar, { ...base, avatarUrl: null, classIconUrl: 'https://i/druid.jpg' }))).toContain('src="https://i/druid.jpg"');
    const initial = render(createElement(CharacterAvatar, { ...base, avatarUrl: null, classIconUrl: null }));
    expect(initial).not.toContain('<img');
    expect(initial).toContain('>T</span>');
  });
});

describe('FactionBadge', () => {
  it('names the faction in its title and hides the shape from screen readers', () => {
    const html = render(createElement(FactionBadge, { faction: 'HORDE' }));
    expect(html).toContain('title="Horde"');
    expect(html).toContain('aria-hidden="true"');
    expect(render(createElement(FactionBadge, { faction: 'ALLIANCE' }))).toContain('title="Alliance"');
  });
});
