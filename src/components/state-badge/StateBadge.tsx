import type { ItemState } from '@/core/types';

const LABELS: Record<ItemState, { text: string; className: string }> = {
  done: { text: 'Done', className: 'text-gold' },
  mythUpgradable: { text: 'Upgrade with crests', className: 'text-crest' },
  belowMyth: { text: 'Great Vault target', className: 'text-vault' },
  inBags: { text: 'BiS in bags', className: 'text-bags' },
  missing: { text: 'Missing', className: 'text-muted' },
};

export function StateBadge({ state }: { state: ItemState }) {
  const label = LABELS[state];
  return <span className={`text-[13px] font-bold ${label.className}`}>{label.text}</span>;
}
