const LEGEND = [
  ['bg-gold', 'Done: Myth max'],
  ['bg-crest', 'Upgrade with crests'],
  ['bg-vault', 'Great Vault target'],
  // After vault, matching the character card bar's segment order: the bar has no words, so order maps it here.
  ['bg-stats', 'Wrong stats'],
  ['bg-bags', 'BiS in bags'],
  ['bg-missing', 'Missing'],
] as const;

export function StateLegend() {
  return (
    <div className="flex flex-wrap gap-6 text-sm text-muted" aria-label="Legend">
      {LEGEND.map(([swatch, label]) => (
        <span key={label} className="flex items-center gap-2"><span className={`size-3 rounded-sm ${swatch}`} />{label}</span>
      ))}
    </div>
  );
}
