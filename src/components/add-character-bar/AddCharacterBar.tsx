'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiAction } from '@/components/hooks/use-api-action';
import { REGIONS, type Region } from '@/core/types';
import type { Faction } from '@/core/types';
import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { classColor } from '@/components/shared/class-colors';
import { FACTION_TEXT, FactionBadge } from '@/components/faction-badge/FactionBadge';

interface Result {
  name: string;
  realmName: string;
  blizzardRealmId: number;
  className: string;
  faction: Faction | null;
  classIconUrl: string | null;
}
interface Realm { id: number; name: string; slug: string }

const inputClass = 'h-12 rounded-xl border border-line-strong bg-surface-2 px-4 text-[17px] text-ink focus:border-gold focus:outline-none';
// Narrower padding and width: the region select only ever shows two letters.
const regionClass = `${inputClass.replace('px-4', 'px-3')} w-20`;
const labelClass = 'text-[13px] font-semibold uppercase tracking-wider text-muted';

export function AddCharacterBar() {
  const router = useRouter();
  const [region, setRegion] = useState<Region>('eu');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [manual, setManual] = useState(false);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [realmSlug, setRealmSlug] = useState('');
  const { busy, error, run } = useApiAction();
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

  async function add(body: Record<string, unknown>) {
    const result = await run<{ id?: number }>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, ...body }),
    }, { fallbackError: 'Couldn’t add that character.', after: 'none' });
    if (!result.ok || !result.data?.id) return;
    setTerm('');
    setResults([]);
    router.push(`/characters/${result.data.id}`);
  }

  return (
    <section aria-label="Add a character" className="relative flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="region" className={labelClass}>Region</label>
        <select id="region" value={region} onChange={(e) => setRegion(e.target.value as Region)} className={regionClass}>
          {REGIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
        </select>
      </div>

      <div ref={searchRef} className="relative flex min-w-64 grow flex-col gap-1.5">
        <label htmlFor="character-name" className={labelClass}>Character name</label>
        <input id="character-name" type="search" autoComplete="off" value={term} onChange={(e) => { setTerm(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder="Search by name" className={inputClass} />
        {visibleResults.length > 0 && (
          <ul role="listbox" aria-label="Matching characters"
            className="absolute top-full z-10 mt-2 flex w-full flex-col gap-0.5 rounded-xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl">
            {visibleResults.map((r) => (
              <li key={`${r.blizzardRealmId}-${r.name}`} role="option" aria-selected="false">
                <button type="button" disabled={busy} onClick={() => add({ name: r.name, realmId: r.blizzardRealmId })}
                  className="flex h-14 w-full items-center gap-3.5 rounded-lg px-3 text-left hover:bg-raised">
                  <span className="relative shrink-0">
                    {r.classIconUrl
                      ? <img src={r.classIconUrl} alt="" width={40} height={40} className="size-10 rounded-lg border-2" style={{ borderColor: classColor(r.className) }} />
                      : <CharacterAvatar name={r.name} className={r.className} avatarUrl={null} classIconUrl={null} size={40} />}
                    {r.faction && <span className="absolute -bottom-1.5 -right-1.5"><FactionBadge faction={r.faction} /></span>}
                  </span>
                  <span className="grow text-[17px]"><strong className="font-semibold">{r.name}</strong><span className="text-muted"> - {r.realmName}</span></span>
                  <span className="flex flex-col items-end">
                    <span className="text-sm font-semibold" style={{ color: classColor(r.className) }}>{r.className}</span>
                    {r.faction && <span className="text-xs font-semibold" style={{ color: FACTION_TEXT[r.faction].color }}>{FACTION_TEXT[r.faction].label}</span>}
                  </span>
                </button>
              </li>
            ))}
            <li className="border-t border-line px-3 pb-1 pt-2.5 text-sm text-muted">
              Not listed? <button type="button" className="text-gold underline" onClick={() => setManual(true)}>Pick the realm yourself</button>
            </li>
          </ul>
        )}
      </div>

      {manual && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="realm" className={labelClass}>Realm</label>
          <select id="realm" value={realmSlug} onChange={(e) => setRealmSlug(e.target.value)} className={`${inputClass} w-56`}>
            <option value="">Choose a realm</option>
            {realms.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
          </select>
        </div>
      )}

      {manual && (
        <button type="button" disabled={busy || !realmSlug || !term.trim()} onClick={() => add({ name: term.trim(), realmSlug })}
          className="h-12 rounded-xl border border-line-strong bg-raised px-5 font-semibold disabled:opacity-50">
          Add character
        </button>
      )}

      {/* Two paragraphs, not one with a precedence: the search hint explains the realm dropdown and has to
          stay readable while a failed add request is also on screen. */}
      {error && <p role="alert" className="w-full text-sm text-[#f3c9a2]">{error}</p>}
      {searchError && <p role="status" className="w-full text-sm text-[#f3c9a2]">{searchError}</p>}
    </section>
  );
}
