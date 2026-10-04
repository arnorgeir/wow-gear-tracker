'use client';

import { useState, type ReactNode } from 'react';
import { panelClasses, type GroupView } from './panel-classes';

const TAB = 'flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg font-bold';
const tabTone = (on: boolean) => (on ? 'bg-raised text-ink' : 'text-muted');

interface Props { gear: ReactNode; dungeons: ReactNode; vault: ReactNode; dungeonCount: number }

/** Tabs below xl, the grid beside a sticky rail at xl. The panels are server-rendered slots. */
export function GroupLayout({ gear, dungeons, vault, dungeonCount }: Props) {
  const [view, setView] = useState<GroupView>('gear');
  const c = panelClasses(view);
  const tabs: [GroupView, string][] = [['gear', 'Gear'], ['dungeons', 'Dungeons'], ['vault', 'Vault']];
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Show" className="flex gap-1 rounded-xl border border-line bg-surface p-1 xl:hidden">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`${TAB} ${tabTone(view === id)}`}>
            {label}
            {id === 'dungeons' && <span className="font-mono text-xs text-muted">{dungeonCount}</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className={`${c.gear} min-w-0 xl:flex-1`}>{gear}</div>
        <aside className={`${c.rail} flex-col xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:w-[380px] xl:shrink-0 xl:gap-3 xl:rounded-2xl xl:border xl:border-line xl:bg-surface xl:p-4`}>
          <div role="group" aria-label="Show in the rail" className="hidden gap-1 rounded-xl border border-line bg-bg p-1 xl:flex">
            <button type="button" aria-pressed={c.railDungeonsPressed} onClick={() => setView('dungeons')} className={`${TAB} ${tabTone(c.railDungeonsPressed)}`}>Dungeons</button>
            <button type="button" aria-pressed={!c.railDungeonsPressed} onClick={() => setView('vault')} className={`${TAB} ${tabTone(!c.railDungeonsPressed)}`}>Great Vault</button>
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
