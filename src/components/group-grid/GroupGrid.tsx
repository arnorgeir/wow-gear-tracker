import type { GroupGridRow, GroupMemberView } from '@/server/views/types';
import { cellNote } from './cell-note';
import { GroupCell } from './GroupCell';
import { MemberHeader } from './MemberHeader';

interface Props { members: GroupMemberView[]; grid: GroupGridRow[]; tracksKnown: boolean; now: number }

export function GroupGrid({ members, grid, tracksKnown, now }: Props) {
  const columns = { gridTemplateColumns: `110px repeat(${members.length}, minmax(220px, 1fr))` };
  const notes = members.map((m) => cellNote(m.state, m.hasRows));
  // A member without rows still gets a cell in every row, so the column reads as a column.
  const rows = grid.length > 0 ? grid : [{ slot: 'HEAD' as const, label: '', cells: members.map(() => null) }];
  return (
    <section aria-label="Gear by slot" className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div className="grid min-w-fit" style={columns}>
        <span className="sticky left-0 border-b border-line bg-surface p-3 text-[13px] font-semibold uppercase tracking-wider text-muted">Slot</span>
        {members.map((m) => <div key={m.key} className="border-b border-line"><MemberHeader member={m} now={now} /></div>)}
        {rows.map((row) => (
          <div key={row.slot} className="contents">
            <span className="sticky left-0 bg-surface p-3 font-semibold text-muted">{row.label}</span>
            {row.cells.map((cell, i) => {
              const note = notes[i];
              if (note) return <div key={i} className={`p-3 text-sm ${note.dim ? 'text-muted opacity-60' : 'text-muted'}`}>{note.text}</div>;
              return <GroupCell key={i} cell={cell} tracksKnown={tracksKnown} />;
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
