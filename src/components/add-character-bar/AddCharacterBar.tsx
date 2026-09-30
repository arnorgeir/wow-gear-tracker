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
// Narrower padding and width: the region select only ever shows two letters.
const regionClass = `${inputClass.replace('px-4', 'px-3')} w-20`;

interface Props {
  trackedCharacters: TrackedCharacter[];
}

export function AddCharacterBar({ trackedCharacters }: Props) {
  const router = useRouter();
  const {
    region, setRegion, term, setTerm, manual, setManual, realms, searchError, setOpen, searchRef, visibleResults, clear,
  } = useCharacterSearch();
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
    const result = await run<{ id?: number }>('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, ...body }),
    }, { fallbackError: 'Couldn’t add that character.', after: 'none' });
    const id = result.ok ? result.data?.id : undefined;
    if (!id) { setAddingName(null); return; }
    clear();
    startTransition(() => router.push(`/characters/${id}`));
  }

  return (
    <section aria-label="Add a character" className="relative flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="region" className={LABEL_CLASS}>Region</label>
        <select id="region" value={region} onChange={(e) => setRegion(e.target.value as Region)} className={regionClass}>
          {REGIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
        </select>
      </div>

      <div ref={searchRef} className="relative flex min-w-64 grow flex-col gap-1.5">
        <label htmlFor="character-name" className={LABEL_CLASS}>Character name</label>
        <input id="character-name" type="search" autoComplete="off" value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder="Search by name" className={inputClass} />
        {visibleResults.length > 0 && (
          <SearchResults results={visibleResults} busy={pending}
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
