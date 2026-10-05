// Copied from docs/brand/forged-wayfinder-v1/icons/current-color/. Update both when the artwork changes.
const PATHS = {
  characters: 'M32 6 15 18 10 27v20l15 12V36l-9-5 12 5v24M32 6l17 12 5 9v20L39 59V36l9-5-12 5v24M32 6v24',
  group: 'M28 6h8l6 6v8l-6 6h-8l-6-6v-8ZM8 20h6l4 4v6l-4 4H8l-4-4v-6ZM50 20h6l4 4v6l-4 4h-6l-4-4v-6ZM19 58V44l9-8h8l9 8v14ZM14 58H3V46l9-7h5M50 58h11V46l-9-7h-5',
  dungeons: 'M7 53V26L17 15 32 6l15 9 10 11v27M17 15v30H7M47 15v30h10M32 6v14M20 49V32l5-9 7-3 7 3 5 9v17ZM17 56h30M12 62h40M7 53l-5 7M57 53l5 7',
  vault: 'M5 23v-8l7-7h40l7 7v8H39M25 23H5M5 30h20M39 30h20M9 30v25h7l4-5h24l4 5h7V30M32 17l10 10-10 13-10-13Z',
} as const;

export type BrandIconName = keyof typeof PATHS;

/** A Forged Wayfinder utility icon. Always decorative: it sits beside a visible label, which names it. */
export function BrandIcon({ name, size = 24, className }: { name: BrandIconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false"
      className={className ? `shrink-0 ${className}` : 'shrink-0'}
      fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinejoin="miter" strokeLinecap="butt">
      <path d={PATHS[name]} />
      {name === 'vault' && <path d="m32 23 4 5-4 6-4-6Z" fill="currentColor" stroke="none" />}
    </svg>
  );
}
