import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import { FRAME_HEADERS } from './frame-headers';

describe('frame headers', () => {
  it('forbid every other site from framing the app', () => {
    expect(FRAME_HEADERS).toEqual([
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      { key: 'X-Frame-Options', value: 'DENY' },
    ]);
  });

  it('apply to every path', async () => {
    expect(await nextConfig.headers!()).toEqual([{ source: '/:path*', headers: FRAME_HEADERS }]);
  });
});
