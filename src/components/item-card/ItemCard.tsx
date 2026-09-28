import type { Quality } from '@/core/types';

const QUALITY_STYLES: Record<Quality, { ring: string; text: string; bg: string; border: string }> = {
  POOR: { ring: '#9d9d9d', text: '#b5b5b5', bg: '#1c1b1a', border: '#3d3b38' },
  COMMON: { ring: '#ffffff', text: '#f2f2f2', bg: '#1f1e1c', border: '#4a4744' },
  UNCOMMON: { ring: '#1eff00', text: '#6cf36c', bg: '#17200f', border: '#2f5a1f' },
  RARE: { ring: '#0070dd', text: '#5eaaff', bg: '#111b28', border: '#1f4670' },
  EPIC: { ring: '#a335ee', text: '#c58cf5', bg: '#1e1628', border: '#4f2c70' },
  LEGENDARY: { ring: '#ff8000', text: '#ffa64d', bg: '#2a1c0e', border: '#704014' },
  ARTIFACT: { ring: '#e6cc80', text: '#e6cc80', bg: '#262116', border: '#6b5d33' },
  HEIRLOOM: { ring: '#00ccff', text: '#5cdcff', bg: '#10222a', border: '#1d5566' },
};

export function wowheadData(itemId: number, bonusIds: number[], itemLevel: number | null): string {
  const parts = [`item=${itemId}`];
  if (bonusIds.length > 0) parts.push(`bonus=${bonusIds.join(':')}`);
  if (itemLevel) parts.push(`ilvl=${itemLevel}`);
  return parts.join('&');
}

interface ItemCardProps {
  itemId: number;
  name: string;
  quality: Quality;
  iconUrl: string | null;
  bonusIds: number[];
  itemLevel: number | null;
  detail?: string;
}

/** The whole card is the Wowhead link, so hovering anywhere on it shows the item tooltip. */
export function ItemCard({ itemId, name, quality, iconUrl, bonusIds, itemLevel, detail }: ItemCardProps) {
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
        <span className="truncate text-[15px] font-semibold" style={{ color: q.text }}>{name}</span>
        {detail && <span className="truncate font-mono text-[13px] text-muted">{detail}</span>}
      </span>
    </a>
  );
}

export function EmptySlotCard() {
  return (
    <div className="flex min-h-[62px] items-center rounded-lg border border-dashed border-line-strong px-4 text-[15px] text-muted">
      Empty slot
    </div>
  );
}
