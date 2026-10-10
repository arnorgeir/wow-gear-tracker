import { BrandIcon } from '@/components/brand-icon/BrandIcon';
import { Skeleton } from '@/components/skeleton/Skeleton';

const SUBHEADING = 'text-[13px] font-semibold uppercase tracking-wider text-muted';

export function VaultSectionSkeleton({ status }: { status?: string }) {
  return (
    <section aria-label="Great Vault" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      {status && <span role="status" className="sr-only">{status}</span>}
      <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold"><BrandIcon name="vault" size={28} className="text-gold" />Great Vault</h2>
      <div className="flex flex-col gap-2">
        <h3 className={SUBHEADING}>BiS items below Myth track</h3>
        <Skeleton className="h-[62px] rounded-lg" />
        <Skeleton className="h-[62px] rounded-lg" />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className={SUBHEADING}>This week&rsquo;s choices</h3>
        <Skeleton className="h-[62px] rounded-lg" />
        <Skeleton className="h-[62px] rounded-lg" />
        <Skeleton className="h-[62px] rounded-lg" />
      </div>
    </section>
  );
}
