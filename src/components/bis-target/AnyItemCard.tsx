/** The BiS cell for an "Any" row: no specific item, only the item level any item in the slot must reach. */
export function AnyItemCard({ minItemLevel }: { minItemLevel: number }) {
  return (
    <div className="flex min-h-[62px] items-center rounded-lg border border-line-strong bg-surface-2 px-4 text-[15px] font-semibold">
      Any item, level {minItemLevel}+
    </div>
  );
}
