export const GEAR_COLUMNS = 'md:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px]';

export function GearTableHeader() {
  return (
    <div className="hidden grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_190px] gap-3 border-b border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-muted md:grid">
      <span>Slot</span><span>Equipped</span><span>BiS</span><span>State</span>
    </div>
  );
}
