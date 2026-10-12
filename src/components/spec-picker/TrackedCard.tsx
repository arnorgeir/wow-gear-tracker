import Link from 'next/link';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { classTextColor } from '@/components/shared/class-colors';
import { editedText } from '@/components/shared/edited-text';
import { LIST_NAMES } from '@/components/shared/list-names';
import { SpecIcon } from '@/components/spec-icon/SpecIcon';
import { SOURCE_NAMES } from '@/core/types';
import type { SpecPickerView } from '@/server/views/types';


const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted"><path d="M9 5l7 7-7 7" /></svg>
);

/** One tracked spec: a link to its editor. Desktop leads with the spec icon, a phone with the character's portrait. */
export function TrackedCard({ spec }: { spec: SpecPickerView['tracked'][number] }) {
  const [first, ...others] = spec.characters;
  const who = first ? `${first.name}${others.length > 0 ? ` +${others.length}` : ''}` : '';
  const edited = editedText(spec.editedCount);
  return (
    <Link href={`/settings/bis/${spec.slug}`} className="flex items-center gap-3 rounded-xl border border-line-strong bg-surface p-3 text-ink no-underline hover:border-gold-line md:gap-3.5 md:rounded-[14px] md:p-4">
      <span className="md:hidden">
        {first && (
          <span className="relative block size-11">
            <CharacterAvatar name={first.name} className={first.className} avatarUrl={first.avatarUrl} classIconUrl={first.classIconUrl} size={44} />
            <span className="absolute -bottom-1 -right-1 rounded-[5px] border-2 border-surface"><SpecIcon url={spec.iconUrl} className={spec.className} size={20} corner={3} /></span>
          </span>
        )}
      </span>
      <span className="hidden md:block"><SpecIcon url={spec.iconUrl} className={spec.className} size={48} ring="class" corner={10} /></span>
      <span className="flex min-w-0 grow flex-col gap-0.5 md:gap-1">
        <span className="text-base font-bold md:text-[17px]" style={{ color: classTextColor(spec.className) }}>{spec.specName} {spec.className}</span>
        <span className="text-[13px] text-muted md:hidden">{who} · {SOURCE_NAMES[spec.source]} · <strong className="font-semibold text-ink">{LIST_NAMES[spec.compares]}</strong> · {edited}</span>
        <span className="hidden text-sm text-muted md:block">{SOURCE_NAMES[spec.source]} · Compares <strong className="font-semibold text-ink">{LIST_NAMES[spec.compares]}</strong> · {edited}</span>
        {first && (
          <span className="hidden items-center gap-2 text-sm md:flex">
            <CharacterAvatar name={first.name} className={first.className} avatarUrl={first.avatarUrl} classIconUrl={first.classIconUrl} size={24} />
            {who}
          </span>
        )}
      </span>
      <Chevron />
    </Link>
  );
}
