import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import type { PriorityCreditView } from '@/server/views/types';
import { chipLabel } from './chip-label';
import { creditSlot } from './credit-slot';

const TILE = 'relative flex size-8 shrink-0 items-center justify-center rounded-md border-2';
const DASHED = `${TILE} border-dashed border-[#a335ee] bg-surface-2 text-[#c58cf5]`;

/** One need: a 32 px tile with its slot under it. Items and tier drops link to Wowhead; a catalyst alternative is dashed and says "alt". */
export function CreditChip({ credit }: { credit: PriorityCreditView }) {
  const label = chipLabel(credit);
  const alternative = credit.kind === 'tier' && credit.fit === 'alternative';
  return (
    <span title={`${label} · weight ${credit.weight}`} className="flex w-11 flex-col items-center gap-0.5">
      {credit.kind === 'any' ? (
        <span className={`${DASHED} font-mono text-[11px]`}>
          <span aria-hidden="true">{credit.minItemLevel}</span>
          <span className="sr-only">{label}</span>
        </span>
      ) : (
        <a href={`https://www.wowhead.com/item=${credit.item.itemId}`} data-wowhead={wowheadData(credit.item.itemId, credit.item.bonusIds, null)}
          target="_blank" rel="noreferrer" aria-label={label}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
          {credit.item.iconUrl ? (
            <span className={alternative ? `${TILE} border-dashed` : TILE} style={{ borderColor: (QUALITY_STYLES[credit.item.quality] ?? QUALITY_STYLES.EPIC).ring }}>
              <img src={credit.item.iconUrl} alt="" width={28} height={28} className="size-7 rounded-sm" />
              {credit.kind === 'tier' && <TierBadge />}
            </span>
          ) : (
            <span className={`${DASHED} font-display text-sm font-bold`}>{credit.kind === 'tier' ? <TierLetter /> : null}</span>
          )}
        </a>
      )}
      <span aria-hidden="true" className="max-w-full truncate text-[10px] text-muted">{alternative ? 'alt' : creditSlot(credit.slotLabel)}</span>
    </span>
  );
}

function TierBadge() {
  return <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 rounded bg-gold px-1 text-[9px] font-bold leading-tight text-bg">T</span>;
}

function TierLetter() {
  return <span aria-hidden="true">T</span>;
}
