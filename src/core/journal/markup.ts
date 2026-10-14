import type { JournalSection } from '../types';

export type JournalInline = { text: string } | { spell: string; spellId: number | null };
export type JournalBlock = { kind: 'paragraph'; parts: JournalInline[] } | { kind: 'list'; items: JournalInline[][] };

/** Each titled node's spell ID across the tree, the first ID winning. */
export function spellIndex(sections: JournalSection[]): Map<string, number> {
  const index = new Map<string, number>();
  const walk = (nodes: JournalSection[]) => {
    for (const n of nodes) {
      if (n.spellId !== null && !index.has(n.title)) index.set(n.title, n.spellId);
      walk(n.sections);
    }
  };
  walk(sections);
  return index;
}

function lookup(name: string, spells: ReadonlyMap<string, number>): number | null {
  const exact = spells.get(name);
  if (exact !== undefined) return exact;
  const lower = name.toLowerCase();
  const find = (want: string) => [...spells].find(([title]) => title.toLowerCase() === want)?.[1];
  // The journal writes "[Void Fissures]" for the "Void Fissure" node.
  return find(lower) ?? (lower.endsWith('s') ? find(lower.slice(0, -1)) : undefined) ?? null;
}

function inline(line: string, spells: ReadonlyMap<string, number>): JournalInline[] {
  const parts: JournalInline[] = [];
  // split with a capture group alternates text and spell names.
  line.replace(/\$[a-z]+;/gi, '').split(/\[([^\]]*)\]/).forEach((piece, i) => {
    if (i % 2 === 1) parts.push({ spell: piece, spellId: lookup(piece, spells) });
    else if (piece) parts.push({ text: piece });
  });
  return parts;
}

/** Turns the journal's markup into paragraphs, bullet lists and spell names. Never produces HTML. */
export function parseJournalText(text: string, spells: ReadonlyMap<string, number>): JournalBlock[] {
  const blocks: JournalBlock[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const bullet = raw.startsWith('$bullet;');
    const parts = inline(bullet ? raw.slice('$bullet;'.length) : raw, spells);
    if (parts.every((p) => 'text' in p && !p.text.trim())) continue;
    const last = blocks.at(-1);
    if (!bullet) blocks.push({ kind: 'paragraph', parts });
    else if (last?.kind === 'list') last.items.push(parts);
    else blocks.push({ kind: 'list', items: [parts] });
  }
  return blocks;
}
