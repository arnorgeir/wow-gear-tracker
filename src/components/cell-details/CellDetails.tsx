'use client';

import { useCallback, useEffect, useRef, type RefObject, type SyntheticEvent } from 'react';
import { BisTarget } from '@/components/bis-target/BisTarget';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { needText } from '@/components/group-grid/cell-note';
import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import { classTextColor } from '@/components/shared/class-colors';
import { trackDisplay } from '@/components/shared/track-label';
import { StateBadge } from '@/components/state-badge/StateBadge';
import { UpgradeBadge } from '@/components/upgrade-badge/UpgradeBadge';
import type { CharacterSummary, GearRowView } from '@/server/views/types';
import { cardCoords } from './position';

interface Props { id: string; tracksKnown: boolean; anchor: RefObject<HTMLElement | null>; cell: GearRowView; slotLabel: string; character: CharacterSummary | null; memberName: string }

/** Everything a compact cell abbreviates, in full. A native popover: Escape and outside clicks close it. */
export function CellDetails({ id, tracksKnown, anchor, cell, slotLabel, character, memberName }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Coordinates follow the cell on a wide screen and are cleared on a phone. They are redone on every
  // resize while the card is open, so a card never keeps desktop coordinates after the breakpoint changes.
  const place = useCallback(() => {
    const el = ref.current;
    if (!el || !anchor.current) return;
    const coords = cardCoords(window.matchMedia('(min-width: 40rem)').matches, anchor.current.getBoundingClientRect(), el.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
    el.style.top = coords.top;
    el.style.left = coords.left;
  }, [anchor]);
  useEffect(() => {
    const onResize = () => { if (ref.current?.matches(':popover-open')) place(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [place]);
  const onToggle = (e: SyntheticEvent<HTMLDivElement>) => {
    const el = ref.current;
    const opened = (e.nativeEvent as Event & { newState?: string }).newState === 'open';
    if (!el) return;
    if (!opened) {
      el.style.top = '';
      el.style.left = '';
      return;
    }
    place();
    el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  };
  const eq = cell.equipped;
  const q = eq ? QUALITY_STYLES[eq.quality] ?? QUALITY_STYLES.COMMON : null;
  const needed = needText(cell) !== null;
  const track = trackDisplay(eq ? eq.trackLabel : null, tracksKnown);
  return (
    <div ref={ref} id={id} popover="auto" onToggle={onToggle}
      className="fixed inset-x-3 top-auto bottom-3 m-0 max-h-[70dvh] w-auto overflow-y-auto rounded-xl border border-line-strong bg-surface p-3 text-ink shadow-2xl sm:inset-auto sm:w-80">
      <div className="flex items-start gap-2">
        <span className="flex min-w-0 grow items-center gap-1.5 text-sm font-semibold">
          {character && <CharacterAvatar name={character.name} className={character.className} avatarUrl={character.avatarUrl} classIconUrl={character.classIconUrl} size={20} />}
          <span style={character ? { color: classTextColor(character.className) } : undefined}>{memberName}</span>
          <span className="text-muted">· {slotLabel}</span>
        </span>
        <button type="button" data-autofocus popoverTarget={id} popoverTargetAction="hide" aria-label="Close item details"
          className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div className="mt-2 flex items-start gap-2.5">
        {eq?.iconUrl
          ? <img src={eq.iconUrl} alt="" width={44} height={44} className="size-11 shrink-0 rounded-md border-2" style={{ borderColor: q!.ring }} />
          : <span aria-hidden="true" className="size-11 shrink-0 rounded-md border-2 border-dashed border-line-strong" />}
        <div className="flex min-w-0 flex-col gap-0.5">
          {eq ? (
            <a href={`https://www.wowhead.com/item=${eq.itemId}`} data-wowhead={wowheadData(eq.itemId, eq.bonusIds, eq.itemLevel)} target="_blank" rel="noreferrer"
              className="font-semibold wrap-anywhere no-underline" style={{ color: q!.text }}>{eq.name}</a>
          ) : <span className="text-muted">Nothing equipped</span>}
          {eq && (
            <span className="font-mono text-[13px] text-muted" title={track.hint}>
              <span className={track.className}>{track.text}</span>{eq.itemLevel ? ` · ${eq.itemLevel}` : ''}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StateBadge state={cell.state} />
        {cell.upgrade && <UpgradeBadge upgrade={cell.upgrade} />}
      </div>
      {needed && (
        <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Needed</span>
          <BisTarget row={cell} wrap />
        </div>
      )}
    </div>
  );
}
