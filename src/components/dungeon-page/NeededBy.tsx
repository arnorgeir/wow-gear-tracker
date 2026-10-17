import { CharacterAvatar } from '@/components/character-avatar/CharacterAvatar';
import type { LootNeedView } from '@/server/views/types';
import { needWords } from './loot-view';

const SHOWN = 3;

function NeedLine({ need }: { need: LootNeedView }) {
  const words = needWords(need);
  return (
    <li className="flex min-w-0 items-center gap-2 text-sm">
      <CharacterAvatar name={need.name} className={need.className} avatarUrl={need.avatarUrl} classIconUrl={need.classIconUrl} size={20} />
      <span className="min-w-0 wrap-anywhere"><span className="font-semibold">{need.name}</span>{words && <span className="text-muted">, {words}</span>}</span>
    </li>
  );
}

/** The characters who need a drop, three in view and the rest behind a native disclosure. */
export function NeededBy({ needs }: { needs: LootNeedView[] }) {
  const rest = needs.slice(SHOWN);
  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-1">{needs.slice(0, SHOWN).map((n) => <NeedLine key={n.key} need={n} />)}</ul>
      {rest.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted focus-visible:outline-2 focus-visible:outline-gold">{`+${rest.length} more`}</summary>
          <ul className="mt-1 flex flex-col gap-1">{rest.map((n) => <NeedLine key={n.key} need={n} />)}</ul>
        </details>
      )}
    </div>
  );
}
