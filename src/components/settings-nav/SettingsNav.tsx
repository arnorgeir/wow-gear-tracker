'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActiveLink } from '@/components/shared/active-link';

const TAB = 'border-b-2 px-4 py-3 font-semibold no-underline';

export function SettingsNav() {
  const active = isActiveLink('/settings/bis', usePathname());
  return (
    <nav aria-label="Settings sections" className="flex border-b border-line">
      <Link href="/settings/bis" aria-current={active ? 'page' : undefined}
        className={`${TAB} -mb-px ${active ? 'border-gold text-ink' : 'border-transparent text-muted'}`}>
        BiS lists
      </Link>
      <span aria-disabled="true" className={`${TAB} -mb-px border-transparent text-muted`}>
        General <span className="text-sm">coming soon</span>
      </span>
    </nav>
  );
}
