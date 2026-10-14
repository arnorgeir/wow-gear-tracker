'use client';

import { useApiAction } from '@/components/hooks/use-api-action';
import { LABEL_CLASS } from '@/components/shared/field-classes';

interface Props {
  id: number;
  specs: string[];
  spec: string;
  activeSpec: string;
}

export function CharacterSettings({ id, specs, spec, activeSpec }: Props) {
  const { busy, error, run } = useApiAction();
  const patch = (body: Record<string, unknown>) =>
    run(`/api/characters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, { after: 'refresh-always' });
  return (
    <div className="flex flex-wrap items-end gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="spec" className={LABEL_CLASS}>Compare as</label>
        <select id="spec" value={spec} disabled={busy} onChange={(e) => patch({ specOverride: e.target.value === activeSpec ? null : e.target.value })}
          className="h-11 rounded-xl border border-line-strong bg-surface-2 px-3 text-ink">
          {specs.map((s) => <option key={s} value={s}>{s}{s === activeSpec ? ' (active)' : ''}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-[#f3c9a2]">{error}</p>}
    </div>
  );
}
