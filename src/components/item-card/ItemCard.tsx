import type { Quality } from '@/core/types';
import { QUALITY_STYLES } from './quality-styles';
import { detailParts } from '@/components/shared/track-label';
import { wowheadData } from './wowhead';

interface ItemCardProps {
  itemId: number;
  name: string;
  quality: Quality;
  iconUrl: string | null;
  bonusIds: number[];
  itemLevel: number | null;
  detail?: string;
  /** Let the name and detail wrap onto more lines instead of clipping, for cards that must be read in full. */
  wrap?: boolean;
}

/** The whole card is the Wowhead link, so hovering anywhere on it shows the item tooltip. */
export function ItemCard({ itemId, name, quality, iconUrl, bonusIds, itemLevel, detail, wrap }: ItemCardProps) {
  const q = QUALITY_STYLES[quality] ?? QUALITY_STYLES.COMMON;
  return (
    <a
      href={`https://www.wowhead.com/item=${itemId}`}
      data-wowhead={wowheadData(itemId, bonusIds, itemLevel)}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-[62px] min-w-0 items-center gap-3 rounded-lg border py-1.5 pl-1.5 pr-3 no-underline transition hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      style={{ background: q.bg, borderColor: q.border }}
    >
      {iconUrl
        ? <img src={iconUrl} alt="" width={42} height={42} className="size-[42px] shrink-0 rounded-md border-2" style={{ borderColor: q.ring }} />
        : <span className="size-[42px] shrink-0 rounded-md border-2 bg-surface-2" style={{ borderColor: q.ring }} />}
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className={`${wrap ? 'wrap-anywhere' : 'truncate'} text-[15px] font-semibold`} style={{ color: q.text }}>{name}</span>
        {detail && <Detail detail={detail} wrap={wrap} />}
      </span>
    </a>
  );
}

/** The detail line, with a leading upgrade track in its color. */
function Detail({ detail, wrap }: { detail: string; wrap?: boolean }) {
  const { lead, className, rest } = detailParts(detail);
  return (
    <span className={`${wrap ? 'wrap-anywhere' : 'truncate'} font-mono text-[13px] text-muted`}>
      {lead && <span className={className}>{lead}</span>}{rest}
    </span>
  );
}
