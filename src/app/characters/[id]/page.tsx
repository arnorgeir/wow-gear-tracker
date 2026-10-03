import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CharacterAlerts } from '@/components/character-page/CharacterAlerts';
import { CharacterHeader } from '@/components/character-page/CharacterHeader';
import { DungeonPriority } from '@/components/character-page/DungeonPriority';
import { GearTable } from '@/components/character-page/GearTable';
import { ListTabs } from '@/components/character-page/ListTabs';
import { VaultSection } from '@/components/character-page/VaultSection';
import { CharacterSettings } from '@/components/character-settings/CharacterSettings';
import { CrestSummary } from '@/components/crest-summary/CrestSummary';
import { SeasonSync } from '@/components/season-sync/SeasonSync';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { SimcPaste } from '@/components/simc-paste/SimcPaste';
import { StaleSync } from '@/components/stale-sync/StaleSync';
import { isMissingConfigError } from '@/core/config';
import { isStale } from '@/core/sync/character-sync';
import { LIST_TYPES, type ListType } from '@/core/types';
import { getServices, type Services } from '@/server/services';
import { getCharacterPage } from '@/server/views/character-page';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ list?: string }> };

export default async function CharacterPage({ params, searchParams }: Props) {
  const [{ id }, { list }] = await Promise.all([params, searchParams]);
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (isMissingConfigError(err)) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const listType = (LIST_TYPES as readonly string[]).includes(list ?? '') ? (list as ListType) : undefined;
  const view = await getCharacterPage(services, Number(id), listType);
  if (!view) notFound();
  const now = services.now();

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <Link href="/" className="text-sm">&larr; All characters</Link>
      <CharacterHeader view={view} now={now} />
      <CharacterAlerts view={view} now={now} />
      <SimcPaste id={view.id} />
      <section aria-label="Crests" className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Crests</h2>
        <CrestSummary crests={view.crests} now={now} />
      </section>
      <CharacterSettings id={view.id} specs={view.specs} spec={view.spec} activeSpec={view.activeSpec} priorityList={view.priorityList} />
      <ListTabs id={view.id} listType={view.listType} counts={view.counts} />
      <div className="grid grid-cols-1 gap-8 min-[1380px]:grid-cols-[860px_minmax(0,1fr)] min-[1380px]:items-start">
        <GearTable rows={view.rows} tracksKnown={!view.tracksError} />
        <div className="flex flex-col gap-8">
          <DungeonPriority priority={view.priority} specLabel={`${view.spec} ${view.className}`} />
          <VaultSection vault={view.vault} vaultChoices={view.vaultChoices} vaultChoicesAt={view.vaultChoicesAt} now={now} />
        </div>
      </div>
      <StaleSync ids={view.status === 'ok' && isStale(view.lastSyncedAt, now) ? [view.id] : []} />
      <SeasonSync region={view.region} needed={view.priority.needsSync} />
    </main>
  );
}
