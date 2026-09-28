/** What the SimC route reports after an import. */
export interface ImportCounts { changed?: boolean; equipped?: number; bags?: number; vault?: number }

export const importMessage = (data: ImportCounts | null): string =>
  data?.changed
    ? `Imported ${data.equipped} equipped, ${data.bags} bag and ${data.vault} Great Vault items.`
    : 'Nothing changed since your last paste.';
