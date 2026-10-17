import { SpecIcon } from '@/components/spec-icon/SpecIcon';
import type { LootBisView } from '@/server/views/types';

const ICONS = 6;

/** Up to six spec icons with their names as text for screen readers, then a disclosure that writes every spec out. */
export function BisFor({ specs }: { specs: LootBisView[] }) {
  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-wrap gap-1">
        {specs.slice(0, ICONS).map((s) => (
          <li key={s.slug}><SpecIcon url={s.iconUrl} className={s.className} size={20} corner={5} /><span className="sr-only">{s.label}</span></li>
        ))}
      </ul>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted focus-visible:outline-2 focus-visible:outline-gold">{`BiS for ${specs.length} ${specs.length === 1 ? 'spec' : 'specs'}`}</summary>
        <p className="mt-1 wrap-anywhere">{specs.map((s) => s.label).join(', ')}</p>
      </details>
    </div>
  );
}
