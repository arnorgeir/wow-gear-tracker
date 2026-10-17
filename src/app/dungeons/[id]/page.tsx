import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { DungeonPage } from '@/components/dungeon-page/DungeonPage';
import { parseGuideState } from '@/components/dungeon-page/guide-state';
import { DUNGEON_LOOT_VIEW_COOKIE, parseDungeonLootView } from '@/components/view-toggle/dungeon-loot-view';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { GROUP_COOKIE } from '@/core/characters/member-key';
import { isMissingConfigError } from '@/core/config';
import { parseId } from '@/server/route-helpers';
import { getServices, type Services } from '@/server/services';
import { getDungeonPage } from '@/server/views/dungeon-page';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DungeonRoute({ params, searchParams }: Props) {
  const [{ id }, query, cookieStore] = await Promise.all([params, searchParams, cookies()]);
  const challengeModeId = parseId(id);
  if (challengeModeId === null) notFound();
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (isMissingConfigError(err)) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const view = await getDungeonPage(services, challengeModeId, { who: query.who === 'group' ? 'group' : 'all', groupCookie: cookieStore.get(GROUP_COOKIE)?.value });
  if (!view) notFound();
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <DungeonPage view={view} state={parseGuideState(query, view.bosses.map((b) => b.encounterId))}
        layout={parseDungeonLootView(cookieStore.get(DUNGEON_LOOT_VIEW_COOKIE)?.value)} />
    </main>
  );
}
