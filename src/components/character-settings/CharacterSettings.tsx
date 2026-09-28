'use client';

import { useApiAction } from '@/components/hooks/use-api-action';
import { LABEL_CLASS } from '@/components/shared/field-classes';

interface Props {
  id: number;
  specs: string[];
  spec: string;
  activeSpec: string;
  priorityList: 'mythicPlus' | 'overall';
}

export function CharacterSettings({ id, specs, spec, activeSpec, priorityList }: Props) {
  const { run } = useApiAction();
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
        <select id="spec" value={spec} onChange={(e) => patch({ specOverride: e.target.value === activeSpec ? null : e.target.value })}
          className="h-11 rounded-xl border border-line-strong bg-surface-2 px-3 text-ink">
          {specs.map((s) => <option key={s} value={s}>{s}{s === activeSpec ? ' (active)' : ''}</option>)}
        </select>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className={`mb-1.5 ${LABEL_CLASS}`}>Dungeon priority uses</legend>
        <div className="flex gap-4">
          {(['mythicPlus', 'overall'] as const).map((value) => (
            <label key={value} className="flex h-11 items-center gap-2 font-semibold">
              <input type="radio" name="priority-list" checked={priorityList === value} onChange={() => patch({ priorityList: value })}
                className="size-[18px] accent-[var(--color-gold)]" />
              {value === 'mythicPlus' ? 'Mythic+ list' : 'Overall list'}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
