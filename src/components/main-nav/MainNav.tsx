'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { isActiveLink } from '@/components/shared/active-link';
import { TAB_DIAMOND, tabClass } from '@/components/shared/nav-tab';

const LINKS = [
  { href: '/', label: 'Characters', icon: 'characters' },
  { href: '/group', label: 'Group', icon: 'group' },
  { href: '/dungeons', label: 'Dungeons', icon: 'dungeons' },
] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex lg:gap-1">
      {LINKS.map(({ href, label, icon }) => {
        const active = isActiveLink(href, pathname);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
            <BrandIcon name={icon} />
            {label}
            {active && <span aria-hidden="true" className={TAB_DIAMOND} />}
          </Link>
        );
      })}
    </nav>
  );
}
