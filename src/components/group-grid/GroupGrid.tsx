import type { CSSProperties } from 'react';
import { syncingText } from '@/components/shared/loading-copy';
import type { GroupGridRow, GroupMemberView } from '@/server/views/types';
import { cellNote } from './cell-note';
import { CellSkeleton } from './CellSkeleton';
import { COLUMNS } from './columns';
import { GroupCell } from './GroupCell';
import { MemberHeader } from './MemberHeader';
import { MemberNotices } from './MemberNotices';
import { SLOT_SHORT } from './slot-short';

interface Props { members: GroupMemberView[]; grid: GroupGridRow[]; tracksKnown: boolean }

export function GroupGrid({ members, grid, tracksKnown }: Props) {
  const notes = members.map((m) => cellNote(m.state, m.hasRows, m.bisLoading));
  // A member without rows still gets a cell in every row, so the column reads as a column.
  const rows = grid.length > 0 ? grid : [{ slot: 'HEAD' as const, label: '', cells: members.map(() => null) }];
  return (
    <section aria-label="Gear by slot" className="rounded-2xl border border-line bg-surface p-1 sm:p-2">
      <div className={`grid gap-[3px] sm:gap-1.5 ${COLUMNS}`} style={{ '--members': members.length } as CSSProperties}>
        <span className="self-end p-1 text-xs font-semibold uppercase tracking-wider text-muted"><span className="sr-only sm:not-sr-only">Slot</span></span>
        {members.map((m) => <MemberHeader key={m.key} member={m} />)}
        <MemberNotices members={members} />
        {/* sr-only is absolutely positioned, so these take no grid cell. */}
        {members.filter((m) => m.state === 'syncing').map((m) => <span key={m.key} role="status" className="sr-only">{syncingText(m.name)}</span>)}
        {rows.map((row) => (
          <div key={row.slot} className="contents">
            <span className="flex items-center text-xs font-semibold text-muted sm:text-sm">
              <span aria-hidden="true" className="sm:hidden">{SLOT_SHORT[row.slot]}</span>
              <span className="sr-only sm:not-sr-only">{row.label}</span>
            </span>
            {row.cells.map((cell, i) => {
              const note = notes[i];
              if (note && 'skeleton' in note) return <CellSkeleton key={i} />;
              if (note) return <div key={i} className={`p-1 text-xs ${note.dim ? 'text-muted opacity-60' : 'text-muted'}`}>{note.text}</div>;
              const m = members[i]!;
              return <GroupCell key={i} cell={cell} tracksKnown={tracksKnown} slotLabel={row.label} memberName={m.name} character={m.character} />;
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
