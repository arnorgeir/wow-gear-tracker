import { describe, expect, it } from 'vitest';
import { guideHref, parseGuideState } from './guide-state';

const bosses = [9, 3];

describe('parseGuideState', () => {
  it('defaults to the dungeon and the overview tab', () => {
    expect(parseGuideState({}, bosses)).toEqual({ boss: null, tab: 'overview', show: 'wanted', who: 'all' });
  });

  it('accepts a boss of this dungeon and a known tab', () => {
    expect(parseGuideState({ boss: '3', tab: 'loot' }, bosses)).toEqual({ boss: 3, tab: 'loot', show: 'wanted', who: 'all' });
    expect(parseGuideState({ boss: '9', tab: 'abilities' }, bosses)).toEqual({ boss: 9, tab: 'abilities', show: 'wanted', who: 'all' });
  });

  it('falls back for unknown, malformed, empty and repeated values', () => {
    expect(parseGuideState({ boss: '77', tab: 'map' }, bosses)).toEqual({ boss: null, tab: 'overview', show: 'wanted', who: 'all' });
    expect(parseGuideState({ boss: 'abc' }, bosses).boss).toBeNull();
    expect(parseGuideState({ boss: '3.5' }, bosses).boss).toBeNull();
    expect(parseGuideState({ boss: '-3' }, bosses).boss).toBeNull();
    expect(parseGuideState({ boss: '', tab: '' }, bosses)).toEqual({ boss: null, tab: 'overview', show: 'wanted', who: 'all' });
    expect(parseGuideState({ boss: ['3', '9'], tab: ['loot', 'loot'] }, bosses)).toEqual({ boss: null, tab: 'overview', show: 'wanted', who: 'all' });
  });

  it('drops abilities when no boss is chosen', () => {
    expect(parseGuideState({ tab: 'abilities' }, bosses).tab).toBe('overview');
    expect(parseGuideState({ boss: '77', tab: 'abilities' }, bosses).tab).toBe('overview');
  });
});

describe('show and who', () => {
  it('reads all drops and the group lens', () => {
    expect(parseGuideState({ show: 'all', who: 'group' }, bosses)).toMatchObject({ show: 'all', who: 'group' });
  });

  it.each([[undefined], [''], ['ALL'], ['junk'], [['all', 'all']]])('reads %j as the defaults', (v) => {
    expect(parseGuideState({ show: v, who: v }, bosses)).toMatchObject({ show: 'wanted', who: 'all' });
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
  it('keeps show and who, and omits their defaults', () => {
    expect(guideHref(585, { boss: null, tab: 'loot', show: 'all', who: 'group' })).toBe('/dungeons/585?tab=loot&show=all&who=group');
    expect(guideHref(585, { boss: 3, tab: 'overview', show: 'all', who: 'all' })).toBe('/dungeons/585?boss=3&show=all');
    expect(guideHref(585, { boss: null, tab: 'overview', show: 'wanted', who: 'group' })).toBe('/dungeons/585?who=group');
    expect(guideHref(585, { boss: null, tab: 'overview', show: 'wanted', who: 'all' })).toBe('/dungeons/585');
  });
});
