import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { ItemCard } from '@/components/item-card/ItemCard';
import { formatAge } from '@/core/format';
import type { CharacterPageView } from '@/server/views/types';

type Props = Pick<CharacterPageView, 'vault' | 'vaultChoices' | 'vaultChoicesAt'> & { now: number };

export function VaultSection({ vault, vaultChoices, vaultChoicesAt, now }: Props) {
  return (
    <section aria-label="Great Vault" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><BrandIcon name="vault" size={28} className="text-gold" />Great Vault</h2>

      <div className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted">BiS items below Myth track</h3>
        {vault.length === 0 ? (
          <p className="text-muted">None. Every BiS item you have is on Myth track.</p>
        ) : vault.map((row) => row.equipped && (
          <ItemCard key={row.slot} itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality}
            iconUrl={row.equipped.iconUrl} bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel}
            detail={row.equipped.trackLabel ?? undefined} />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted">
          This week&rsquo;s choices{vaultChoicesAt !== null ? `, from SimC pasted ${formatAge(vaultChoicesAt, now)}` : ''}
        </h3>
        {vaultChoicesAt === null ? (
          <p className="text-muted">Paste SimC to see your Great Vault choices.</p>
        ) : vaultChoices.length === 0 ? (
          <p className="text-muted">No item choices in the vault in the last paste.</p>
        ) : vaultChoices.map((choice, index) => (
          <div key={`${choice.itemId}-${index}`} className="flex items-center gap-3">
            <div className="min-w-0 grow">
              <ItemCard itemId={choice.itemId} name={choice.name} quality={choice.quality} iconUrl={choice.iconUrl}
                bonusIds={choice.bonusIds} itemLevel={choice.itemLevel}
                detail={[choice.trackLabel, choice.itemLevel].filter(Boolean).join(' · ') || undefined} />
            </div>
            <span className={`w-20 shrink-0 text-sm font-bold ${choice.isBis ? 'text-bags' : 'text-muted'}`}>{choice.isBis ? 'BiS' : 'Not BiS'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
