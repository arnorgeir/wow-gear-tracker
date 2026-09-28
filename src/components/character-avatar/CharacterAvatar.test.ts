import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CharacterAvatar } from './CharacterAvatar';

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
