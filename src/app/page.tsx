import { AddCharacterBar } from '@/components/AddCharacterBar';
import { CharacterCard } from '@/components/CharacterCard';
import { SetupNotice } from '@/components/SetupNotice';
import { StaleSync } from '@/components/StaleSync';
import { MissingConfigError } from '@/core/config';
import { isStale } from '@/core/sync/character-sync';
import { getServices, type Services } from '@/server/services';
import { getCharacterCards } from '@/server/views';

export const dynamic = 'force-dynamic';

const LEGEND = [
  ['bg-gold', 'Done: Myth max'],
  ['bg-crest', 'Upgrade with crests'],
  ['bg-vault', 'Great Vault target'],
  ['bg-line', 'Missing'],
] as const;

export default async function CharactersPage() {
  let services: Services;
  try {
    services = await getServices();
  } catch (err) {
    if (err instanceof MissingConfigError) return <SetupNotice missing={err.missing} />;
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
      <AddCharacterBar />
      <div className="flex flex-wrap gap-6 text-sm text-muted" aria-label="Legend">
        {LEGEND.map(([swatch, label]) => (
          <span key={label} className="flex items-center gap-2"><span className={`size-3 rounded-sm ${swatch}`} />{label}</span>
        ))}
      </div>
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
