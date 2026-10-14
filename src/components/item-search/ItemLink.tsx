import type { ItemChoice } from '@/core/bis/edits';
import type { Quality } from '@/core/types';
import { QUALITY_STYLES } from '@/components/item-card/quality-styles';
import { wowheadData } from '@/components/item-card/wowhead';
import { RarityBox } from './RarityBox';

/** Icon, name and any detail line as one content-sized Wowhead link. The caller picks the quality, so each row shows the rarity it means. */
export function ItemLink({ item, quality, children }: { item: Pick<ItemChoice, 'itemId' | 'name' | 'iconUrl'>; quality: Quality; children?: React.ReactNode }) {
  return (
    <a href={`https://www.wowhead.com/item=${item.itemId}`} data-wowhead={wowheadData(item.itemId, [], null)} target="_blank" rel="noreferrer"
      className="group inline-flex max-w-full min-w-0 items-center gap-3 no-underline">
      <RarityBox quality={quality} iconUrl={item.iconUrl} />
      <span className="flex min-w-0 flex-col gap-px">
        <span className="text-[15px] font-semibold group-hover:underline" style={{ color: QUALITY_STYLES[quality].text }}>{item.name}</span>
        {children}
      </span>
    </a>
  );
}
