import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CharacterSettings } from '@/components/CharacterSettings';
import { classColor } from '@/components/class-colors';
import { EmptySlotCard, ItemCard } from '@/components/ItemCard';
import { RefreshButton } from '@/components/RefreshButton';
import { RemoveCharacterButton } from '@/components/RemoveCharacterButton';
import { SetupNotice } from '@/components/SetupNotice';
import { StaleSync } from '@/components/StaleSync';
import { StateBadge } from '@/components/StateBadge';
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
    <div className="flex min-w-0 flex-col gap-1">
      <ItemCard itemId={row.bis.itemId} name={name} quality={row.bis.quality} iconUrl={row.bis.iconUrl}
        bonusIds={row.bis.bonusIds} itemLevel={null} detail={row.bis.source} />
    </div>
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
  const source = view.snapshot
    ? `${view.snapshot.source === 'simc' ? 'From SimC, pasted' : 'From Blizzard, synced'} ${formatAge(view.lastSyncedAt ?? view.snapshot.createdAt, now)}`
    : 'Not synced yet';

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <Link href="/" className="text-sm">&larr; All characters</Link>

      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-full border-2 bg-bg text-2xl font-bold" style={{ borderColor: color, color }}>
            {view.name.charAt(0)}
          </span>
          <div className="flex flex-col">
            <h1 className="font-display text-4xl font-bold tracking-wide">{view.name}</h1>
            <span className="text-muted">{view.realmName} ({view.region.toUpperCase()})</span>
            <span className="font-semibold" style={{ color }}>{view.spec} {view.className}</span>
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

      <CharacterSettings id={view.id} specs={view.specs} spec={view.spec} activeSpec={view.activeSpec} priorityList={view.priorityList} />

      <nav aria-label="BiS lists" className="flex gap-2 border-b border-line">
        {LIST_TYPES.map((l) => (
          <Link key={l} href={`/characters/${view.id}?list=${l}`} aria-current={l === view.listType ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-3 font-semibold no-underline ${l === view.listType ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
            {LIST_NAMES[l]} <span className="font-mono text-sm">{view.counts[l].bis}/{view.counts[l].total}</span>
          </Link>
        ))}
      </nav>

      <section aria-label="Gear by slot" className="flex flex-col rounded-2xl border border-line bg-surface">
        <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_170px] gap-3 border-b border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted md:grid">
          <span>Slot</span><span>Equipped</span><span>BiS</span><span>State</span>
        </div>
        {view.rows.length === 0 && <p className="p-6 text-muted">No BiS list to compare against yet.</p>}
        {view.rows.map((row, index) => (
          <div key={`${row.slot}-${index}`} className="grid grid-cols-1 gap-3 border-b border-raised px-4 py-2 md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_170px] md:items-center">
            <span className="font-semibold text-muted">{row.slotLabel}</span>
            {row.equipped ? (
              <ItemCard itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality} iconUrl={row.equipped.iconUrl}
                bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel} golden={row.state === 'done' && !view.tracksError}
                detail={[row.equipped.trackLabel ?? 'no track', row.equipped.itemLevel].filter(Boolean).join(' · ')} />
            ) : <EmptySlotCard />}
            <BisTarget row={row} />
            <StateBadge state={row.state} />
          </div>
        ))}
      </section>

      <section aria-label="Great Vault targets" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-2xl font-bold">Great Vault targets</h2>
        {view.vault.length === 0 ? (
          <p className="text-muted">No BiS items below Myth track.</p>
        ) : view.vault.map((row) => row.equipped && (
          <ItemCard key={row.slot} itemId={row.equipped.itemId} name={row.equipped.name} quality={row.equipped.quality}
            iconUrl={row.equipped.iconUrl} bonusIds={row.equipped.bonusIds} itemLevel={row.equipped.itemLevel}
            detail={row.equipped.trackLabel ?? undefined} />
        ))}
      </section>

      <StaleSync ids={view.status === 'ok' && isStale(view.lastSyncedAt, now) ? [view.id] : []} />
    </main>
  );
}
