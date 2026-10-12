import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BisEditor } from '@/components/bis-editor/BisEditor';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { FetchButton } from '@/components/spec-picker/FetchButton';
import { isMissingConfigError } from '@/core/config';
import { LIST_TYPES, SOURCE_NAMES, type ListType } from '@/core/types';
import { getServices, type Services } from '@/server/services';
import { getSettingsSpec } from '@/server/views/settings-spec';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ spec: string }>; searchParams: Promise<{ list?: string }> };

export default async function SpecSettingsPage({ params, searchParams }: Props) {
  const [{ spec }, { list }] = await Promise.all([params, searchParams]);
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (isMissingConfigError(err)) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const asked = (LIST_TYPES as readonly string[]).includes(list ?? '') ? (list as ListType) : null;
  // The editor opens on the list the spec compares against, unless the URL names another.
  const first = await getSettingsSpec(services, spec, asked ?? 'mythicPlus');
  if (!first) notFound();
  const view = asked ? first : { ...first, editing: first.listType };
  return (
    <section aria-label={`${view.specName} ${view.className}`} className="flex flex-col gap-5 md:gap-7">
      <Link href="/settings/bis" className="text-sm">&larr; All specs</Link>
      {view.hasLists ? <BisEditor view={view} now={services.now()} /> : (
        <div className="flex flex-col items-start gap-3">
          <h2 className="font-display text-2xl font-bold">{view.specName} {view.className}</h2>
          <p className="text-muted">{SOURCE_NAMES[view.source]} has no list for this spec yet. Fetch it first.</p>
          <FetchButton specSlug={view.slug} label="Fetch" size="md" />
        </div>
      )}
    </section>
  );
}
