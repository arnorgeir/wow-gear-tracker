import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { classTextColor } from '@/components/shared/class-colors';
import { VaultChoiceList } from '@/components/vault-choice-list/VaultChoiceList';
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
          {v.pastedAt === null
            ? <p className="text-sm text-muted">No SimC import with Great Vault data this week.</p>
            : <VaultChoiceList choices={v.choices} />}
        </div>
      ))}
    </section>
  );
}
