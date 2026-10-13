import { classColor, classTextColor } from '@/components/shared/class-colors';
import type { SpecPickerView } from '@/server/views/types';
import { classSummary } from './picker-text';
import { SpecRow, SpecRowPhone } from './SpecRow';
import { TrackedCard } from './TrackedCard';

const HEADING = 'text-[13px] font-bold uppercase tracking-[0.08em] text-muted';

function ClassIcon({ url, className, size }: { url: string | null; className: string; size: number }) {
  const style = { width: size, height: size, borderColor: classColor(className) };
  return url
    ? <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-lg border-2 bg-surface-2" style={style} />
    : <span aria-hidden="true" className="shrink-0 rounded-lg border-2 bg-surface-2" style={style} />;
}

export function SpecPicker({ view, now }: { view: SpecPickerView; now: number }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[28px] font-bold">BiS lists</h2>
        <p className="max-w-[760px] text-[15px] leading-normal text-muted md:text-[17px]">
          Pick each spec&apos;s BiS source and which list it compares against, and swap single slots for your own picks. A change applies to every character of that spec.
        </p>
      </div>

      {view.tracked.length > 0 && (
        <section aria-labelledby="your-specs" className="flex flex-col gap-2.5 md:gap-3.5">
          <h3 id="your-specs" className={HEADING}>Your specs <span className="font-mono font-medium">{view.tracked.length}</span></h3>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3.5">
            {view.tracked.map((spec) => <TrackedCard key={spec.slug} spec={spec} />)}
          </div>
        </section>
      )}

      <section aria-labelledby="all-classes" className="flex flex-col gap-2 md:gap-3.5">
        <div className="flex items-baseline justify-between gap-4">
          <h3 id="all-classes" className={HEADING}>All classes</h3>
          <span className="hidden text-sm text-muted md:inline">Untracked specs need their list fetched before you can edit them.</span>
        </div>

        <div className="hidden grid-cols-3 items-start gap-3.5 md:grid">
          {view.classes.map((c) => (
            <section key={c.className} aria-label={c.className} className="overflow-hidden rounded-[14px] border border-line bg-surface">
              <h4 className="flex items-center gap-3 border-b border-raised px-4 py-3 font-display text-[17px] font-bold" style={{ color: classTextColor(c.className) }}>
                <ClassIcon url={c.iconUrl} className={c.className} size={36} />
                {c.className}
              </h4>
              <ul className="flex flex-col px-2 py-1.5">{c.specs.map((s) => <SpecRow key={s.slug} spec={s} now={now} />)}</ul>
            </section>
          ))}
        </div>

        <div className="flex flex-col gap-2 md:hidden">
          {view.classes.map((c) => (
            <details key={c.className} open={c.trackedCount > 0 || undefined} className="group overflow-hidden rounded-xl border border-line bg-surface">
              <summary className="flex min-h-[52px] list-none items-center gap-3 px-3.5 [&::-webkit-details-marker]:hidden">
                <ClassIcon url={c.iconUrl} className={c.className} size={32} />
                <span className="grow font-display text-base font-bold" style={{ color: classTextColor(c.className) }}>{c.className}</span>
                <span className="text-[13px] text-muted">{classSummary(c.trackedCount, c.specs.length)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <ul className="px-2 pb-2">{c.specs.map((s) => <SpecRowPhone key={s.slug} spec={s} now={now} />)}</ul>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
