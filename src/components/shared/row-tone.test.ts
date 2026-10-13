import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEM_STATES } from '@/core/types';
import { ROW_TONE_STYLES, rowTone } from './row-tone';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
const styleText = Object.values(ROW_TONE_STYLES).flatMap((style) => Object.values(style).map(String)).join(' ');

describe('rowTone', () => {
  it('tones every state where the BiS item is equipped', () => {
    expect(rowTone('done', true)).toBe('gold');
    expect(rowTone('mythUpgradable', true)).toBe('crest');
    expect(rowTone('wrongStats', true)).toBe('stats');
    expect(rowTone('belowMyth', true)).toBe('vault');
  });

  it('leaves states without the BiS item equipped plain', () => {
    expect(rowTone('inBags', true)).toBeNull();
    expect(rowTone('missing', true)).toBeNull();
  });

  it('shows no tone for any state while track data is unavailable', () => {
    for (const state of ITEM_STATES) expect(rowTone(state, false)).toBeNull();
  });
});

describe('ROW_TONE_STYLES', () => {
  it('uses only theme tokens', () => {
    expect(styleText).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('declares every token it uses in globals.css', () => {
    const names = [...styleText.matchAll(/var\((--color-[\w-]+)\)/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(css).toContain(`${name}:`);
  });

  it('draws every border inside the element', () => {
    for (const style of Object.values(ROW_TONE_STYLES)) {
      expect(style.boxShadow).toBeUndefined();
      expect(style.outlineOffset).toBe('-2px');
    }
  });

  it("gives wrong stats done's gold, since only the stats are off", () => {
    expect(ROW_TONE_STYLES.stats.background).toBe(ROW_TONE_STYLES.gold.background);
    expect(ROW_TONE_STYLES.stats.outline).toBe('2px dashed var(--color-gold)');
  });

  it('dashes only the wrong-stats border', () => {
    expect(ROW_TONE_STYLES.stats.outline).toContain('dashed');
    for (const tone of ['gold', 'crest', 'vault'] as const) expect(ROW_TONE_STYLES[tone].outline).toContain('solid');
  });
});
