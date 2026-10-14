/** True when both lists hold the same keys, in any order. */
export const sameMembers = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((k) => b.includes(k));
