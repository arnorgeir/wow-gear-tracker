import type { ItemState } from '@/core/types';
import { STATE_LABELS } from './state-labels';

export function StateBadge({ state }: { state: ItemState }) {
  const label = STATE_LABELS[state];
  return <span className={`text-[13px] font-bold ${label.className}`}>{label.text}</span>;
}
