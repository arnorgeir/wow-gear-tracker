import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CharacterAvatar } from '@/components/CharacterAvatar';
import { CharacterSettings } from '@/components/CharacterSettings';
import { classColor } from '@/components/class-colors';
import { CrestSummary } from '@/components/CrestSummary';
import { EmptySlotCard, ItemCard } from '@/components/ItemCard';
import { RefreshButton } from '@/components/RefreshButton';
import { RemoveCharacterButton } from '@/components/RemoveCharacterButton';
import { ROW_TONE_STYLES, rowTone } from '@/components/row-tone';
import { SetupNotice } from '@/components/SetupNotice';
import { SimcPaste } from '@/components/SimcPaste';
import { StaleSync } from '@/components/StaleSync';
import { StateBadge } from '@/components/StateBadge';
import { UpgradeBadge } from '@/components/UpgradeBadge';
import { MissingConfigError } from '@/core/config';
import { formatAge } from '@/core/format';
import { isStale } from '@/core/sync/character-sync';
import { LIST_TYPES, type ListType } from '@/core/types';
import { getServices, type Services } from '@/server/services';
import { getCharacterPage, type GearRowView } from '@/server/views';

export const dynamic = 'force-dynamic';

const LIST_NAMES: Record<ListType, string> = { overall: 'Overall', raid: 'Raid', mythicPlus: 'Mythic+' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ list?: string }> };

function BisTarget({ row }: { row: GearRowView }) {
  const name = row.bis.isTier ? `Tier piece (catalyst ${row.bis.name})` : row.bis.name;
  return (
    <ItemCard itemId={row.bis.itemId} name={name} quality={row.bis.quality} iconUrl={row.bis.iconUrl}
      bonusIds={row.bis.bonusIds} itemLevel={null} detail={row.bis.source} />
  );
}

export default async function CharacterPage({ params, searchParams }: Props) {
  const [{ id }, { list }] = await Promise.all([params, searchParams]);
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (err instanceof MissingConfigError) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const listType = (LIST_TYPES as readonly string[]).includes(list ?? '') ? (list as ListType) : undefined;
  const view = await getCharacterPage(services, Number(id), listType);
  if (!view) notFound();

  const now = services.now();
  const color = classColor(view.className);
  const source = view.snapshot && view.sourceAt !== null
    ? `${view.snapshot.source === 'simc' ? 'From SimC, pasted' : 'From Blizzard, synced'} ${formatAge(view.sourceAt, now)}`
    : 'Not synced yet';

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <Link href="/" className="text-sm">&larr; All characters</Link>

      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <CharacterAvatar name={view.name} className={view.className} avatarUrl={view.avatarUrl} classIconUrl={view.classIconUrl} size={76} />
          <div className="flex flex-col">
            <h1 className="font-display text-4xl font-bold tracking-wide">{view.name}</h1>
            <span className="text-muted">{view.realmName} ({view.region.toUpperCase()})</span>
            <span className="font-semibold" style={{ color }}>{view.identity}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{source}</span>
          <RefreshButton id={view.id} />
          <RemoveCharacterButton id={view.id} name={view.name} redirectTo="/" />
        </div>
      </div>

      {view.status === 'notFound' && (
        <p role="alert" className="rounded-lg border border-[#8a5a2b] bg-[#2e1f16] p-3 text-[#f3c9a2]">
          Blizzard can&rsquo;t find this character. It may have been renamed or transferred. You can remove it and search again.
        </p>
      )}
      {view.status === 'ok' && view.lastSyncError && <p role="alert" className="text-[#f3c9a2]">{view.lastSyncError}</p>}
      {view.bisError && (
        <p role="alert" className="text-[#f3c9a2]">
          {view.bisError}{view.bisFetchedAt ? `. Showing the list from ${formatAge(view.bisFetchedAt, now)}.` : '.'}
        </p>
      )}
      {view.tracksError && <p role="alert" className="text-[#f3c9a2]">{view.tracksError}.</p>}

      <SimcPaste id={view.id} />

      <section aria-label="Crests" className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Crests</h2>
        <CrestSummary crests={view.crests} now={now} />
      </section>

      <CharacterSettings id={view.id} specs={view.specs} spec={view.spec} activeSpec={view.activeSpec} priorityList={view.priorityList} />

      <nav aria-label="BiS lists" className="flex gap-2 border-b border-line">
        {LIST_TYPES.map((l) => (
          <Link key={l} href={`/characters/${view.id}?list=${l}`} aria-current={l === view.listType ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-3 font-semibold no-underline ${l === view.listType ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
            {LIST_NAMES[l]} <span className="font-mono text-sm">{view.counts[l].bis}/{view.counts[l].total}</span>
          </Link>
        ))}
      </nav>

      <section aria-label="Gear by slot" className="flex flex-col rounded-2xl border border-line bg-surface py-1">
        <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px] gap-3 border-b border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted md:grid">
          <span>Slot</span><span>Equipped</span><span>BiS</span><span>State</span>
        </div>
        {view.rows.length === 0 && <p className="p-6 text-muted">No BiS list to compare against yet.</p>}
        {view.rows.map((row, index) => {
          const tone = rowTone(row.state, !view.tracksError);
          return (
          <div key={`${row.slot}-${index}`} style={tone ? ROW_TONE_STYLES[tone] : undefined}
            className="mx-2 my-1 grid grid-cols-1 gap-3 rounded-[10px] px-3 py-2 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px] md:items-center">
            <span className="font-semibold text-muted">{row.slotLabel}</span>
            {row.equipped ? (
              <ItemCard itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality} iconUrl={row.equipped.iconUrl}
                bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel}
                detail={[row.equipped.trackLabel ?? 'no track', row.equipped.itemLevel].filter(Boolean).join(' · ')} />
            ) : <EmptySlotCard />}
            <BisTarget row={row} />
            <div className="flex flex-col gap-1.5">
              <StateBadge state={row.state} />
              {row.upgrade && <UpgradeBadge upgrade={row.upgrade} />}
            </div>
          </div>
          );
        })}
      </section>

      <section aria-label="Great Vault" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-2xl font-bold">Great Vault</h2>

        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted">BiS items below Myth track</h3>
          {view.vault.length === 0 ? (
            <p className="text-muted">None. Every BiS item you have is on Myth track.</p>
          ) : view.vault.map((row) => row.equipped && (
            <ItemCard key={row.slot} itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality}
              iconUrl={row.equipped.iconUrl} bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel}
              detail={row.equipped.trackLabel ?? undefined} />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted">
            This week&rsquo;s choices{view.vaultChoicesAt !== null ? `, from SimC pasted ${formatAge(view.vaultChoicesAt, now)}` : ''}
          </h3>
          {view.vaultChoicesAt === null ? (
            <p className="text-muted">Paste SimC to see your Great Vault choices.</p>
          ) : view.vaultChoices.length === 0 ? (
            <p className="text-muted">No item choices in the vault in the last paste.</p>
          ) : view.vaultChoices.map((choice, index) => (
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

      <StaleSync ids={view.status === 'ok' && isStale(view.lastSyncedAt, now) ? [view.id] : []} />
    </main>
  );
}
