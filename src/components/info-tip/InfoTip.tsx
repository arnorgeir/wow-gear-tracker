'use client';

import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode, type SyntheticEvent } from 'react';
import { placeBeside } from '@/components/shared/popover-position';

const CLOSE_DELAY_MS = 200;

/** A mouse hovers; touch and keyboard go through `popoverTarget`. */
const mouseOnly = (fn: () => void) => (e: PointerEvent) => { if (e.pointerType === 'mouse') fn(); };

/**
 * A small "i" button and a native popover beside a title. Hover opens it and it stays while the pointer is
 * on the button or the tip; tap, Enter and Space toggle it; Escape and outside taps close it. Both elements
 * are spans so it can sit inside a `<legend>`. The caller points `aria-describedby` at `id`.
 */
export function InfoTip({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isOpen = () => tip.current?.matches(':popover-open') ?? false;
  const place = useCallback(() => {
    const el = tip.current;
    if (!el || !button.current) return;
    const { top, left } = placeBeside(button.current.getBoundingClientRect(), el.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, []);
  const open = () => {
    clearTimeout(timer.current);
    if (!isOpen()) tip.current?.showPopover();
  };
  const closeSoon = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (isOpen()) tip.current?.hidePopover(); }, CLOSE_DELAY_MS);
  };
  // A click after a hover-open must not toggle the tip closed; a click on a closed tip opens it.
  const onClick = (e: MouseEvent) => {
    if ((e.nativeEvent as globalThis.PointerEvent).pointerType === 'mouse' && isOpen()) e.preventDefault();
  };
  const onToggle = (e: SyntheticEvent<HTMLSpanElement>) => {
    const el = tip.current;
    if (!el) return;
    if ((e.nativeEvent as Event & { newState?: string }).newState === 'open') return place();
    clearTimeout(timer.current);
    el.style.top = '';
    el.style.left = '';
  };
  useEffect(() => {
    const onMove = () => { if (isOpen()) place(); };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, { capture: true, passive: true });
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, { capture: true });
    };
  }, [place]);

  return (
    <span className="inline-flex" onPointerEnter={(e) => mouseOnly(open)(e)} onPointerLeave={(e) => mouseOnly(closeSoon)(e)}>
      <button type="button" ref={button} popoverTarget={id} aria-label={`About ${title}`} onClick={(e) => onClick(e)}
        className="-m-3 inline-flex size-11 items-center justify-center text-muted hover:text-ink md:-m-1 md:size-7">
        <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full border border-line-strong text-xs font-bold normal-case">i</span>
      </button>
      <span id={id} ref={tip} popover="auto" onToggle={(e) => onToggle(e)} onPointerEnter={(e) => mouseOnly(open)(e)} onPointerLeave={(e) => mouseOnly(closeSoon)(e)}
        className="fixed m-0 w-max max-w-[min(18rem,calc(100vw-16px))] rounded-lg border border-line-strong bg-surface p-3 text-sm font-normal normal-case tracking-normal text-ink shadow-2xl">
        {children}
      </span>
    </span>
  );
}
