// Phones: equal tabs in their own row, icon above label. From sm up: tabs beside the brand, standing on the header line.
const TAB = 'relative flex flex-1 flex-col items-center gap-1 pb-2.5 pt-2 text-[13px] font-semibold no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold sm:flex-none sm:flex-row sm:gap-2 sm:px-4 sm:py-0 sm:text-[15px]';

/** A header tab: gold with an underline when it holds the current page, muted otherwise. */
export const tabClass = (active: boolean) =>
  `${TAB} ${active ? 'text-gold shadow-[inset_0_-2px_0_var(--color-gold)]' : 'text-muted hover:text-ink'}`;

/** The diamond that sits on the header line under the current tab. Phone tabs have no room beside the underline. */
export const TAB_DIAMOND = 'absolute bottom-[-0.5px] left-1/2 hidden size-[11px] -translate-x-1/2 translate-y-1/2 rotate-45 bg-gold sm:block';
