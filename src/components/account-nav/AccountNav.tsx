'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { isActiveLink } from '@/components/shared/active-link';
import { TAB_DIAMOND, tabClass } from '@/components/shared/nav-tab';

/** The far end of the header on desktop, where login buttons will join Settings. Phones get the gear in the brand row instead. */
export function AccountNav() {
  const active = isActiveLink('/settings', usePathname());
  return (
    <nav aria-label="Account" className="ml-auto hidden items-stretch gap-4 lg:flex">
      <span aria-hidden="true" className="h-7 w-px self-center bg-line" />
      <Link href="/settings" aria-current={active ? 'page' : undefined} className={tabClass(active)}>
        <BrandIcon name="settings" />
        Settings
        {active && <span aria-hidden="true" className={TAB_DIAMOND} />}
      </Link>
    </nav>
  );
}
