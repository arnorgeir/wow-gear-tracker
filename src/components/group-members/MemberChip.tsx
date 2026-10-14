import type { KeyboardEvent } from 'react';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { RemoveFromGroupButton } from '@/components/remove-from-group/RemoveFromGroupButton';
import { classTextColor } from '@/components/shared/class-colors';
import type { GroupMemberView } from '@/server/views/types';
import { moveTarget } from './move-target';
import type { HandleEvents } from './use-member-drag';

interface Props {
  member: GroupMemberView;
  index: number;
  count: number;
  /** Whether this chip is lifted: picked up by a tap, or being dragged. */
  lift: 'none' | 'picked' | 'dragging';
  /** The member picked up, whose drop spot every other handle names. */
  pickedName: string | null;
  /** A pointer drag is under way anywhere in the row. */
  rowDragging: boolean;
  /** Without two or more members there is nothing to reorder, so no handle. */
  reorderable: boolean;
  handle: HandleEvents;
  onKeyMove: (toIndex: number) => void;
  chipRef: (el: HTMLElement | null) => void;
}

export function MemberChip({ member: m, index, count, lift, pickedName, rowDragging, reorderable, handle, onKeyMove, chipRef }: Props) {
  const label = pickedName && lift !== 'picked' ? `Move ${pickedName} to position ${index + 1}` : `Move ${m.name}, position ${index + 1} of ${count}`;
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (rowDragging || pickedName) return;
    const target = moveTarget(e.key, index, count);
    if (target === null) return;
    e.preventDefault();
    onKeyMove(target);
  };
  return (
    <span ref={chipRef} className={`flex h-12 items-center gap-2 rounded-full border border-line bg-surface-2 pr-0.5 ${reorderable ? 'pl-0.5' : 'pl-1.5'} ${lift === 'none' ? '' : 'ring-2 ring-gold shadow-lg'}`}>
      {reorderable && (
        <button type="button" aria-label={label} aria-describedby="group-move-hint" aria-pressed={lift === 'picked' ? true : undefined}
          {...handle} onKeyDown={onKeyDown}
          className={`flex size-11 touch-none select-none items-center justify-center rounded-full text-muted hover:bg-surface-2 [-webkit-touch-callout:none] ${lift === 'dragging' ? 'cursor-grabbing' : 'cursor-grab'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {[7, 12, 17].map((y) => [8, 16].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" />))}
          </svg>
        </button>
      )}
      {m.character && <CharacterAvatar name={m.character.name} className={m.character.className} avatarUrl={m.character.avatarUrl} classIconUrl={m.character.classIconUrl} size={32} />}
      <span className="font-semibold" style={m.character ? { color: classTextColor(m.character.className) } : undefined}>{m.name}</span>
      {m.character && <span className="hidden text-sm text-muted sm:inline">{m.character.spec}</span>}
      <RemoveFromGroupButton memberKey={m.key} name={m.name} />
    </span>
  );
}
