import Link from 'next/link';

export interface SwitchOption { label: string; href: string; current: boolean }

const OPTION = 'flex h-9 items-center rounded-[9px] px-3 text-[15px] font-semibold no-underline focus-visible:outline-2 focus-visible:outline-gold';

/** A two-option switch made of links, styled like the layout toggle. The picked option carries aria-current and a gold ring, not color alone. */
export function LootSwitch({ label, options }: { label: string; options: SwitchOption[] }) {
  return (
    <nav aria-label={label} className="inline-flex gap-1 rounded-xl border border-line bg-bg p-1">
      {options.map((o) => (
        <Link key={o.label} href={o.href} aria-current={o.current ? 'page' : undefined}
          className={`${OPTION} ${o.current ? 'bg-gold-soft text-gold ring-1 ring-gold-line' : 'text-muted hover:text-ink'}`}>{o.label}</Link>
      ))}
    </nav>
  );
}
