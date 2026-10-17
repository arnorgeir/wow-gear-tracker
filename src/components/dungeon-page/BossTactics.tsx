import type { JournalBlock, JournalInline } from '@/core/journal/markup';
import type { AbilityView, BossTacticsView } from '@/server/views/types';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-gold';

function SpellLink({ id, children }: { id: number; children: React.ReactNode }) {
  return (
    <a href={`https://www.wowhead.com/spell=${id}`} data-wowhead={`spell=${id}`} target="_blank" rel="noreferrer" className={`text-gold hover:underline ${FOCUS}`}>
      {children}
    </a>
  );
}

function Parts({ parts }: { parts: JournalInline[] }) {
  return parts.map((p, i) => {
    if ('text' in p) return p.text;
    return p.spellId === null ? <strong key={i}>{p.spell}</strong> : <SpellLink key={i} id={p.spellId}>{p.spell}</SpellLink>;
  });
}

function Blocks({ blocks }: { blocks: JournalBlock[] }) {
  return blocks.map((b, i) => b.kind === 'list'
    ? <ul key={i} className="list-disc pl-5">{b.items.map((item, j) => <li key={j}><Parts parts={item} /></li>)}</ul>
    : <p key={i}><Parts parts={b.parts} /></p>);
}

/** An ability's name: the spell link when there is a spell, plain text for a group such as an add. */
function AbilityName({ a }: { a: AbilityView }) {
  return a.spellId === null ? a.name : <SpellLink id={a.spellId}>{a.name}</SpellLink>;
}

/** Top-level abilities sit in their own panels, like the role sections; nested ones are indented under them. */
function Abilities({ abilities, top = false }: { abilities: AbilityView[]; top?: boolean }) {
  return (
    <ul className={top ? 'flex flex-col gap-2' : 'flex flex-col gap-1.5 border-l border-line pl-3'}>
      {abilities.map((a, i) => (
        <li key={i} className={top ? 'rounded-xl border border-line-strong bg-raised px-3 py-2' : undefined}>
          {a.blocks.length > 0 || a.abilities.length > 0 ? (
            <details open>
              <summary className={`flex min-h-8 cursor-pointer items-center gap-1.5 font-semibold ${FOCUS}`}><AbilityName a={a} /></summary>
              <div className="flex flex-col gap-1.5 pb-1 pt-1.5">
                <Blocks blocks={a.blocks} />
                {a.abilities.length > 0 && <Abilities abilities={a.abilities} />}
              </div>
            </details>
          ) : (
            <span className="flex min-h-8 items-center font-semibold"><AbilityName a={a} /></span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A boss's journal text only ever reaches the page as text nodes. */
export function BossOverview({ tactics }: { tactics: BossTacticsView | null }) {
  if (!tactics) return <p className="text-muted">No journal entry for this boss yet.</p>;
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      {tactics.description && <p className="text-muted">{tactics.description}</p>}
      <Blocks blocks={tactics.overview} />
      {tactics.roles.map((r, i) => (
        <details key={i} open className="rounded-xl border border-line-strong bg-raised">
          <summary className={`min-h-11 cursor-pointer rounded-xl p-2.5 font-display font-bold ${FOCUS}`}>{r.title}</summary>
          <div className="flex flex-col gap-1 p-3 pt-1"><Blocks blocks={r.blocks} /></div>
        </details>
      ))}
    </div>
  );
}

export function BossAbilities({ tactics }: { tactics: BossTacticsView | null }) {
  if (!tactics || tactics.abilities.length === 0) return <p className="text-muted">No abilities in the journal for this boss yet.</p>;
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <p className="text-sm text-muted">Hover an ability for its full description.</p>
      <Abilities abilities={tactics.abilities} top />
    </div>
  );
}
