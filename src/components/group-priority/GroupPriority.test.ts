import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GroupPriorityView } from '@/server/views/types';
import { GroupPriority } from './GroupPriority';

const render = (priority: GroupPriorityView) =>
  renderToStaticMarkup(createElement(GroupPriority, { priority })).replace(/<link[^>]*\/>/g, '');
const base: GroupPriorityView = { season: 'ready', approximate: false, covered: ['Birkibjörn'], excluded: [], fellBack: [], ranking: { dungeons: [], nothingFrom: [] } };
const credits = { key: 'eu.argent-dawn.birkibjörn', name: 'Birkibjörn', className: 'Druid', avatarUrl: null, classIconUrl: null };

describe('GroupPriority', () => {
  it('ranks dungeons with each member’s needs, and marks only split ones', () => {
    const html = render({ ...base, ranking: { nothingFrom: ['Delta Deep'], dungeons: [
      { challengeModeId: 501, name: 'Alpha Hollow', score: 5, split: false, members: [{ ...credits, credits: [{ kind: 'tier', slotLabel: 'Chest', weight: 5 }] }] },
      { challengeModeId: 502, name: 'Streets of Beta', score: 3, split: true, members: [{ ...credits, credits: [{ kind: 'any', slotLabel: 'Boots', weight: 3, minItemLevel: 334 }] }] },
    ] } });
    expect(html).toContain('Alpha Hollow');
    expect(html).toContain('Tier via catalyst');
    expect(html).toContain('Any item, level 334+');
    expect(html.match(/Split dungeon/g)).toHaveLength(1);
    expect(html).toContain('Nothing anyone needs from: Delta Deep.');
  });

  it('says the ranking is unavailable when nobody is eligible, without claiming nothing is needed', () => {
    const html = render({ ...base, covered: [], excluded: [{ name: 'Sólrún', reason: 'no gear yet' }], ranking: null });
    expect(html).toContain('Dungeon priority needs at least one member with gear and a BiS list.');
    expect(html).toContain('Sólrún (no gear yet)');
    expect(html).not.toContain('still needs');
  });

  it('names who a partial ranking covers and who it leaves out', () => {
    const html = render({ ...base, covered: ['Birkibjörn', 'Hrafnhildur'], excluded: [{ name: 'Sólrún', reason: 'no gear yet' }] });
    expect(html).toContain('Covers Birkibjörn and Hrafnhildur. Left out: Sólrún (no gear yet).');
  });

  it('says the group needs nothing only when eligible members need nothing', () => {
    expect(render(base)).toContain('No season dungeon drops anything the group still needs.');
  });

  it('shows the season states, the fallback and approximate weights', () => {
    expect(render({ ...base, season: 'loading' })).toContain('Loading this season’s loot…');
    expect(render({ ...base, season: 'failed' })).toContain('It will retry within the hour.');
    const html = render({ ...base, season: 'stale', approximate: true, fellBack: ['Hrafnhildur'] });
    expect(html).toContain('Showing older loot data');
    expect(html).toContain('Weights are approximate');
    expect(html).toContain('Hrafnhildur uses the Overall list: Method has no Mythic+ list for that spec.');
  });
});
