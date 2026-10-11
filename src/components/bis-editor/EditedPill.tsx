/** Marks a pick the account changed. Words, not just the gold edge. */
export function EditedPill() {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-[10px] border border-gold px-[7px] text-xs font-bold text-gold">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
      Edited
    </span>
  );
}
