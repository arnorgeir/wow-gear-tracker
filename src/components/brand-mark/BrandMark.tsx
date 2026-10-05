// Copied from docs/brand/forged-wayfinder-v1/logos/open-crest-mono.svg. Update both when the artwork changes.
/** The flat Open Crest. Decorative: the site name beside it is the accessible name. */
export function BrandMark({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false" className={className} fill="currentColor">
      <path d="M128 12 202 154 181 176 149 143 128 82 107 143 75 176 54 154Z" />
      <path d="M89 42 42 103 40 163 91 216 27 180 22 145 17 135 23 128 23 93Z" />
      <path d="M167 42 214 103 216 163 165 216 229 180 234 145 239 135 233 128 233 93Z" />
      <path d="M128 112 136 140 129 146 131 154 158 170 154 184 125 200 151 219 128 244 100 202 139 176 120 157 123 145 120 140Z" />
    </svg>
  );
}
