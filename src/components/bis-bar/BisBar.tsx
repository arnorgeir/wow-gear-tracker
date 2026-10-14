import type { barSegments } from '@/components/shared/bis-summary';

/** The segmented BiS progress bar. */
export function BisBar({ bar }: { bar: ReturnType<typeof barSegments> }) {
  return (
    // A tier piece with the wrong stats isn't BiS: it gets its own segment.
    <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
      <div className="bg-gold" style={{ flexGrow: bar.done }} />
      <div className="bg-crest" style={{ flexGrow: bar.mythUpgradable }} />
      <div className="bg-vault" style={{ flexGrow: bar.belowMyth }} />
      <div className="bg-stats" style={{ flexGrow: bar.wrongStats }} />
      <div style={{ flexGrow: bar.rest }} />
    </div>
  );
}
