import type { ReactNode } from 'react';

// The corner of docs/brand/forged-wayfinder-v1/motifs/corner-frame.svg, drawn once and mirrored into each
// corner. Stretching the whole frame over the panel would distort the chamfers.
const CORNERS = ['-left-px -top-px', '-right-px -top-px -scale-x-100', '-bottom-px -left-px -scale-y-100', '-bottom-px -right-px -scale-100'];

export function CornerFrame({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={`relative ${className}`}>
      {CORNERS.map((position) => (
        <svg key={position} aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 50 50"
          className={`pointer-events-none absolute text-gold opacity-55 ${position}`}>
          <path d="M1 49V25L25 1h24" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ))}
      {children}
    </div>
  );
}
