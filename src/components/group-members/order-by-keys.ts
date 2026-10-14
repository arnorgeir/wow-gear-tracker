/** Members in `order`'s order, then any not in it (a removal still loading) in their own order. */
export function orderByKeys<T extends { key: string }>(members: readonly T[], order: readonly string[]): T[] {
  const byKey = new Map(members.map((m) => [m.key, m]));
  const ordered = order.flatMap((k) => byKey.get(k) ?? []);
  return [...ordered, ...members.filter((m) => !order.includes(m.key))];
}
