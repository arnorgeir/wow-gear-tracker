import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SetupNotice } from './SetupNotice';

// React 19 hoists <link rel="preload"> tags for images ahead of the markup.
const render = () => renderToStaticMarkup(createElement(SetupNotice, { missing: ['BLIZZARD_CLIENT_ID', 'BLIZZARD_CLIENT_SECRET'] })).replace(/<link[^>]*\/>/g, '');

describe('SetupNotice', () => {
  it('still names the missing settings', () => {
    expect(render()).toContain('BLIZZARD_CLIENT_ID, BLIZZARD_CLIENT_SECRET');
  });

  it('shows the metallic crest as decoration above the heading', () => {
    const html = render();
    expect(html).toMatch(/<img alt=""[^>]*width="160"[^>]*height="160"[^>]*src="[^"]*open-crest-metallic\.png[^"]*"/);
    expect(html.indexOf('open-crest-metallic')).toBeLessThan(html.indexOf('Finish setup'));
  });

  it('frames the panel with four decorative corners', () => {
    expect(render().match(/<svg aria-hidden="true"[^>]*><path d="M1 49V25L25 1h24"/g)).toHaveLength(4);
  });
});
