import { describe, expect, it } from 'vitest';
import { NO_TRACK_HINT, detailParts, trackDisplay, trackText } from './track-label';

describe('trackDisplay', () => {
  it('colors each current track by its name', () => {
    expect(trackDisplay('Adventurer 2/6', true)).toEqual({ text: 'Adventurer 2/6', className: 'text-track-adventurer', hint: undefined });
    expect(trackDisplay('Veteran 1/6', true).className).toBe('text-track-veteran');
    expect(trackDisplay('Champion 6/6', true).className).toBe('text-track-champion');
    expect(trackDisplay('Hero 3/6', true).className).toBe('text-track-hero');
    expect(trackDisplay('Myth 6/6', true).className).toBe('text-track-myth');
  });

  it('says No track for an item that matches no track, whether or not the track data loaded, and never names a season', () => {
    for (const known of [true, false]) {
      const display = trackDisplay(null, known);
      expect(display.text).toBe('No track');
      expect(display.text).not.toMatch(/legacy|last season|earlier/i);
    }
  });

  it('only highlights it, with a hedged hint, while the track data is loaded', () => {
    expect(trackDisplay(null, true)).toEqual({ text: 'No track', className: 'text-legacy italic', hint: NO_TRACK_HINT });
    expect(NO_TRACK_HINT).toMatch(/often/i);
    expect(trackDisplay(null, false)).toEqual({ text: 'No track', className: 'text-muted', hint: undefined });
  });

  it('leaves a track it does not know uncolored', () => {
    expect(trackDisplay('Explorer 1/8', true).className).toBe('text-muted');
  });
});

describe('trackText', () => {
  it('is the label, or No track', () => {
    expect(trackText('Hero 2/6')).toBe('Hero 2/6');
    expect(trackText(null)).toBe('No track');
  });
});

describe('detailParts', () => {
  it('splits a leading track off the rest of an item card detail', () => {
    expect(detailParts('Myth 1/6 · 318')).toEqual({ lead: 'Myth 1/6', className: 'text-track-myth', rest: ' · 318' });
  });

  it('colors nothing in a detail that does not start with a track', () => {
    expect(detailParts('Kings’ Rest')).toEqual({ lead: '', className: '', rest: 'Kings’ Rest' });
    expect(detailParts('No track · 289').lead).toBe('');
    expect(detailParts('Chest · tier via catalyst · weight 5').lead).toBe('');
  });
});
