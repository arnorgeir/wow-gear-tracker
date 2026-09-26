'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ImportResponse { error?: string; changed?: boolean; equipped?: number; bags?: number; vault?: number }

export function SimcPaste({ id }: { id: number }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/characters/${id}/simc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => ({}))) as ImportResponse;
      if (!res.ok) {
        setMessage({ kind: 'error', text: data.error ?? 'Couldn’t import that SimC text.' });
        return;
      }
      setText('');
      setMessage({
        kind: 'ok',
        text: data.changed
          ? `Imported ${data.equipped} equipped, ${data.bags} bag and ${data.vault} Great Vault items.`
          : 'Nothing changed since your last paste.',
      });
      router.refresh();
    } catch {
      setMessage({ kind: 'error', text: 'Couldn’t reach the app server.' });
    } finally {
      setBusy(false);
    }
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
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-[#f3c9a2]' : 'text-upgrade'}`}>
              {message.text}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
