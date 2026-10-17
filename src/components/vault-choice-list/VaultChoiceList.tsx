import { ItemCard } from '@/components/item-card/ItemCard';
import type { VaultChoiceView } from '@/server/views/types';

/** A Great Vault's choices, a BiS one framed in gold so it stands out from the rest. */
export function VaultChoiceList({ choices }: { choices: VaultChoiceView[] }) {
  return choices.map((choice, index) => (
    <div key={`${choice.itemId}-${index}`} className={`flex items-center gap-3 rounded-xl border-2 p-1 ${choice.isBis ? 'border-gold bg-gold-soft' : 'border-transparent'}`}>
      <div className="min-w-0 grow">
        <ItemCard itemId={choice.itemId} name={choice.name} quality={choice.quality} iconUrl={choice.iconUrl}
          bonusIds={choice.bonusIds} itemLevel={choice.itemLevel}
          detail={[choice.trackLabel, choice.itemLevel].filter(Boolean).join(' · ') || undefined} />
      </div>
      {choice.isBis
        ? <span className="shrink-0 rounded-md bg-gold px-2 py-0.5 text-sm font-bold text-bg"><span aria-hidden="true">★ </span>BiS</span>
        : <span className="w-20 shrink-0 text-sm text-muted">Not BiS</span>}
    </div>
  ));
}
