import { statPairLabel } from '@/components/shared/stat-pair';
import type { PriorityCreditView } from '@/server/views/types';

/** What a need chip says on hover and to screen readers. */
export function chipLabel(credit: PriorityCreditView): string {
  switch (credit.kind) {
    case 'item': return `${credit.item.name} (${credit.slotLabel})`;
    case 'tier': {
      const head = `${credit.item.name} (${credit.slotLabel})`;
      if (credit.fit === 'alternative') return `${head}, catalyst alternative: ${statPairLabel(credit.dropStats ?? [])}, Method BiS wants ${statPairLabel(credit.targetStats ?? [])}`;
      if (credit.fit === 'unverified') return `${head}, catalyst into tier, stats unverified`;
      return credit.targetStats ? `${head}, Method BiS stats ${statPairLabel(credit.targetStats)}: catalyst into tier` : `${head}, Method BiS item: catalyst into tier`;
    }
    case 'any': return `Any ${credit.slotLabel.toLowerCase()}, level ${credit.minItemLevel}+`;
  }
}
