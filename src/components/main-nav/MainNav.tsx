'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { isActiveLink } from './active-link';

const LINKS = [{ href: '/', label: 'Characters', icon: 'characters' }, { href: '/group', label: 'Group', icon: 'group' }] as const;

// Phones: equal tabs in their own row, icon above label. From sm up: tabs beside the brand, standing on the header line.
const TAB = 'relative flex flex-1 flex-col items-center gap-1 pb-2.5 pt-2 text-[13px] font-semibold no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold sm:flex-none sm:flex-row sm:gap-2 sm:px-4 sm:py-0 sm:text-[15px]';

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex sm:gap-1">
      {LINKS.map(({ href, label, icon }) => {
        const active = isActiveLink(href, pathname);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={`${TAB} ${active ? 'text-gold shadow-[inset_0_-2px_0_var(--color-gold)]' : 'text-muted hover:text-ink'}`}>
            <BrandIcon name={icon} />
            {label}
            {/* The diamond sits on the header line under the current tab. Phone tabs have no room beside the underline. */}
            {active && <span aria-hidden="true" className="absolute bottom-[-0.5px] left-1/2 hidden size-[11px] -translate-x-1/2 translate-y-1/2 rotate-45 bg-gold sm:block" />}
          </Link>
        );
      })}
    </nav>
  );
}
