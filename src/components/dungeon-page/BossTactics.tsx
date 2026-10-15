import type { JournalBlock, JournalInline } from '@/core/journal/markup';
import type { AbilityView, BossTacticsView } from '@/server/views/types';

function SpellLink({ id, children }: { id: number; children: React.ReactNode }) {
  return (
    <a href={`https://www.wowhead.com/spell=${id}`} data-wowhead={`spell=${id}`} target="_blank" rel="noreferrer" className="text-gold hover:underline">
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

function Abilities({ abilities }: { abilities: AbilityView[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {abilities.map((a, i) => (
        <li key={i} className="flex flex-col gap-1">
          <span className="font-bold">{a.spellId === null ? a.name : <SpellLink id={a.spellId}>{a.name}</SpellLink>}</span>
          <Blocks blocks={a.blocks} />
          {a.abilities.length > 0 && <div className="pl-4"><Abilities abilities={a.abilities} /></div>}
        </li>
      ))}
    </ul>
  );
}

/** A boss's journal text in a closed disclosure. Journal text only ever reaches the page as text nodes. */
export function BossTactics({ tactics }: { tactics: BossTacticsView }) {
  return (
    <details className="rounded-xl border border-line-strong bg-raised">
      <summary className="min-h-11 cursor-pointer rounded-xl p-2.5 font-bold focus-visible:outline-2 focus-visible:outline-gold">Tactics</summary>
      <div className="flex flex-col gap-3 p-3 pt-1 text-sm">
        {tactics.description && <p className="text-muted">{tactics.description}</p>}
        <Blocks blocks={tactics.overview} />
        {tactics.roles.map((r, i) => (
          <div key={i} className="flex flex-col gap-1">
            <h3 className="font-display font-bold">{r.title}</h3>
            <Blocks blocks={r.blocks} />
          </div>
        ))}
        {tactics.abilities.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="font-display font-bold">Abilities</h3>
            <Abilities abilities={tactics.abilities} />
          </div>
        )}
      </div>
    </details>
  );
}
