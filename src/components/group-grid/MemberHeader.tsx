import Link from 'next/link';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { CrestSummary } from '@/components/crest-summary/CrestSummary';
import { RefreshButton } from '@/components/refresh-button/RefreshButton';
import { RemoveFromGroupButton } from '@/components/remove-from-group/RemoveFromGroupButton';
import { TrackButton } from '@/components/track-button/TrackButton';
import type { GroupMemberView } from '@/server/views/types';

const LIST_LABEL = (m: GroupMemberView) => (m.fellBack ? 'Overall, Method has no Mythic+ list' : m.listType === 'overall' ? 'Overall' : 'Mythic+');

export function MemberHeader({ member, keys, now }: { member: GroupMemberView; keys: string[]; now: number }) {
  const c = member.character;
  return (
    <div className="flex flex-col gap-2 p-3">
      <span className="flex items-center gap-2">
        {c && <CharacterAvatar name={c.name} className={c.className} avatarUrl={c.avatarUrl} classIconUrl={c.classIconUrl} size={32} />}
        {c ? <Link href={`/characters/${c.id}`} className="font-semibold">{c.name}</Link> : <span className="font-semibold">{member.name}</span>}
      </span>
      {member.state === 'untracked' && (
        <>
          <span className="text-sm text-muted">Not tracked · {member.realmSlug}</span>
          <TrackButton memberKey={member.key} name={member.name} keys={keys} />
        </>
      )}
      {member.state === 'notFound' && (
        <>
          <span role="alert" className="text-sm text-[#f3c9a2]">Blizzard can&rsquo;t find this character</span>
          <RemoveFromGroupButton memberKey={member.key} name={member.name} keys={keys} variant="text" />
        </>
      )}
      {c && member.state !== 'notFound' && (
        <>
          <span className="text-xs text-muted">{LIST_LABEL(member)}</span>
          {member.syncError && (
            <>
              <span role="alert" className="text-sm text-[#f3c9a2]">Couldn&rsquo;t sync: {member.syncError}</span>
              <RefreshButton id={c.id} />
            </>
          )}
          {member.bisError && <span className="text-sm text-[#f3c9a2]">{member.bisError}</span>}
          {member.crests
            ? <CrestSummary crests={member.crests} now={now} />
            : <span className="text-xs text-muted">Crests unknown. <Link href={`/characters/${c.id}`}>Paste SimC</Link> to see them.</span>}
        </>
      )}
    </div>
  );
}
