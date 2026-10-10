import { Skeleton } from '@/components/skeleton/Skeleton';

export function GroupVaultSkeleton() {
  return (
    <section aria-label="Great Vault" className="flex flex-col gap-5">
      <h2 className="font-display text-xl font-bold whitespace-nowrap">Great Vault</h2>
      {[0, 1].map((i) => (
        <div key={i} aria-hidden="true" className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><Skeleton className="size-6 rounded-full" /><Skeleton className="h-4 w-32 rounded-md" /></div>
          <Skeleton className="h-[62px] rounded-lg" />
          <Skeleton className="h-[62px] rounded-lg" />
        </div>
      ))}
    </section>
  );
}
