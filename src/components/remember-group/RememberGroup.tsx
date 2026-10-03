'use client';

import { useEffect } from 'react';
import { encodeGroupCookie, GROUP_COOKIE } from '@/core/characters/member-key';

/** Remembers the group shown, so the nav link reopens it. An empty group is remembered as empty. */
export function RememberGroup({ keys }: { keys: string[] }) {
  const value = encodeGroupCookie(keys);
  useEffect(() => {
    document.cookie = `${GROUP_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
  }, [value]);
  return null;
}
