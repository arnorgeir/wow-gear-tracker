import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CharacterAvatar } from './CharacterAvatar';

// React 19 hoists <link rel="preload"> tags for images ahead of the markup.
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/<link[^>]*\/>/g, '');
const base = { name: 'Birkibjörn', className: 'Druid', size: 52 };

describe('CharacterAvatar', () => {
  it('shows the avatar in a class-colored ring', () => {
    const html = render(createElement(CharacterAvatar, { ...base, avatarUrl: 'https://render/a.jpg', classIconUrl: 'https://i/druid.jpg' }));
    expect(html).toContain('src="https://render/a.jpg"');
    expect(html).toContain('border-color:#FF7C0A');
  });

  it('badges the avatar with the class icon', () => {
    const urls = { avatarUrl: 'https://render/a.jpg', classIconUrl: 'https://i/druid.jpg' };
    const html = render(createElement(CharacterAvatar, { ...base, ...urls, classBadge: 'surface' }));
    expect(html.match(/<img/g)).toHaveLength(2);
    expect(html).toMatch(/<span class="relative block shrink-0" style="[^"]*width:52px;height:52px/);
    expect(html).toMatch(/<img src="https:\/\/i\/druid.jpg"[^>]*width="21"[^>]*border-surface/);
    expect(html).toMatch(/<img src="https:\/\/render\/a.jpg"[^>]*class="block /);
    expect(render(createElement(CharacterAvatar, { ...base, ...urls, classBadge: 'bg', size: 76 }))).toMatch(/<img src="https:\/\/i\/druid.jpg"[^>]*width="30"[^>]*border-bg/);
  });

  it('shows no badge without an avatar or without the option', () => {
    const noAvatar = render(createElement(CharacterAvatar, { ...base, avatarUrl: null, classIconUrl: 'https://i/druid.jpg', classBadge: 'surface' }));
    expect(noAvatar.match(/<img/g)).toHaveLength(1);
    expect(noAvatar).not.toContain('<span');
    const plain = render(createElement(CharacterAvatar, { ...base, avatarUrl: 'https://render/a.jpg', classIconUrl: 'https://i/druid.jpg' }));
    expect(plain.match(/<img/g)).toHaveLength(1);
    expect(plain).not.toContain('relative');
  });

  it('falls back to the class icon, then to the initial', () => {
    expect(render(createElement(CharacterAvatar, { ...base, avatarUrl: null, classIconUrl: 'https://i/druid.jpg' }))).toContain('src="https://i/druid.jpg"');
    const initial = render(createElement(CharacterAvatar, { ...base, avatarUrl: null, classIconUrl: null }));
    expect(initial).not.toContain('<img');
    expect(initial).toContain('>B</span>');
  });
});
