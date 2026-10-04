import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { classTextColor } from '@/components/shared/class-colors';
import { ItemCard } from '@/components/item-card/ItemCard';
import { formatAge } from '@/core/format';
import type { GroupVaultView } from '@/server/views/types';

export function GroupVault({ vault, now }: { vault: GroupVaultView[]; now: number }) {
  return (
    <section aria-label="Great Vault" className="flex flex-col gap-5">
      <h2 className="font-display text-xl font-bold whitespace-nowrap">Great Vault</h2>
      {vault.map((v) => (
        <div key={v.key} className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <CharacterAvatar name={v.name} className={v.className} avatarUrl={v.avatarUrl} classIconUrl={v.classIconUrl} size={24} />
            <span><span style={{ color: classTextColor(v.className) }}>{v.name}</span>{v.pastedAt !== null && <span className="font-normal text-muted"> · from SimC pasted {formatAge(v.pastedAt, now)}</span>}</span>
          </h3>
          {v.pastedAt === null ? (
            <p className="text-sm text-muted">No SimC paste yet.</p>
          ) : v.choices.length === 0 ? (
            <p className="text-sm text-muted">No item choices in the vault in the last paste.</p>
          ) : v.choices.map((choice, i) => (
            <div key={`${choice.itemId}-${i}`} className="flex items-center gap-3">
              <div className="min-w-0 grow">
                <ItemCard itemId={choice.itemId} name={choice.name} quality={choice.quality} iconUrl={choice.iconUrl}
                  bonusIds={choice.bonusIds} itemLevel={choice.itemLevel}
                  detail={[choice.trackLabel, choice.itemLevel].filter(Boolean).join(' · ') || undefined} />
              </div>
              <span className={`w-20 shrink-0 text-sm font-bold ${choice.isBis ? 'text-bags' : 'text-muted'}`}>{choice.isBis ? 'BiS' : 'Not BiS'}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
