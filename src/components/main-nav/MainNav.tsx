'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActiveLink } from './active-link';

const LINKS = [{ href: '/', label: 'Characters' }, { href: '/group', label: 'Group' }] as const;

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-2">
      {LINKS.map(({ href, label }) => {
        const active = isActiveLink(href, pathname);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}
            className={`rounded-lg px-4 py-2.5 text-[15px] font-semibold no-underline ${active ? 'bg-raised text-ink' : 'text-muted hover:text-ink'}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
