/**
 * A spinner and "Searching…" inside a status region that stays mounted, so screen readers announce the text when it
 * appears; they skip a live region that arrives with its text. The caller places it with `className`.
 */
export function SearchingStatus({ searching, className }: { searching: boolean; className: string }) {
  return (
    <span role="status" className={className}>
      {searching && (
        <>
          <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-line-strong border-t-gold" />
          Searching…
        </>
      )}
    </span>
  );
}
