'use client';

import { useState, type ReactNode } from 'react';
import { BrandIcon, type BrandIconName } from '@/components/brand-icon/BrandIcon';
import { panelClasses, type GroupView } from './panel-classes';

// No min-w-0: a tab never shrinks below its icon, label and count. Phone tabs size to that content (flex-auto),
// because an equal third of a 375 px screen is 108 px and the Dungeons tab needs 114.
const TAB = 'flex h-11 items-center justify-center gap-1.5 rounded-lg font-bold';
const ICONS: Record<GroupView, BrandIconName> = { gear: 'characters', dungeons: 'dungeons', vault: 'vault' };
const tabTone = (on: boolean) => (on ? 'bg-raised text-ink' : 'text-muted');

interface Props { legend: ReactNode; gear: ReactNode; dungeons: ReactNode; vault: ReactNode; dungeonCount: number | null }

/** Tabs below xl, the grid beside a sticky rail at xl. The panels are server-rendered slots. */
export function GroupLayout({ legend, gear, dungeons, vault, dungeonCount }: Props) {
  const [view, setView] = useState<GroupView>('gear');
  const c = panelClasses(view);
  const tabs: [GroupView, string][] = [['gear', 'Gear'], ['dungeons', 'Dungeons'], ['vault', 'Vault']];
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Show" className="flex gap-1 rounded-xl border border-line bg-surface p-1 xl:hidden">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`${TAB} flex-auto ${tabTone(view === id)}`}>
            <BrandIcon name={ICONS[id]} />
            {label}
            {id === 'dungeons' && dungeonCount !== null && <span className="font-mono text-xs text-muted">{dungeonCount}</span>}
          </button>
        ))}
      </div>
      <div className={c.legend}>{legend}</div>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className={`${c.gear} min-w-0 xl:flex-1`}>{gear}</div>
        <aside className={`${c.rail} flex-col xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:w-[380px] xl:shrink-0 xl:gap-3 xl:rounded-2xl xl:border xl:border-line xl:bg-surface xl:p-4`}>
          <div role="group" aria-label="Show in the rail" className="hidden gap-1 rounded-xl border border-line bg-bg p-1 xl:flex">
            <button type="button" aria-pressed={c.railDungeonsPressed} onClick={() => setView('dungeons')} className={`${TAB} flex-1 ${tabTone(c.railDungeonsPressed)}`}>
              <BrandIcon name="dungeons" />Dungeons
            </button>
            <button type="button" aria-pressed={!c.railDungeonsPressed} onClick={() => setView('vault')} className={`${TAB} flex-1 ${tabTone(!c.railDungeonsPressed)}`}>
              <BrandIcon name="vault" />Great Vault
            </button>
          </div>
          <div role="region" tabIndex={0} aria-label={view === 'vault' ? 'Great Vault' : 'Dungeon priority'}
            className="min-h-0 rounded-lg focus-visible:outline-2 focus-visible:outline-gold xl:overflow-y-auto xl:overscroll-contain">
            <div className={c.dungeons}>{dungeons}</div>
            <div className={c.vault}>{vault}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
