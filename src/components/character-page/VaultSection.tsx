import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { ItemCard } from '@/components/item-card/ItemCard';
import { VaultChoiceList } from '@/components/vault-choice-list/VaultChoiceList';
import { VaultHistory } from '@/components/vault-history/VaultHistory';
import { formatAge } from '@/core/format';
import type { CharacterPageView } from '@/server/views/types';

type Props = Pick<CharacterPageView, 'id' | 'vault' | 'vaultChoices' | 'vaultChoicesAt' | 'vaultHistoryBefore' | 'specSlug' | 'listType' | 'bisSource' | 'bisFetchedAt' | 'editedCount'> & { now: number };

export function VaultSection({ id, vault, vaultChoices, vaultChoicesAt, vaultHistoryBefore, specSlug, listType, bisSource, bisFetchedAt, editedCount, now }: Props) {
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
        {vaultChoicesAt === null
          ? <p className="text-muted">No SimC import with Great Vault data this week. Paste SimC to see your Great Vault choices.</p>
          : <VaultChoiceList choices={vaultChoices} />}
        {/* Keyed by what the history depends on: router.refresh() keeps client state, so a new spec, list, list contents or week remounts it. */}
        {vaultHistoryBefore !== null && <VaultHistory key={`${specSlug}:${listType}:${bisSource}:${bisFetchedAt}:${editedCount}:${vaultHistoryBefore}`} id={id} before={vaultHistoryBefore} now={now} />}
      </div>
    </section>
  );
}
