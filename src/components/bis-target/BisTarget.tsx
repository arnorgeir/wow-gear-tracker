import { ItemCard } from '@/components/item-card/ItemCard';
import type { GearRowView } from '@/server/views/types';
import { AnyItemCard } from './AnyItemCard';

export function BisTarget({ row, wrap }: { row: GearRowView; wrap?: boolean }) {
  if (row.bis.kind === 'any') return <AnyItemCard minItemLevel={row.bis.minItemLevel} />;
  const name = row.bis.isTier ? `Tier piece (catalyst ${row.bis.name})` : row.bis.name;
  return (
    <ItemCard itemId={row.bis.itemId} name={name} quality={row.bis.quality} iconUrl={row.bis.iconUrl}
      bonusIds={row.bis.bonusIds} itemLevel={null} detail={row.bis.source} wrap={wrap} />
  );
}
