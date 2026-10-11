import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { SpecPicker } from '@/components/spec-picker/SpecPicker';
import { isMissingConfigError } from '@/core/config';
import { getServices, type Services } from '@/server/services';
import { getSpecPicker } from '@/server/views/settings-bis';

export const dynamic = 'force-dynamic';

export default async function BisSettingsPage() {
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (isMissingConfigError(err)) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const view = await getSpecPicker(services);
  return (
    <section aria-label="BiS lists" className="flex flex-col gap-6">
      <p className="max-w-prose text-muted">Pick a spec to choose which Method list it compares against and to swap single slots. Specs you track are highlighted.</p>
      <SpecPicker view={view} now={services.now()} />
    </section>
  );
}
