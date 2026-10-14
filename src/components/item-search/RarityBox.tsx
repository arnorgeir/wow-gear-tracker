import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import type { Quality } from '@/core/types';

const CLASS = 'size-[34px] shrink-0 rounded-md border-2 bg-surface';

/** The item's icon in a ring of the given quality; an empty ring when no icon is cached. */
export function RarityBox({ quality, iconUrl }: { quality: Quality; iconUrl: string | null }) {
  const style = { borderColor: QUALITY_STYLES[quality].ring };
  return iconUrl
    ? <img src={iconUrl} alt="" width={34} height={34} aria-hidden="true" className={CLASS} style={style} />
    : <span aria-hidden="true" className={CLASS} style={style} />;
}
