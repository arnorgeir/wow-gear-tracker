import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { isMissingConfigError } from '@/core/config';
import { LIST_TYPES, type ListType } from '@/core/types';
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
  const editing: ListType = (LIST_TYPES as readonly string[]).includes(list ?? '') ? (list as ListType) : 'mythicPlus';
  const view = await getSettingsSpec(services, spec, editing);
  if (!view) notFound();
  return (
    <section aria-label={`${view.specName} ${view.className}`} className="flex flex-col gap-6">
      <Link href="/settings/bis" className="text-sm">&larr; All specs</Link>
      <h2 className="font-display text-2xl font-bold">{view.specName} {view.className}</h2>
    </section>
  );
}
