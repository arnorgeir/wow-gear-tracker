import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import type { Quality } from '@/core/types';

interface Props {
  itemId: number | null;
  name: string;
  quality: Quality | null;
  iconUrl: string | null;
  detail: string;
  /** Pills or notes that sit before the detail text. */
  badge?: React.ReactNode;
  /** Method's pick once an override replaced it: smaller, dimmed and struck through. */
  replaced?: boolean;
}

/** One item in the editor: icon in its rarity ring, a Wowhead link and a detail line. An "Any" pick has no item, so no link. */
export function PickLine({ itemId, name, quality, iconUrl, detail, badge, replaced }: Props) {
  const q = quality ? QUALITY_STYLES[quality] : null;
  const ring = q?.ring ?? 'var(--color-line-strong)';
  const size = replaced ? 26 : 40;
  const box = { width: size, height: size, borderColor: ring, borderStyle: itemId === null ? 'dashed' : 'solid' } as const;
  return (
    <div className={`flex min-w-0 items-center gap-3 ${replaced ? 'opacity-60' : ''}`}>
      {iconUrl
        ? <img src={iconUrl} alt="" width={size} height={size} className="shrink-0 rounded-md border-2 bg-surface-2" style={box} />
        : <span aria-hidden="true" className="shrink-0 rounded-md border-2 bg-surface-2" style={box} />}
      <div className="flex min-w-0 flex-col gap-0.5">
        {itemId === null
          ? <span className="truncate text-[15px] font-semibold">{name}</span>
          : (
            <a href={`https://www.wowhead.com/item=${itemId}`} data-wowhead={wowheadData(itemId, [], null)} target="_blank" rel="noreferrer"
              className={`truncate text-[15px] font-semibold no-underline hover:underline ${replaced ? 'line-through' : ''}`} style={{ color: q?.text }}>
              {name}
            </a>
          )}
        <span className="flex items-center gap-2 text-[13px] text-muted">{badge}<span className="truncate">{detail}</span></span>
      </div>
    </div>
  );
}
