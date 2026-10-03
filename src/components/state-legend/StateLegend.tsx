const LEGEND = [
  ['bg-gold', 'Done: Myth max'],
  ['bg-crest', 'Upgrade with crests'],
  ['bg-vault', 'Great Vault target'],
  ['bg-bags', 'BiS in bags'],
  ['bg-line', 'Missing'],
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
