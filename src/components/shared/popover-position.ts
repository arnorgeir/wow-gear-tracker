export interface Box { left: number; top: number; right: number; bottom: number }
export interface Size { width: number; height: number }

const MARGIN = 8;

/** Below the cell, or above it when there is no room below, always inside the viewport. */
export function placeBeside(cell: Box, card: Size, viewport: Size): { top: number; left: number } {
  const below = cell.bottom + MARGIN;
  const above = cell.top - MARGIN - card.height;
  const top = below + card.height <= viewport.height - MARGIN ? below : above;
  const left = Math.min(cell.left, viewport.width - MARGIN - card.width);
  return { top: Math.max(MARGIN, top), left: Math.max(MARGIN, left) };
}

/** Inline coordinates for the card: beside the cell on a wide screen, none on a phone, where the bottom-sheet classes apply. */
export function cardCoords(wide: boolean, cell: Box, card: Size, viewport: Size): { top: string; left: string } {
  if (!wide) return { top: '', left: '' };
  const { top, left } = placeBeside(cell, card, viewport);
  return { top: `${top}px`, left: `${left}px` };
}
