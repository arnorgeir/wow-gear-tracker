import type { UpgradeOption } from '@/core/gear/crests';

export function UpgradeBadge({ upgrade }: { upgrade: UpgradeOption }) {
  const steps = `${upgrade.steps} ${upgrade.steps === 1 ? 'step' : 'steps'}`;
  return (
    <span
      title={`You can upgrade this now: ${upgrade.costPerStep} ${upgrade.currencyName} per step`}
      className="inline-flex h-[26px] w-fit items-center gap-1 rounded-full border border-[#3e8a4d] bg-[#173020] px-2 text-[13px] font-bold text-upgrade"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      {steps}
      <span className="sr-only"> of upgrades you can afford now</span>
    </span>
  );
}
