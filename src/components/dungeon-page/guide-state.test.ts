import { describe, expect, it } from 'vitest';
import { guideHref, parseGuideState } from './guide-state';

const bosses = [9, 3];

describe('parseGuideState', () => {
  it('defaults to the dungeon and the overview tab', () => {
    expect(parseGuideState({}, bosses)).toEqual({ boss: null, tab: 'overview' });
  });

  it('accepts a boss of this dungeon and a known tab', () => {
    expect(parseGuideState({ boss: '3', tab: 'loot' }, bosses)).toEqual({ boss: 3, tab: 'loot' });
    expect(parseGuideState({ boss: '9', tab: 'abilities' }, bosses)).toEqual({ boss: 9, tab: 'abilities' });
  });

  it('falls back for unknown, malformed, empty and repeated values', () => {
    expect(parseGuideState({ boss: '77', tab: 'map' }, bosses)).toEqual({ boss: null, tab: 'overview' });
    expect(parseGuideState({ boss: 'abc' }, bosses).boss).toBeNull();
    expect(parseGuideState({ boss: '3.5' }, bosses).boss).toBeNull();
    expect(parseGuideState({ boss: '-3' }, bosses).boss).toBeNull();
    expect(parseGuideState({ boss: '', tab: '' }, bosses)).toEqual({ boss: null, tab: 'overview' });
    expect(parseGuideState({ boss: ['3', '9'], tab: ['loot', 'loot'] }, bosses)).toEqual({ boss: null, tab: 'overview' });
  });

  it('drops abilities when no boss is chosen', () => {
    expect(parseGuideState({ tab: 'abilities' }, bosses).tab).toBe('overview');
    expect(parseGuideState({ boss: '77', tab: 'abilities' }, bosses).tab).toBe('overview');
  });
});

describe('guideHref', () => {
  it('omits defaults', () => {
    expect(guideHref(585, { boss: null, tab: 'overview' })).toBe('/dungeons/585');
    expect(guideHref(585, { boss: 3, tab: 'overview' })).toBe('/dungeons/585?boss=3');
    expect(guideHref(585, { boss: null, tab: 'loot' })).toBe('/dungeons/585?tab=loot');
    expect(guideHref(585, { boss: 3, tab: 'abilities' })).toBe('/dungeons/585?boss=3&tab=abilities');
  });

  it('drops abilities when there is no boss', () => {
    expect(guideHref(585, { boss: null, tab: 'abilities' })).toBe('/dungeons/585');
  });
});
