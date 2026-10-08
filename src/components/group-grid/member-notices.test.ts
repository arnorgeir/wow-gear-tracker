import { describe, expect, it } from 'vitest';
import type { GroupMemberView } from '@/server/views/types';
import { memberNotices } from './member-notices';

const member = (over: Partial<GroupMemberView>): GroupMemberView => ({
  key: 'eu.argent-dawn.birkibjörn', name: 'Birkibjörn', realmSlug: 'argent-dawn', character: null, state: 'ready',
  syncError: null, bisError: null, bisLoading: false, hasRows: true, listType: 'mythicPlus', fellBack: false, crests: null, ...over,
});

describe('memberNotices', () => {
  it('has nothing to say about a ready member', () => {
    expect(memberNotices(member({}))).toEqual([]);
  });

  it('keeps today’s wording for each problem', () => {
    expect(memberNotices(member({ state: 'untracked' }))).toEqual([{ kind: 'untracked', text: 'Not tracked · argent-dawn' }]);
    expect(memberNotices(member({ state: 'notFound' }))).toEqual([{ kind: 'notFound', text: 'Blizzard can’t find this character' }]);
    expect(memberNotices(member({ syncError: 'Blizzard returned 503' }))).toEqual([{ kind: 'syncError', text: 'Couldn’t sync: Blizzard returned 503' }]);
    expect(memberNotices(member({ bisError: 'Method is down' }))).toEqual([{ kind: 'bisError', text: 'Method is down' }]);
  });

  it('says a member’s BiS list is loading', () => {
    expect(memberNotices(member({ hasRows: false, bisLoading: true }))).toEqual([{ kind: 'bisLoading', text: 'Loading BiS list…' }]);
  });

  it('lists a sync error and a BiS error together', () => {
    expect(memberNotices(member({ syncError: 'timeout', bisError: 'Method is down' })).map((n) => n.kind)).toEqual(['syncError', 'bisError']);
  });
});
