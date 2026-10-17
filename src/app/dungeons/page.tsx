import { DungeonList } from '@/components/dungeon-list/DungeonList';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { isMissingConfigError } from '@/core/config';
import { getServices, type Services } from '@/server/services';
import { getDungeonList } from '@/server/views/dungeon-list';

export const dynamic = 'force-dynamic';

export default async function DungeonsRoute() {
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (isMissingConfigError(err)) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const view = await getDungeonList(services);
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <DungeonList view={view} />
    </main>
  );
}
