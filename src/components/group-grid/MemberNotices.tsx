import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { RefreshButton } from '@/components/refresh-button/RefreshButton';
import { RemoveFromGroupButton } from '@/components/remove-from-group/RemoveFromGroupButton';
import { classTextColor } from '@/components/shared/class-colors';
import { TrackButton } from '@/components/track-button/TrackButton';
import type { GroupMemberView } from '@/server/views/types';
import { memberNotices } from './member-notices';

/** One full-width row of member problems, under the column headers. Absent when nobody has one. */
export function MemberNotices({ members }: { members: GroupMemberView[] }) {
  const rows = members.flatMap((m) => memberNotices(m).map((n) => ({ m, n })));
  if (rows.length === 0) return null;
  return (
    <ul aria-label="Member notices" className="col-span-full flex flex-col gap-1.5 border-b border-line px-1 py-2 text-sm">
      {rows.map(({ m, n }) => (
        <li key={`${m.key}-${n.kind}`} className="flex flex-wrap items-center gap-2">
          {m.character && <CharacterAvatar name={m.character.name} className={m.character.className} avatarUrl={m.character.avatarUrl} classIconUrl={m.character.classIconUrl} size={20} />}
          <span className="font-semibold" style={m.character ? { color: classTextColor(m.character.className) } : undefined}>{m.name}</span>
          <span role={n.kind === 'syncError' || n.kind === 'notFound' ? 'alert' : undefined}
            className={n.kind === 'untracked' ? 'text-muted' : 'text-[#f3c9a2]'}>{n.text}</span>
          {n.kind === 'untracked' && <TrackButton memberKey={m.key} name={m.name} />}
          {n.kind === 'notFound' && <RemoveFromGroupButton memberKey={m.key} name={m.name} variant="text" />}
          {n.kind === 'syncError' && m.character && <RefreshButton id={m.character.id} />}
        </li>
      ))}
    </ul>
  );
}
