import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import type { PriorityCreditView } from '@/server/views/types';
import { needText } from './credit-text';

const CARD = 'flex min-w-0 max-w-full items-center gap-2 rounded-lg border px-2 py-1.5';
const NAME = 'text-sm font-semibold wrap-anywhere';
const SLOT = 'text-xs text-muted wrap-anywhere';

/** One need: a named item links to Wowhead; tier and Any needs are plain cards, never buttons or links. */
export function CreditCard({ credit }: { credit: PriorityCreditView }) {
  if (credit.kind === 'item') {
    const { item } = credit;
    const q = QUALITY_STYLES[item.quality] ?? QUALITY_STYLES.COMMON;
    return (
      <a href={`https://www.wowhead.com/item=${item.itemId}`} data-wowhead={wowheadData(item.itemId, item.bonusIds, null)}
        target="_blank" rel="noreferrer" title={`weight ${credit.weight}`}
        className={`${CARD} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold`}
        style={{ background: q.bg, borderColor: q.border }}>
        {item.iconUrl
          ? <img src={item.iconUrl} alt="" width={28} height={28} className="size-7 shrink-0 rounded border" style={{ borderColor: q.ring }} />
          : <span aria-hidden="true" className="size-7 shrink-0 rounded border border-line-strong bg-surface-2" />}
        <span className="flex min-w-0 flex-col">
          <span className={NAME} style={{ color: q.text }}>{item.name}</span>
          <span className={SLOT}>{credit.slotLabel}</span>
        </span>
      </a>
    );
  }
  return (
    <div title={`weight ${credit.weight}`} className={`${CARD} border-line bg-surface-2`}>
      <span className="flex min-w-0 flex-col">
        <span className={NAME}>{needText(credit)}</span>
        <span className={SLOT}>{credit.slotLabel}</span>
      </span>
    </div>
  );
}
