export type GridColumn = { kind: 'member'; index: number } | { kind: 'pending'; key: string };

/**
 * The columns to draw while the group changes: one per requested member, in the requested order. A member the
 * server has rendered keeps its real column; one it hasn't gets a pending column; one no longer requested is gone.
 */
export function gridColumns(renderedKeys: string[], requestedKeys: string[]): GridColumn[] {
  return requestedKeys.map((key) => {
    const index = renderedKeys.indexOf(key);
    return index >= 0 ? { kind: 'member', index } : { kind: 'pending', key };
  });
}
