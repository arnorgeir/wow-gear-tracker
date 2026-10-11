import Link from 'next/link';
import { classTextColor } from '@/components/shared/class-colors';
import type { SpecPickerView } from '@/server/views/types';
import { FetchButton } from './FetchButton';
import { fetchStateLabel } from './fetch-state';

export function SpecPicker({ view, now }: { view: SpecPickerView; now: number }) {
  return (
    <div className="flex flex-col gap-8">
      {view.classes.map((c) => (
        <section key={c.className} aria-label={c.className} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold" style={{ color: classTextColor(c.className) }}>
            {c.iconUrl && <img src={c.iconUrl} alt="" width={28} height={28} className="size-7 rounded-md" />}
            {c.className}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {c.specs.map((s) => (
              <li key={s.slug} className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line px-4 py-2 ${s.tracked ? 'bg-surface-2' : 'bg-surface'}`}>
                <Link href={`/settings/bis/${s.slug}`} className="min-w-32 font-semibold">{s.specName}</Link>
                <span className="text-sm text-muted">{fetchStateLabel(s.state, now)}</span>
                {s.state.kind === 'notFetched' && <FetchButton specSlug={s.slug} label="Fetch Method list" />}
                {(s.state.kind === 'failed' || s.state.kind === 'fetched') && <FetchButton specSlug={s.slug} label="Refresh" />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
