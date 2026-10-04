import { describe, expect, it } from 'vitest';
import { wowIconUrl } from './icons';

describe('wowIconUrl', () => {
  it('builds the medium icon URL on Wowhead’s image host', () => {
    expect(wowIconUrl('inv_121_crest_myth')).toBe('https://wow.zamimg.com/images/wow/icons/medium/inv_121_crest_myth.jpg');
  });
});
