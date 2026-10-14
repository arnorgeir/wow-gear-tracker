import Link from 'next/link';
import { SpecIcon } from '@/components/spec-icon/SpecIcon';
import type { PickerSpecView } from '@/server/views/types';
import { FetchButton } from './FetchButton';
import { fetchAction, fetchStateLabel } from './fetch-state';
import { trackedLine } from './picker-text';

const TRACKED_PILL = 'inline-flex h-[26px] items-center gap-1.5 rounded-[13px] border border-gold-line bg-gold-soft px-2.5 text-[13px] font-bold text-gold';

function TrackedPill() {
  return (
    <span className={TRACKED_PILL}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
      Tracked
    </span>
  );
}

/** A spec in a class card on desktop: name, then one state with its action. */
export function SpecRow({ spec, now }: { spec: PickerSpecView; now: number }) {
  const action = fetchAction(spec.state);
  return (
    <li className={`flex min-h-[52px] items-center gap-2.5 rounded-lg px-2 ${spec.tracked ? 'bg-gold-wash' : ''}`}>
      <SpecIcon url={spec.iconUrl} className="" size={32} />
      {/* The state sits under the name, so "Fetched 9 days ago" never wraps beside it or shifts the button. */}
      <Link href={`/settings/bis/${spec.slug}`} className="flex min-w-0 grow flex-col gap-px no-underline">
        <span className={`truncate text-base font-semibold ${spec.tracked ? 'text-ink' : 'text-ink/85'}`}>{spec.specName}</span>
        {/* The Tracked pill already says "Tracked"; every other state gets its words, with or without a button. */}
        {spec.state.kind !== 'tracked' && (
          <span className={`truncate text-[13px] ${spec.state.kind === 'failed' ? 'text-missing' : 'text-muted'}`}>{fetchStateLabel(spec.state, now)}</span>
        )}
      </Link>
      {spec.tracked && <TrackedPill />}
      {action && <FetchButton specSlug={spec.slug} label={action} />}
    </li>
  );
}

/** A spec inside a phone accordion: the state sits under the name, in words. */
export function SpecRowPhone({ spec, now }: { spec: PickerSpecView; now: number }) {
  const action = fetchAction(spec.state);
  const first = spec.characters[0];
  const status = spec.tracked && first ? trackedLine(first.name, spec.compares) : fetchStateLabel(spec.state, now);
  const tone = spec.tracked ? 'text-gold' : spec.state.kind === 'failed' ? 'text-missing' : 'text-muted';
  return (
    <li className="flex min-h-[52px] items-center gap-2.5 border-t border-raised px-2">
      <SpecIcon url={spec.iconUrl} className="" size={32} />
      <Link href={`/settings/bis/${spec.slug}`} className="flex grow flex-col gap-px no-underline">
        <span className="text-base font-semibold text-ink">{spec.specName}</span>
        <span className={`text-[13px] ${tone}`}>{status}</span>
      </Link>
      {action && <FetchButton specSlug={spec.slug} label={action} size="md" />}
    </li>
  );
}
