import { describe, expect, it } from 'vitest';
import { LEGACY_HINT, detailParts, trackDisplay } from './track-label';

describe('trackDisplay', () => {
  it('colors each current track by its name', () => {
    expect(trackDisplay('Adventurer 2/6')).toEqual({ text: 'Adventurer 2/6', className: 'text-track-adventurer', hint: undefined });
    expect(trackDisplay('Veteran 1/6').className).toBe('text-track-veteran');
    expect(trackDisplay('Champion 6/6').className).toBe('text-track-champion');
    expect(trackDisplay('Hero 3/6').className).toBe('text-track-hero');
    expect(trackDisplay('Myth 6/6').className).toBe('text-track-myth');
  });

  it('calls an item without a current-season track Legacy, in its own color, with a hint', () => {
    expect(trackDisplay(null)).toEqual({ text: 'Legacy', className: 'text-legacy italic', hint: LEGACY_HINT });
  });

  it('leaves a track it does not know uncolored', () => {
    expect(trackDisplay('Explorer 1/8').className).toBe('text-muted');
  });
});

describe('detailParts', () => {
  it('splits a leading track off the rest of an item card detail', () => {
    expect(detailParts('Myth 1/6 · 318')).toEqual({ lead: 'Myth 1/6', className: 'text-track-myth', rest: ' · 318' });
    expect(detailParts('Legacy · 289')).toEqual({ lead: 'Legacy', className: 'text-legacy italic', rest: ' · 289' });
  });

  it('colors nothing in a detail that does not start with a track', () => {
    expect(detailParts('Kings’ Rest')).toEqual({ lead: '', className: '', rest: 'Kings’ Rest' });
    expect(detailParts('Chest · tier via catalyst · weight 5').lead).toBe('');
  });
});
