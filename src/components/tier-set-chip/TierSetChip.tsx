import { tierSetBonus } from '@/core/gear/tier-set';

/** Shows the 2-piece or 4-piece tier set bonus; renders nothing below 2 pieces. */
export function TierSetChip({ pieces }: { pieces: number }) {
  const bonus = tierSetBonus(pieces);
  if (bonus === null) return null;
  const label = `${bonus}-piece tier set bonus, ${pieces} tier pieces equipped`;
  const look = bonus === 4 ? 'bg-gold text-bg' : 'border border-gold-line text-gold';
  return (
    <span className={`inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-xs font-semibold ${look}`} title={label}>
      <span aria-hidden="true"><span className="font-mono">{bonus}</span>-set</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
