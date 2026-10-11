/** The Characters link also covers a single character's page. */
export function isActiveLink(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/characters');
  return pathname === href || pathname.startsWith(`${href}/`);
}
