import { ItemCard } from '@/components/item-card/ItemCard';
import { tierTargetText } from '@/components/shared/tier-target';
import type { GearRowView } from '@/server/views/types';
import { AnyItemCard } from './AnyItemCard';

export function BisTarget({ row, wrap }: { row: GearRowView; wrap?: boolean }) {
  if (row.bis.kind === 'any') return <AnyItemCard minItemLevel={row.bis.minItemLevel} />;
  const text = row.bis.isTier ? tierTargetText(row.bis) : row.bis.name;
  const name = text.charAt(0).toUpperCase() + text.slice(1);
  return (
    <ItemCard itemId={row.bis.itemId} name={name} quality={row.bis.quality} iconUrl={row.bis.iconUrl}
      bonusIds={row.bis.bonusIds} itemLevel={null} detail={row.bis.source} wrap={wrap} />
  );
}
