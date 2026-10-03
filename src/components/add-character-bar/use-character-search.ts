'use client';

import { useEffect, useRef, useState } from 'react';
import type { Faction, Region } from '@/core/types';

export interface SearchResult {
  name: string;
  realmName: string;
  blizzardRealmId: number;
  className: string;
  faction: Faction | null;
  classIconUrl: string | null;
}
interface Realm { id: number; name: string; slug: string }

/**
 * The name search: a debounced lookup while typing, a result list that closes on an outside click or
 * Escape, and a fallback to picking the realm by hand when search is unavailable.
 */
export function useCharacterSearch(lockedRegion: Region | null = null) {
  const [chosenRegion, setRegion] = useState<Region>('eu');
  // A group locks the region to its members'; the user's own choice applies only when nothing locks it.
  const region = lockedRegion ?? chosenRegion;
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [manual, setManual] = useState(false);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close the result list on a click or tap outside the search field and its list, or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (manual || term.trim().length < 3) return;
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?region=${region}&term=${encodeURIComponent(term.trim())}`).catch(() => null);
      if (!res?.ok) { setManual(true); setSearchError('Search is unavailable. Pick the realm yourself.'); return; }
      setResults(await res.json());
    }, 300);
    return () => clearTimeout(timer);
  }, [term, region, manual]);

  useEffect(() => {
    if (!manual) return;
    fetch(`/api/realms?region=${region}`).then((r) => (r.ok ? r.json() : [])).then(setRealms).catch(() => setRealms([]));
  }, [manual, region]);

  const visibleResults = open && !manual && term.trim().length >= 3 ? results : [];

  /** Empties the field and the list after a character is added. */
  function clear() {
    setTerm('');
    setResults([]);
  }

  return { region, setRegion, term, setTerm, manual, setManual, realms, searchError, setOpen, searchRef, visibleResults, clear };
}
