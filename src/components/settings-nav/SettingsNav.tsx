'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActiveLink } from '@/components/shared/active-link';

/** Phones: a row of pills. From md up: a vertical rail. */
export function SettingsNav() {
  const active = isActiveLink('/settings/bis', usePathname());
  return (
    <nav aria-label="Settings sections" className="flex gap-2 md:flex-col md:gap-1">
      <Link href="/settings/bis" aria-current={active ? 'page' : undefined}
        className={`flex h-10 items-center gap-2 rounded-full border px-3.5 text-[15px] font-semibold no-underline md:h-11 md:gap-2.5 md:rounded-[10px] md:border-0 md:px-3.5 ${active ? 'border-gold-line bg-raised text-ink' : 'border-line text-muted'}`}>
        <span aria-hidden="true" className={`size-[7px] rotate-45 md:size-2 ${active ? 'bg-gold' : 'bg-transparent'}`} />
        BiS lists
      </Link>
      <span aria-disabled="true" className="flex h-10 items-center gap-1.5 rounded-full border border-line px-3.5 text-[15px] font-semibold text-dim md:h-11 md:justify-between md:rounded-[10px] md:border-0 md:pl-8 md:pr-3.5">
        General
        <span className="text-xs md:hidden">soon</span>
        <span className="hidden rounded-[10px] border border-line px-2 py-0.5 text-xs text-muted md:inline">Coming soon</span>
      </span>
    </nav>
  );
}
