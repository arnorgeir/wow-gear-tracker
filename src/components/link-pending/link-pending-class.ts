const RING = 'inline-block size-[0.8em] shrink-0 rounded-full border-2 border-current border-r-transparent animate-spin motion-reduce:animate-none transition-opacity';

/** The ring is always in the layout; only its opacity says whether the link's navigation is still blocked. */
export function linkPendingClass(pending: boolean): string {
  return `${RING} ${pending ? 'opacity-100 delay-100' : 'opacity-0 delay-0'}`;
}
