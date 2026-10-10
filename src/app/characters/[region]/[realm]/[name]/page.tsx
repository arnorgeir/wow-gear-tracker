import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoAddCharacter } from '@/components/auto-add-character/AutoAddCharacter';
import { CharacterAlerts } from '@/components/character-page/CharacterAlerts';
import { CharacterHeader } from '@/components/character-page/CharacterHeader';
import { DungeonPriority } from '@/components/character-page/DungeonPriority';
import { DungeonPrioritySkeleton } from '@/components/character-page/DungeonPrioritySkeleton';
import { GearTable } from '@/components/character-page/GearTable';
import { GearTableSkeleton } from '@/components/character-page/GearTableSkeleton';
import { ListTabs } from '@/components/character-page/ListTabs';
import { VaultSection } from '@/components/character-page/VaultSection';
import { VaultSectionSkeleton } from '@/components/character-page/VaultSectionSkeleton';
import { ListSwitchProvider } from '@/components/list-switch/ListSwitchProvider';
import { WhileListSettled } from '@/components/list-switch/WhileListSettled';
import { CharacterSettings } from '@/components/character-settings/CharacterSettings';
import { CrestSummary } from '@/components/crest-summary/CrestSummary';
import { BackgroundSync } from '@/components/background-sync/BackgroundSync';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { SimcPaste } from '@/components/simc-paste/SimcPaste';
import { StaleSync } from '@/components/stale-sync/StaleSync';
import { memberKeyFromPath } from '@/core/characters/member-key';
import { isMissingConfigError } from '@/core/config';
import { isStale } from '@/core/sync/character-sync';
import { LIST_TYPES, type ListType } from '@/core/types';
import { getServices, type Services } from '@/server/services';
import { getCharacterPage } from '@/server/views/character-page';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ region: string; realm: string; name: string }>; searchParams: Promise<{ list?: string }> };

export default async function CharacterPage({ params, searchParams }: Props) {
  const [{ region, realm, name }, { list }] = await Promise.all([params, searchParams]);
  const key = memberKeyFromPath(region, realm, name);
  if (!key) notFound();
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (isMissingConfigError(err)) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const listType = (LIST_TYPES as readonly string[]).includes(list ?? '') ? (list as ListType) : undefined;
  const view = await getCharacterPage(services, key, listType);
  if (view.status === 'untracked') {
    return (
      <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
        <Link href="/" className="text-sm">&larr; All characters</Link>
        <AutoAddCharacter character={view} />
      </main>
    );
  }
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
      <ListSwitchProvider listType={view.listType}>
        <ListTabs href={view.href} counts={view.counts} />
        <div className="grid grid-cols-1 gap-8 min-[1380px]:grid-cols-[860px_minmax(0,1fr)] min-[1380px]:items-start">
          <WhileListSettled fallback={<GearTableSkeleton />}>
            <GearTable rows={view.rows} tracksKnown={view.tracksKnown} bisLoading={view.bisLoading} />
          </WhileListSettled>
          <div className="flex flex-col gap-8">
            <WhileListSettled fallback={<DungeonPrioritySkeleton />}>
              <DungeonPriority priority={view.priority} specLabel={`${view.spec} ${view.className}`} />
            </WhileListSettled>
            <WhileListSettled fallback={<VaultSectionSkeleton />}>
              <VaultSection vault={view.vault} vaultChoices={view.vaultChoices} vaultChoicesAt={view.vaultChoicesAt} now={now} />
            </WhileListSettled>
          </div>
        </div>
      </ListSwitchProvider>
      <StaleSync ids={view.status === 'ok' && isStale(view.lastSyncedAt, now) ? [view.id] : []} />
      <BackgroundSync url={`/api/season/sync?region=${view.region}`} due={view.priority.needsSync ? 'season' : null} />
      <BackgroundSync url="/api/reference/sync" due={view.referenceDue} />
    </main>
  );
}
