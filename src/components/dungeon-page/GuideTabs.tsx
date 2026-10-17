import Link from 'next/link';
import { guideHref, type GuideState, type GuideTab } from './guide-state';

const TABS: { tab: GuideTab; label: string }[] = [
  { tab: 'overview', label: 'Overview' },
  { tab: 'abilities', label: 'Abilities' },
  { tab: 'loot', label: 'Loot' },
];

const RIBBON = 'relative block border px-4 py-2.5 font-display text-sm font-bold no-underline focus-visible:outline-2 focus-visible:outline-gold rounded-t-md lg:rounded-r-md lg:rounded-tl-none';
// The chosen ribbon is gold-soft with a gold bar on its outer edge (top in the phone row), so it reads as picked without relying on text color alone.
const CHOSEN = 'border-gold-line bg-gold-soft text-gold shadow-[inset_0_3px_0_var(--color-gold)] lg:shadow-[inset_-3px_0_0_var(--color-gold)] lg:-ml-px';
const IDLE = 'border-line bg-surface-2 text-muted hover:border-line-strong hover:text-ink';

/** Ribbon tabs on the right page's outer edge (a row above the panel on narrow screens). Each is a link, not an ARIA tab. */
export function GuideTabs({ dungeonId, state }: { dungeonId: number; state: GuideState }) {
  return (
    <nav aria-label="Sections" className="flex gap-1 overflow-x-auto px-4 pt-3 lg:w-32 lg:shrink-0 lg:flex-col lg:overflow-visible lg:p-0 lg:pt-6">
      {TABS.filter((t) => t.tab !== 'abilities' || state.boss !== null).map(({ tab, label }) => (
        <Link key={tab} href={guideHref(dungeonId, { ...state, tab })} aria-current={state.tab === tab ? 'page' : undefined}
          className={`${RIBBON} ${state.tab === tab ? CHOSEN : IDLE}`}>{label}</Link>
      ))}
    </nav>
  );
}
