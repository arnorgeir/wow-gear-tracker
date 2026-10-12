import Link from 'next/link';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { classTextColor } from '@/components/shared/class-colors';
import { SpecIcon } from '@/components/spec-icon/SpecIcon';
import { FetchButton } from '@/components/spec-picker/FetchButton';
import type { SettingsSpecView } from '@/server/views/types';
import { CopyAgain } from './CopyAgain';
import { fetchedLine } from './editor-text';

/** The spec's icon with its class icon as a corner badge, its name in class color, who uses it, and when its list was fetched or copied. */
export function EditorHeader({ view, now }: { view: SettingsSpecView; now: number }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <span className="relative block size-[52px] shrink-0 md:size-[60px]">
            <SpecIcon url={view.iconUrl} className={view.className} size="fill" ring="class" corner={12} />
            {view.classIconUrl && (
              <img src={view.classIconUrl} alt="" width={26} height={26}
                className="absolute -bottom-1.5 -right-1.5 size-[22px] rounded-md border-2 border-bg md:size-[26px]" />
            )}
          </span>
          <div className="flex flex-col gap-0.5 md:gap-1.5">
            <h2 className="font-display text-2xl font-bold md:text-[32px]" style={{ color: classTextColor(view.className) }}>{view.specName} {view.className}</h2>
            <span className="text-[13px] text-muted md:hidden">{fetchedLine(view, now)} · <span className="inline-flex align-baseline">{view.source === 'manual' ? <CopyAgain specSlug={view.slug} copiedFrom={view.copiedFrom} /> : <FetchButton specSlug={view.slug} label="Refresh" link />}</span></span>
          </div>
        </div>
        {view.characters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted md:text-[15px]">
            Used by
            {view.characters.map((c) => (
              <Link key={c.href} href={c.href} className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 py-0 pl-1 pr-3 font-semibold text-ink no-underline md:h-8">
                <CharacterAvatar name={c.name} className={c.className} avatarUrl={c.avatarUrl} classIconUrl={c.classIconUrl} size={24} />
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="hidden items-center gap-3 md:flex">
        <span className="text-sm text-muted">{fetchedLine(view, now)}</span>
        {view.source === 'manual' ? <CopyAgain specSlug={view.slug} copiedFrom={view.copiedFrom} /> : <FetchButton specSlug={view.slug} label="Refresh" size="lg" />}
      </div>
    </div>
  );
}
