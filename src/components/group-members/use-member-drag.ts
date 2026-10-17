'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { dropIndexByKey } from './drop-index';
import { IDLE, reduce, type DragAction, type DragState } from './drag-state';

export interface HandleEvents {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onClick: (e: MouseEvent<HTMLElement>) => void;
}

/**
 * Wires pointer and window listeners to the drag reducer and carries out the move it commits. It holds no
 * rules. `order` is the shared membership; `onMove` takes the dragged key and its new index.
 *
 * Moves, releases and cancels are heard on `window`, not on the handle: React moves the handle's DOM node as
 * the preview reorders, and a moved node can lose pointer capture.
 */
export function useMemberDrag(order: string[], onMove: (key: string, index: number) => void) {
  const [state, setState] = useState<DragState>(IDLE);
  const stateRef = useRef<DragState>(IDLE);
  const chips = useRef(new Map<string, HTMLElement>());
  // Handlers read the latest values without re-subscribing the window listeners on every render.
  const latest = useRef({ order, onMove });
  useEffect(() => { latest.current = { order, onMove }; });

  const dispatch = useCallback((action: DragAction) => {
    const result = reduce(stateRef.current, action);
    stateRef.current = result.state;
    setState(result.state);
    if (result.commit) latest.current.onMove(result.commit.key, result.commit.index);
  }, []);

  const orderKey = order.join(',');
  useEffect(() => { dispatch({ type: 'membersChanged', keys: orderKey ? orderKey.split(',') : [] }); }, [orderKey, dispatch]);

  const active = state.kind !== 'idle';
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      dispatch({ type: 'cancel' });
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active, dispatch]);

  const dragging = state.kind === 'drag';
  useEffect(() => {
    if (!dragging) return;
    const onMovePointer = (e: globalThis.PointerEvent) => {
      const s = stateRef.current;
      if (s.kind !== 'drag' || s.pointerId !== e.pointerId) return;
      const rectOf = (k: string) => chips.current.get(k)?.getBoundingClientRect();
      dispatch({ type: 'over', pointerId: e.pointerId, index: dropIndexByKey(s.preview, s.key, rectOf, { x: e.clientX, y: e.clientY }) });
    };
    const onUp = (e: globalThis.PointerEvent) => dispatch({ type: 'end', pointerId: e.pointerId, order: latest.current.order });
    const onCancel = (e: globalThis.PointerEvent) => {
      const s = stateRef.current;
      if (s.kind === 'drag' && s.pointerId === e.pointerId) dispatch({ type: 'cancel' });
    };
    window.addEventListener('pointermove', onMovePointer);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMovePointer);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [dragging, dispatch]);

  const chipRef = (key: string) => (el: HTMLElement | null) => {
    if (el) chips.current.set(key, el);
    else chips.current.delete(key);
  };

  const handleEvents = (key: string): HandleEvents => ({
    onPointerDown: (e) => {
      dispatch({ type: 'start', pointerId: e.pointerId, key, order: latest.current.order, isPrimary: e.isPrimary, button: e.button });
      const s = stateRef.current;
      if (s.kind === 'drag' && s.pointerId === e.pointerId) e.currentTarget.setPointerCapture(e.pointerId);
    },
    // A pointer tap arrives through pointerup; only a keyboard or assistive click (detail 0) taps here.
    onClick: (e) => { if (e.detail === 0) dispatch({ type: 'tap', key, order: latest.current.order }); },
  });

  return {
    /** The key order to draw: the drag preview while dragging, else null. */
    preview: state.kind === 'drag' ? state.preview : null,
    draggingKey: state.kind === 'drag' ? state.key : null,
    pickedKey: state.kind === 'picked' ? state.key : state.kind === 'drag' ? state.from?.key ?? null : null,
    chipRef,
    handleEvents,
  };
}
