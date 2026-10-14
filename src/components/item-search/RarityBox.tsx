import type { ItemChoice } from '@/core/bis/edits';
import { pickQuality } from '@/core/bis/pick-quality';
import { QUALITY_STYLES } from '@/components/item-card/quality-styles';

const CLASS = 'size-[34px] shrink-0 rounded-md border-2 bg-surface';

/** The item's icon in its pick-quality ring; an empty ring when no icon is cached. */
export function RarityBox({ item }: { item: Pick<ItemChoice, 'quality' | 'iconUrl'> }) {
  const style = { borderColor: QUALITY_STYLES[pickQuality(item.quality)].ring };
  return item.iconUrl
    ? <img src={item.iconUrl} alt="" width={34} height={34} aria-hidden="true" className={CLASS} style={style} />
    : <span aria-hidden="true" className={CLASS} style={style} />;
}
