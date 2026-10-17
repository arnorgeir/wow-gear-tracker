export type GuideTab = 'overview' | 'abilities' | 'loot';
/** `show`: wanted drops only (default) or every drop. `who`: every tracked character (default) or the remembered group. */
export type GuideState = { boss: number | null; tab: GuideTab; show: 'wanted' | 'all'; who: 'all' | 'group' };

const TABS: readonly GuideTab[] = ['overview', 'abilities', 'loot'];

/** Reads the guide's choice from search params. Anything repeated, empty or unknown counts as missing. */
export function parseGuideState(raw: Record<string, string | string[] | undefined>, bossIds: number[]): GuideState {
  const bossRaw = raw.boss;
  const id = typeof bossRaw === 'string' && /^[1-9]\d*$/.test(bossRaw) ? Number(bossRaw) : null;
  const boss = id !== null && bossIds.includes(id) ? id : null;
  const tab = TABS.find((t) => t === raw.tab) ?? 'overview';
  return { boss, tab: tab === 'abilities' && boss === null ? 'overview' : tab, show: raw.show === 'all' ? 'all' : 'wanted', who: raw.who === 'group' ? 'group' : 'all' };
}

/** The URL for a choice; defaults are left out. `show` and `who` are optional so links that don't change them can pass the current state. */
export function guideHref(dungeonId: number, state: Pick<GuideState, 'boss' | 'tab'> & Partial<Pick<GuideState, 'show' | 'who'>>): string {
  const params = new URLSearchParams();
  if (state.boss !== null) params.set('boss', String(state.boss));
  if (state.tab !== 'overview' && !(state.tab === 'abilities' && state.boss === null)) params.set('tab', state.tab);
  if (state.show === 'all') params.set('show', 'all');
  if (state.who === 'group') params.set('who', 'group');
  const query = params.toString();
  return `/dungeons/${dungeonId}${query ? `?${query}` : ''}`;
}
