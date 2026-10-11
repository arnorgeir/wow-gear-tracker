/** An item ID from a bare number or a Wowhead item link, or null. */
export function parseItemInput(input: string): number | null {
  const text = input.trim();
  const match = /^(\d+)$/.exec(text) ?? /wowhead\.com\/(?:[a-z-]+\/)?item=(\d+)/i.exec(text);
  const id = match ? Number(match[1]) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}
