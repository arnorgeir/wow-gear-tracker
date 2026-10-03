import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GroupGrid } from '@/components/group-grid/GroupGrid';
import { GroupMembers } from '@/components/group-members/GroupMembers';
import { GroupPriority } from '@/components/group-priority/GroupPriority';
import { GroupVault } from '@/components/group-vault/GroupVault';
import { RememberGroup } from '@/components/remember-group/RememberGroup';
import { SeasonSync } from '@/components/season-sync/SeasonSync';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { StaleSync } from '@/components/stale-sync/StaleSync';
import { StateLegend } from '@/components/state-legend/StateLegend';
import { GROUP_COOKIE } from '@/core/characters/member-key';
import { isMissingConfigError } from '@/core/config';
import { getServices, type Services } from '@/server/services';
import { getGroupPage } from '@/server/views/group-page';
import { resolveGroupRequest } from '@/server/views/group-page-params';

export const dynamic = 'force-dynamic';

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
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-12 sm:px-16">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl font-bold tracking-wide">Group</h1>
        <GroupMembers members={view.members} keys={view.keys} region={view.region} available={view.available} tracked={view.tracked} />
        {view.dropped.map((d) => (
          <p key={`${d.region}-${d.name}`} className="text-sm text-muted">{d.name} ({d.region.toUpperCase()}) dropped: group members must share a region.</p>
        ))}
      </div>
      {view.members.length === 0 ? (
        <p className="text-muted">Pick up to five characters to compare their gear and rank dungeons for the group.</p>
      ) : (
        <>
          <StateLegend />
          <GroupGrid members={view.members} grid={view.grid} keys={view.keys} tracksKnown={view.tracksKnown} now={now} />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
            <GroupPriority priority={view.priority} />
            <GroupVault vault={view.vault} now={now} />
          </div>
        </>
      )}
      <RememberGroup keys={view.keys} />
      <StaleSync ids={view.staleIds} />
      {view.region && <SeasonSync region={view.region} needed={view.needsSeasonSync} />}
    </main>
  );
}
