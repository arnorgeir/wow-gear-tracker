'use client';

import { useLinkStatus } from 'next/link';
import { linkPendingClass } from './link-pending-class';

/** Goes inside a Link. Shows only while that link's navigation waits on a route Next hasn't prefetched. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={linkPendingClass(pending)} />;
}
