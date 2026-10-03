import { decodeGroupCookie, formatMemberKey, groupHref, parseMemberKeys, type MemberKey } from '@/core/characters/member-key';

export type GroupRequest = { redirect: string } | { keys: MemberKey[] };

/**
 * `/group` with no `chars` reopens the remembered group. `chars` present, even empty, is taken as it is:
 * removing the last member lands on `?chars=`, and that must not bounce back to the old group.
 */
export function resolveGroupRequest(chars: string | string[] | undefined, cookie: string | undefined): GroupRequest {
  if (chars === undefined) {
    const saved = decodeGroupCookie(cookie);
    return saved.length > 0 ? { redirect: groupHref(saved.map(formatMemberKey)) } : { keys: [] };
  }
  return { keys: parseMemberKeys(Array.isArray(chars) ? chars.join(',') : chars) };
}
