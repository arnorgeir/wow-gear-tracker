import { classTextColor } from '@/components/shared/class-colors';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import type { GroupMemberCreditsView } from '@/server/views/types';
import { CreditCard } from './CreditCard';

/** A member's needs from one dungeon: one card per credit, in the ranking's order. */
export function MemberNeeds({ member }: { member: GroupMemberCreditsView }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <CharacterAvatar name={member.name} className={member.className} avatarUrl={member.avatarUrl} classIconUrl={member.classIconUrl} size={24} />
        <span className="min-w-0 font-semibold wrap-anywhere" style={{ color: classTextColor(member.className) }}>{member.name}</span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {member.credits.map((c, j) => <li key={j} className="min-w-0 max-w-full"><CreditCard credit={c} /></li>)}
      </ul>
    </div>
  );
}
