import { AddCharacterBar } from '@/components/add-character-bar/AddCharacterBar';
import { CharacterCard } from '@/components/character-card/CharacterCard';
import { SetupNotice } from '@/components/setup-notice/SetupNotice';
import { StaleSync } from '@/components/stale-sync/StaleSync';
import { StateLegend } from '@/components/state-legend/StateLegend';
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
  const cards = await getCharacterCards(services);
  const now = services.now();
  const staleIds = cards.filter((c) => c.status === 'ok' && isStale(c.lastSyncedAt, now)).map((c) => c.id);

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-12 sm:px-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl font-bold tracking-wide">Characters</h1>
        <p className="text-[17px] text-muted">BiS progress against Method&rsquo;s lists</p>
      </div>
      <AddCharacterBar trackedCharacters={cards.map((c) => ({ region: c.region, realmId: c.realmId, name: c.name }))} />
      <StateLegend />
      {cards.length === 0 ? (
        <p className="text-muted">No characters yet. Search for one above.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => <CharacterCard key={card.id} card={card} now={now} />)}
        </div>
      )}
      <StaleSync ids={staleIds} />
    </main>
  );
}
