import { cookies } from 'next/headers';
import { BackgroundSync } from '@/components/background-sync/BackgroundSync';
import { AddCharacterBar } from '@/components/add-character-bar/AddCharacterBar';
import { CharacterCard } from '@/components/character-card/CharacterCard';
import { CharacterRow } from '@/components/character-row/CharacterRow';
import { CharacterGrid } from '@/components/character-grid/CharacterGrid';
import { PendingCharacterProvider } from '@/components/pending-character/PendingCharacterProvider';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { StaleSync } from '@/components/stale-sync/StaleSync';
import { StateLegend } from '@/components/state-legend/StateLegend';
import { CharacterSort } from '@/components/character-sort/CharacterSort';
import { CHARACTERS_SORT_COOKIE, parseCharactersSort } from '@/components/character-sort/characters-sort';
import { sortCards } from '@/components/character-sort/sort-cards';
import { CHARACTERS_VIEW_COOKIE, parseCharactersView } from '@/components/view-toggle/characters-view';
import { ViewToggle } from '@/components/view-toggle/ViewToggle';
import { isMissingConfigError } from '@/core/config';
import { isStale } from '@/core/sync/character-sync';
import { getServices, type Services } from '@/server/services';
import { getCharacterCards } from '@/server/views/character-cards';

export const dynamic = 'force-dynamic';

export default async function CharactersPage() {
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (isMissingConfigError(err)) return <SetupNotice missing={err.missing} />;
    throw err;
  }
  const { cards, referenceDue } = await getCharacterCards(services);
  const now = services.now();
  const jar = await cookies();
  const view = parseCharactersView(jar.get(CHARACTERS_VIEW_COOKIE)?.value);
  const sort = parseCharactersSort(jar.get(CHARACTERS_SORT_COOKIE)?.value);
  const sorted = sortCards(cards, sort);
  const staleIds = cards.filter((c) => c.status === 'ok' && isStale(c.lastSyncedAt, now)).map((c) => c.id);

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-12 sm:px-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl font-bold tracking-wide">Characters</h1>
        <p className="text-[17px] text-muted">BiS progress against your BiS lists</p>
      </div>
      <PendingCharacterProvider>
        <AddCharacterBar trackedCharacters={cards.map((c) => ({ region: c.region, realmId: c.realmId, name: c.name }))} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <StateLegend />
          {cards.length > 0 && (
            <div className="flex flex-wrap items-center gap-4">
              {cards.length > 1 && <CharacterSort sort={sort} />}
              <ViewToggle view={view} cookie={CHARACTERS_VIEW_COOKIE} name={CHARACTERS_VIEW_COOKIE} />
            </div>
          )}
        </div>
        <CharacterGrid count={cards.length} view={view} empty={<p className="text-muted">No characters yet. Search for one above.</p>}>
          {sorted.map((card) => view === 'list'
            ? <CharacterRow key={card.id} card={card} now={now} />
            : <CharacterCard key={card.id} card={card} now={now} />)}
        </CharacterGrid>
      </PendingCharacterProvider>
      <StaleSync ids={staleIds} />
      <BackgroundSync url="/api/reference/sync" due={referenceDue} />
    </main>
  );
}
