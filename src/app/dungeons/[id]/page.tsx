import { notFound } from 'next/navigation';
import { DungeonPage } from '@/components/dungeon-page/DungeonPage';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { isMissingConfigError } from '@/core/config';
import { parseId } from '@/server/route-helpers';
import { getServices, type Services } from '@/server/services';
import { getDungeonPage } from '@/server/views/dungeon-page';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function DungeonRoute({ params }: Props) {
  const { id } = await params;
  const challengeModeId = parseId(id);
  if (challengeModeId === null) notFound();
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (isMissingConfigError(err)) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const view = await getDungeonPage(services, challengeModeId);
  if (!view) notFound();
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-10 sm:px-16">
      <DungeonPage view={view} />
    </main>
  );
}
