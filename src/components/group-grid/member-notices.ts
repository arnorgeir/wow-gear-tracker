import { BIS_LOADING } from '@/components/shared/loading-copy';
import type { GroupMemberView } from '@/server/views/types';

export type MemberNotice = { kind: 'untracked' | 'notFound' | 'syncError' | 'bisError' | 'bisLoading'; text: string };

/** What a member's notice row says. Wording is unchanged from the old column header. */
export function memberNotices(m: GroupMemberView): MemberNotice[] {
  if (m.state === 'untracked') return [{ kind: 'untracked', text: `Not tracked · ${m.realmSlug}` }];
  if (m.state === 'notFound') return [{ kind: 'notFound', text: 'Blizzard can’t find this character' }];
  const notices: MemberNotice[] = [];
  if (m.syncError) notices.push({ kind: 'syncError', text: `Couldn’t sync: ${m.syncError}` });
  if (m.bisError) notices.push({ kind: 'bisError', text: m.bisError });
  if (m.bisLoading) notices.push({ kind: 'bisLoading', text: BIS_LOADING });
  return notices;
}
