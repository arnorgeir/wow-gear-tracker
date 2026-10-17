/** A dungeon priority weight in gold, set like a dungeon's score so the two read as one scale. */
export function Weight({ weight }: { weight: number }) {
  return <span className="shrink-0 font-mono text-gold" title="Weight"><span className="sr-only">Weight </span>{weight}</span>;
}
