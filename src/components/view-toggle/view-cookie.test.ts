import { describe, expect, it } from 'vitest';
import { viewCookie } from './view-cookie';

describe('viewCookie', () => {
  it('names the cookie and keeps it for a year', () => {
    expect(viewCookie('dungeon-loot-view', 'list')).toBe('dungeon-loot-view=list; path=/; max-age=31536000; SameSite=Lax');
  });
});
