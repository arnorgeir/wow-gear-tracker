'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { isActiveLink } from '@/components/shared/active-link';

/** Settings on a phone: an icon-only link in the brand row. Gold on a gold tint when it is the current page. */
export function SettingsGear() {
  const active = isActiveLink('/settings', usePathname());
  return (
    <Link href="/settings" aria-label="Settings" aria-current={active ? 'page' : undefined}
      className={`-mr-3 flex size-11 items-center justify-center rounded-[10px] no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold lg:hidden ${active ? 'bg-gold-soft text-gold' : 'text-muted hover:text-ink'}`}>
      <BrandIcon name="settings" />
    </Link>
  );
}
