import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GroupEditsProvider } from '@/components/group-edits/GroupEditsProvider';
import { GroupGrid } from '@/components/group-grid/GroupGrid';
import { GroupLayout } from '@/components/group-layout/GroupLayout';
import { GroupMembers } from '@/components/group-members/GroupMembers';
import { GroupPriority } from '@/components/group-priority/GroupPriority';
import { GroupVault } from '@/components/group-vault/GroupVault';
import { RememberGroup } from '@/components/remember-group/RememberGroup';
import { BackgroundSync } from '@/components/background-sync/BackgroundSync';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { StaleSync } from '@/components/stale-sync/StaleSync';
import { StateLegend } from '@/components/state-legend/StateLegend';
import { GROUP_COOKIE } from '@/core/characters/member-key';
import { isMissingConfigError } from '@/core/config';
import { getServices, type Services } from '@/server/services';
import { getGroupPage } from '@/server/views/group-page';
import { resolveGroupRequest } from '@/server/views/group-page-params';

export const dynamic = 'force-dynamic';

// Below xl the Dungeons and Vault panels are boxes of their own; at xl they sit inside the rail's box.
const PANEL_BOX = 'rounded-2xl border border-line bg-surface p-4 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0';

type Props = { searchParams: Promise<{ chars?: string | string[] }> };

export default async function GroupPage({ searchParams }: Props) {
  const [{ chars }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const request = resolveGroupRequest(chars, cookieStore.get(GROUP_COOKIE)?.value);
  if ('redirect' in request) redirect(request.redirect);

  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (isMissingConfigError(err)) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const view = await getGroupPage(services, request.keys);
  const now = services.now();

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-12 sm:px-8 2xl:px-16">
      <GroupEditsProvider keys={view.keys}>
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-4xl font-bold tracking-wide">Group</h1>
          <GroupMembers members={view.members} region={view.region} available={view.available} tracked={view.tracked} />
          {view.dropped.map((d) => (
            <p key={`${d.region}-${d.name}`} className="text-sm text-muted">{d.name} ({d.region.toUpperCase()}) dropped: group members must share a region.</p>
          ))}
        </div>
        {view.members.length === 0 ? (
          <p className="text-muted">Pick up to five characters to compare their gear and rank dungeons for the group.</p>
        ) : (
          <GroupLayout
            dungeonCount={view.priority.ranking?.dungeons.length ?? 0}
            legend={<StateLegend />}
            gear={<GroupGrid members={view.members} grid={view.grid} tracksKnown={view.tracksKnown} />}
            dungeons={<div className={PANEL_BOX}><GroupPriority priority={view.priority} /></div>}
            vault={<div className={PANEL_BOX}><GroupVault vault={view.vault} now={now} /></div>}
          />
        )}
      </GroupEditsProvider>
      <RememberGroup keys={view.keys} />
      <StaleSync ids={view.staleIds} />
      {view.region && <BackgroundSync url={`/api/season/sync?region=${view.region}`} due={view.needsSeasonSync ? 'season' : null} />}
    </main>
  );
}
