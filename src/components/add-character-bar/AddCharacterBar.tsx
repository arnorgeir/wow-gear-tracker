'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useApiAction } from '@/components/hooks/use-api-action';
import { LABEL_CLASS } from '@/components/shared/field-classes';
import { REGIONS, type Region } from '@/core/types';
import { SearchResults } from './SearchResults';
import { buildTrackedLookup, isTracked, type TrackedCharacter } from './tracked';
import { useCharacterSearch } from './use-character-search';

const inputClass = 'h-12 rounded-xl border border-line-strong bg-surface-2 px-4 text-[17px] text-ink focus:border-gold focus:outline-none';
// Narrow: the region select only ever shows two letters. Extra right padding keeps the chevron off the border.
const regionClass = `${inputClass.replace('px-4', 'pl-3 pr-5')} w-20`;

interface Props {
  trackedCharacters: TrackedCharacter[];
  /** Set by the group page: search only this region, and keep the select fixed on it. */
  lockedRegion?: Region | null;
  /** Set by the group page: what to do with the added character instead of opening its page. */
  onAdded?: (added: { id: number; key: string }) => void;
}

export function AddCharacterBar({ trackedCharacters, lockedRegion = null, onAdded }: Props) {
  const router = useRouter();
  const {
    region, setRegion, term, setTerm, manual, setManual, realms, searchError, setOpen, searchRef, results, showList, searching, clear,
  } = useCharacterSearch(lockedRegion);
  const [realmSlug, setRealmSlug] = useState('');
  const [addingName, setAddingName] = useState<string | null>(null);
  const { busy, error, run } = useApiAction();
  // router.push() alone leaves `busy` clearing before the destination page has actually
  // rendered; wrapping it in a transition keeps a pending state until that render lands too.
  const [navigating, startTransition] = useTransition();
  const pending = busy || navigating;
  const trackedLookup = useMemo(() => buildTrackedLookup(trackedCharacters), [trackedCharacters]);

  async function add(name: string, body: Record<string, unknown>) {
    setAddingName(name);
    const result = await run<{ id?: number; key?: string }>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, ...body }),
    }, { fallbackError: 'Couldn’t add that character.', after: 'none' });
    const id = result.ok ? result.data?.id : undefined;
    if (!id) { setAddingName(null); return; }
    clear();
    const key = result.data?.key;
    startTransition(() => (onAdded && key ? onAdded({ id, key }) : router.push(`/characters/${id}`)));
  }

  return (
    <section aria-label="Add a character" className="relative flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="region" className={LABEL_CLASS}>Region</label>
        <select id="region" value={region} disabled={lockedRegion !== null} onChange={(e) => setRegion(e.target.value as Region)} className={regionClass}>
          {REGIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
        </select>
      </div>

      <div ref={searchRef} className="relative flex min-w-64 grow flex-col gap-1.5">
        <label htmlFor="character-name" className={LABEL_CLASS}>Character name</label>
        <input id="character-name" type="search" autoComplete="off" value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder="Search by name" className={inputClass} />
        {/* Sits left of the search input's built-in × button, which padding would push inward. Stays mounted so
            screen readers announce the text when it appears; they skip a live region that arrives with its text. */}
        <span role="status" className="pointer-events-none absolute bottom-0 right-11 flex h-12 items-center gap-2 text-sm text-muted">
          {searching && (
            <>
              <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-line-strong border-t-gold" />
              Searching…
            </>
          )}
        </span>
        {showList && (
          <SearchResults results={results} term={term.trim()} busy={pending}
            isTracked={(r) => isTracked(trackedLookup, region, r)}
            onPick={(r) => add(r.name, { name: r.name, realmId: r.blizzardRealmId })} onManual={() => setManual(true)} />
        )}
      </div>

      {manual && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="realm" className={LABEL_CLASS}>Realm</label>
          <select id="realm" value={realmSlug} onChange={(e) => setRealmSlug(e.target.value)} className={`${inputClass} w-56`}>
            <option value="">Choose a realm</option>
            {realms.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
          </select>
        </div>
      )}

      {manual && (
        <button type="button" disabled={pending || !realmSlug || !term.trim()} onClick={() => add(term.trim(), { name: term.trim(), realmSlug })}
          className="h-12 rounded-xl border border-line-strong bg-raised px-5 font-semibold disabled:opacity-50">
          Add character
        </button>
      )}

      {/* Three paragraphs, not one with a precedence: the search hint explains the realm dropdown, a failed
          add request needs its own line, and the "Adding…" status has to keep showing through the
          navigation that follows a successful add, well after `busy` itself has cleared. */}
      {pending && addingName && <p role="status" className="w-full text-sm text-muted">Adding {addingName}…</p>}
      {error && <p role="alert" className="w-full text-sm text-[#f3c9a2]">{error}</p>}
      {searchError && <p role="status" className="w-full text-sm text-[#f3c9a2]">{searchError}</p>}
    </section>
  );
}
