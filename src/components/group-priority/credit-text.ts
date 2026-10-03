import type { PriorityCreditView } from '@/server/views/types';

/** What a tier or Any need asks for. A named item shows its own name instead. */
export const needText = (credit: Exclude<PriorityCreditView, { kind: 'item' }>): string =>
  (credit.kind === 'tier' ? 'Tier via catalyst' : `Any item, level ${credit.minItemLevel}+`);
