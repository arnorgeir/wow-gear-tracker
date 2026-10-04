import { describe, expect, it } from 'vitest';
import { LEGACY_HINT, detailParts, trackDisplay, trackText } from './track-label';

describe('trackDisplay', () => {
  it('colors each current track by its name', () => {
    expect(trackDisplay('Adventurer 2/6', true)).toEqual({ text: 'Adventurer 2/6', className: 'text-track-adventurer', hint: undefined });
    expect(trackDisplay('Veteran 1/6', true).className).toBe('text-track-veteran');
    expect(trackDisplay('Champion 6/6', true).className).toBe('text-track-champion');
    expect(trackDisplay('Hero 3/6', true).className).toBe('text-track-hero');
    expect(trackDisplay('Myth 6/6', true).className).toBe('text-track-myth');
  });

  it('calls an item that matches no current track Legacy, but only when the tracks are known', () => {
    expect(trackDisplay(null, true)).toEqual({ text: 'Legacy', className: 'text-legacy italic', hint: LEGACY_HINT });
  });

  it('claims nothing about the season when the track data is unavailable', () => {
    expect(trackDisplay(null, false)).toEqual({ text: 'No track', className: 'text-muted', hint: undefined });
    expect(trackDisplay('Myth 6/6', false).className).toBe('text-track-myth');
  });

  it('leaves a track it does not know uncolored', () => {
    expect(trackDisplay('Explorer 1/8', true).className).toBe('text-muted');
  });
});

describe('trackText', () => {
  it('is the label, or Legacy / No track by whether the tracks are known', () => {
    expect(trackText('Hero 2/6', true)).toBe('Hero 2/6');
    expect(trackText(null, true)).toBe('Legacy');
    expect(trackText(null, false)).toBe('No track');
  });
});

describe('detailParts', () => {
  it('splits a leading track off the rest of an item card detail', () => {
    expect(detailParts('Myth 1/6 · 318')).toEqual({ lead: 'Myth 1/6', className: 'text-track-myth', rest: ' · 318' });
    expect(detailParts('Legacy · 289')).toEqual({ lead: 'Legacy', className: 'text-legacy italic', rest: ' · 289' });
  });

  it('colors nothing in a detail that does not start with a track', () => {
    expect(detailParts('Kings’ Rest')).toEqual({ lead: '', className: '', rest: 'Kings’ Rest' });
    expect(detailParts('No track · 289').lead).toBe('');
    expect(detailParts('Chest · tier via catalyst · weight 5').lead).toBe('');
  });
});
