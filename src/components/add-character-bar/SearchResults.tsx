import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import { FACTION_TEXT, FactionBadge } from '@/components/faction-badge/FactionBadge';
import { classColor } from '@/components/shared/class-colors';
import type { SearchResult } from './use-character-search';

interface Props {
  results: SearchResult[];
  busy: boolean;
  isTracked: (result: SearchResult) => boolean;
  onPick: (result: SearchResult) => void;
  onManual: () => void;
}

export function SearchResults({ results, busy, isTracked, onPick, onManual }: Props) {
  return (
    <ul role="listbox" aria-label="Matching characters"
      className="absolute top-full z-10 mt-2 flex w-full flex-col gap-0.5 rounded-xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl">
      {results.map((r) => (
        <li key={`${r.blizzardRealmId}-${r.name}`} role="option" aria-selected="false">
          <button type="button" disabled={busy} onClick={() => onPick(r)}
            className="flex h-14 w-full items-center gap-3.5 rounded-lg px-3 text-left hover:bg-raised">
            <span className="relative shrink-0">
              {r.classIconUrl
                ? <img src={r.classIconUrl} alt="" width={40} height={40} className="size-10 rounded-lg border-2" style={{ borderColor: classColor(r.className) }} />
                : <CharacterAvatar name={r.name} className={r.className} avatarUrl={null} classIconUrl={null} size={40} />}
              {r.faction && <span className="absolute -bottom-1.5 -right-1.5"><FactionBadge faction={r.faction} /></span>}
            </span>
            <span className="grow text-[17px]">
              <strong className="font-semibold">{r.name}</strong><span className="text-muted"> - {r.realmName}</span>
              {isTracked(r) && <span className="ml-2 text-xs font-semibold text-muted">Added</span>}
            </span>
            <span className="flex flex-col items-end">
              <span className="text-sm font-semibold" style={{ color: classColor(r.className) }}>{r.className}</span>
              {r.faction && <span className="text-xs font-semibold" style={{ color: FACTION_TEXT[r.faction].color }}>{FACTION_TEXT[r.faction].label}</span>}
            </span>
          </button>
        </li>
      ))}
      <li className="border-t border-line px-3 pb-1 pt-2.5 text-sm text-muted">
        Not listed? <button type="button" className="text-gold underline" onClick={onManual}>Pick the realm yourself</button>
      </li>
    </ul>
  );
}
