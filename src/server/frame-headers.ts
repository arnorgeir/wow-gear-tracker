// A framed page runs with the app's origin, so its writes pass the request guard as same-origin.
// Refusing every frame stops that before any script runs, and stops clickjacking on write buttons.
export const FRAME_HEADERS = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
];
