import type { ItemState } from '@/core/types';

/** The badge wording for each state. Cells reuse it in their accessible names. */
export const STATE_LABELS: Record<ItemState, { text: string; className: string }> = {
  done: { text: 'Done', className: 'text-gold' },
  mythUpgradable: { text: 'Upgrade with crests', className: 'text-crest' },
  belowMyth: { text: 'Great Vault target', className: 'text-vault' },
  inBags: { text: 'BiS in bags', className: 'text-bags' },
  missing: { text: 'Missing', className: 'text-missing' },
};
