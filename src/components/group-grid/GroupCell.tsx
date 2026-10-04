'use client';

import { useId, useRef } from 'react';
import { CellDetails } from '@/components/cell-details/CellDetails';
import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import { ROW_TONE_STYLES, rowTone } from '@/components/shared/row-tone';
import { trackDisplay } from '@/components/shared/track-label';
import type { CharacterSummary, GearRowView } from '@/server/views/types';
import { cellLabel } from './cell-label';
import { needText } from './cell-note';
import { stateWord } from './state-word';

interface Props { cell: GearRowView | null; tracksKnown: boolean; slotLabel: string; memberName: string; character: CharacterSummary | null }

/**
 * One compact cell: icon, item level, track and a state word. A button covers the cell and opens the
 * details card. Wowhead's script only scans links, so the icon is a link on top of the button; a click
 * on it opens the card too, and Wowhead is one tap further in the card.
 */
export function GroupCell({ cell, tracksKnown, slotLabel, memberName, character }: Props) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  if (!cell) return <div className="p-1 text-center text-muted">&mdash;</div>;
  const tone = rowTone(cell.state, tracksKnown);
  const word = stateWord(cell.state, cell.bis.kind === 'item' && cell.bis.isTier);
  const eq = cell.equipped;
  const track = trackDisplay(eq ? eq.trackLabel : null, tracksKnown);
  // Hovering shows what the cell still needs; a Legacy item also says what that means.
  const hover = [needText(cell), eq && eq.trackLabel === null ? track.hint ?? null : null].filter(Boolean).join('. ') || undefined;
  const q = eq ? QUALITY_STYLES[eq.quality] ?? QUALITY_STYLES.COMMON : null;
  const icon = eq?.iconUrl
    ? <img src={eq.iconUrl} alt="" width={36} height={36} className="size-[34px] rounded-md border-2 sm:size-9" style={{ borderColor: q!.ring }} />
    : <span aria-hidden="true" className="block size-[34px] rounded-md border-2 border-dashed border-line-strong sm:size-9" />;
  return (
    <>
      <div className="relative flex min-h-[80px] min-w-0 flex-col items-center gap-1 rounded-lg border border-line bg-surface-2 px-0.5 py-1.5 sm:min-h-[68px] sm:flex-row sm:gap-2.5 sm:px-2.5 sm:py-2"
        style={tone ? ROW_TONE_STYLES[tone] : undefined}>
        <button ref={button} type="button" popoverTarget={id} title={hover} aria-label={cellLabel(memberName, slotLabel, cell)}
          className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold" />
        {eq ? (
          <a href={`https://www.wowhead.com/item=${eq.itemId}`} data-wowhead={wowheadData(eq.itemId, eq.bonusIds, eq.itemLevel)}
            target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true" className="relative z-10 shrink-0"
            onClick={(e) => { e.preventDefault(); button.current?.click(); }}>{icon}</a>
        ) : <span className="shrink-0">{icon}</span>}
        <span aria-hidden="true" className="pointer-events-none flex min-w-0 max-w-full flex-col items-center gap-px leading-snug sm:items-start">
          <span className="font-mono text-[11px] text-ink sm:text-xs">{eq?.itemLevel ?? '–'}</span>
          {eq && <span className={`hidden max-w-full truncate text-xs sm:block ${track.className}`}>{track.text}</span>}
          <span className={`text-[10px] font-bold sm:text-xs ${word.className}`}>{word.word}</span>
        </span>
        {cell.upgrade && (
          <span aria-hidden="true" className="pointer-events-none absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full border border-[#3e8a4d] bg-[#173020] text-upgrade">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </span>
        )}
      </div>
      <CellDetails id={id} anchor={button} tracksKnown={tracksKnown} cell={cell} slotLabel={slotLabel} character={character} memberName={memberName} />
    </>
  );
}
