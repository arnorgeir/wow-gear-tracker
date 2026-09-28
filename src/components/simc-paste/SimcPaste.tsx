'use client';

import { useState } from 'react';
import { useApiAction } from '@/components/hooks/use-api-action';

interface ImportResponse { changed?: boolean; equipped?: number; bags?: number; vault?: number }

export function SimcPaste({ id }: { id: number }) {
  const { busy, error, run } = useApiAction();
  const [text, setText] = useState('');
  const [imported, setImported] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setImported(null);
    const result = await run<ImportResponse>(`/api/characters/${id}/simc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }, { fallbackError: 'Couldn’t import that SimC text.' });
    if (!result.ok) return;
    setText('');
    setImported(result.data?.changed
      ? `Imported ${result.data.equipped} equipped, ${result.data.bags} bag and ${result.data.vault} Great Vault items.`
      : 'Nothing changed since your last paste.');
  }

  return (
    <details className="rounded-2xl border border-line bg-surface p-5">
      <summary className="cursor-pointer font-semibold">Update from SimC</summary>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <p className="text-sm text-muted">
          In game, type <code className="font-mono text-ink">/simc</code>, copy all the text, and paste it here. It updates your gear, bags,
          Great Vault and crests right away, with no logout needed.
        </p>
        <label htmlFor="simc-text" className="sr-only">SimC export</label>
        <textarea
          id="simc-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={'druid="Name"\nregion=eu\n...'}
          className="rounded-xl border border-line-strong bg-surface-2 p-3 font-mono text-sm text-ink focus:border-gold focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy || !text.trim()} className="h-11 rounded-xl bg-gold px-5 font-bold text-[#1a1408] disabled:opacity-50">
            {busy ? 'Importing…' : 'Import'}
          </button>
          {error && <p role="alert" className="text-sm text-[#f3c9a2]">{error}</p>}
          {imported && <p role="status" className="text-sm text-upgrade">{imported}</p>}
        </div>
      </form>
    </details>
  );
}
