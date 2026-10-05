'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { isActiveLink } from './active-link';

const LINKS = [{ href: '/', label: 'Characters', icon: 'characters' }, { href: '/group', label: 'Group', icon: 'group' }] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-2">
      {LINKS.map(({ href, label, icon }) => {
        const active = isActiveLink(href, pathname);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-semibold no-underline ${active ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>
            {/* Hidden on phones: with icons the header overflows a 375 px screen by 33 px. */}
            <BrandIcon name={icon} className="hidden sm:block" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
