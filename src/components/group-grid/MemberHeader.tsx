import Link from 'next/link';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { CrestChip } from '@/components/crest-chip/CrestChip';
import { classTextColor } from '@/components/shared/class-colors';
import type { GroupMemberView } from '@/server/views/types';

/** Avatar, name and crests. Problems live in the notice row below, so every header is the same height. */
export function MemberHeader({ member }: { member: GroupMemberView }) {
  const c = member.character;
  if (!c) return <div className="min-w-0 p-1.5"><span className="block truncate text-sm font-semibold" title={member.name}>{member.name}</span></div>;
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 p-1 sm:items-start sm:p-2">
      <Link href={`/characters/${c.id}`} title={c.name} className="flex min-w-0 max-w-full items-center gap-1.5 font-semibold no-underline" style={{ color: classTextColor(c.className) }}>
        <CharacterAvatar name={c.name} className={c.className} avatarUrl={c.avatarUrl} classIconUrl={c.classIconUrl} size={26} />
        <span className="sr-only truncate sm:not-sr-only">{c.name}</span>
      </Link>
      {member.crests ? (
        member.crests.balances.length > 0
          ? <div className="flex min-w-0 max-w-full flex-col items-center gap-1 sm:flex-row sm:flex-wrap">{member.crests.balances.map((b) => <CrestChip key={b.currencyId} balance={b} />)}</div>
          : <span className="text-xs text-muted">No crests</span>
      ) : <Link href={`/characters/${c.id}`} className="text-xs">Import SimC</Link>}
      {member.listType === 'overall' && (
        <span className="text-xs text-muted" title={member.fellBack ? 'Method has no Mythic+ list for this spec' : undefined}>Overall list</span>
      )}
    </div>
  );
}
