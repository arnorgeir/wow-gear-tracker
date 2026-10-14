import { describe, expect, it } from 'vitest';
import { IDLE, reduce, type DragAction, type DragState } from './drag-state';

const order = ['a', 'b', 'c'];
const start = (key: string, over: Partial<Extract<DragAction, { type: 'start' }>> = {}): DragAction =>
  ({ type: 'start', pointerId: 1, key, order, isPrimary: true, button: 0, ...over });
const run = (actions: DragAction[], from: DragState = IDLE) => {
  let state = from;
  let commit: { key: string; index: number } | undefined;
  for (const action of actions) ({ state, commit } = reduce(state, action));
  return { state, commit };
};

describe('drag-state', () => {
  it('ignores a press that is not the primary pointer or the main button', () => {
    expect(run([start('a', { isPrimary: false })]).state).toEqual(IDLE);
    expect(run([start('a', { button: 2 })]).state).toEqual(IDLE);
  });

  it('ignores a second pointer while one drags', () => {
    const { state } = run([start('a'), start('b', { pointerId: 2 }), { type: 'over', pointerId: 2, index: 2 }, { type: 'end', pointerId: 2, order }]);
    expect(state).toMatchObject({ kind: 'drag', pointerId: 1, key: 'a', preview: order, moved: false });
  });

  it('commits the new place after a move and release', () => {
    const { state, commit } = run([start('a'), { type: 'over', pointerId: 1, index: 2 }, { type: 'end', pointerId: 1, order }]);
    expect(state).toEqual(IDLE);
    expect(commit).toEqual({ key: 'a', index: 2 });
  });

  it('commits nothing after moving away and back', () => {
    const { state, commit } = run([start('b'), { type: 'over', pointerId: 1, index: 0 }, { type: 'over', pointerId: 1, index: 1 }, { type: 'end', pointerId: 1, order }]);
    expect(state).toEqual(IDLE);
    expect(commit).toBeUndefined();
  });

  it('treats a release with no move as a tap that picks the member up', () => {
    const { state, commit } = run([start('b'), { type: 'end', pointerId: 1, order }]);
    expect(state).toEqual({ kind: 'picked', key: 'b', members: order });
    expect(commit).toBeUndefined();
  });

  it('drops the picked member where a tap on another handle lands', () => {
    const picked = run([{ type: 'tap', key: 'a', order }]).state;
    expect(picked).toEqual({ kind: 'picked', key: 'a', members: order });
    const { state, commit } = run([start('c'), { type: 'end', pointerId: 1, order }], picked);
    expect(state).toEqual(IDLE);
    expect(commit).toEqual({ key: 'a', index: 2 });
  });

  it('ignores a tap on a member missing from the shared order, keeping the picked member', () => {
    const picked = run([{ type: 'tap', key: 'a', order }]).state;
    const byTap = run([{ type: 'tap', key: 'gone', order }], picked);
    expect(byTap.state).toEqual(picked);
    expect(byTap.commit).toBeUndefined();
    const byPress = run([start('gone'), { type: 'end', pointerId: 1, order }], picked);
    expect(byPress.state).toEqual(picked);
    expect(byPress.commit).toBeUndefined();
    expect(run([{ type: 'tap', key: 'gone', order }]).state).toEqual(IDLE);
  });

  it('puts the picked member down on a tap on the same handle', () => {
    const picked = run([{ type: 'tap', key: 'a', order }]).state;
    expect(run([{ type: 'tap', key: 'a', order }], picked)).toEqual({ state: IDLE });
    expect(run([start('a'), { type: 'end', pointerId: 1, order }], picked)).toEqual({ state: IDLE, commit: undefined });
  });

  it('commits a keyboard tap on another handle', () => {
    const picked = run([{ type: 'tap', key: 'c', order }]).state;
    expect(run([{ type: 'tap', key: 'a', order }], picked).commit).toEqual({ key: 'c', index: 0 });
  });

  it('cancels on Escape or a cancelled pointer', () => {
    expect(run([start('a'), { type: 'over', pointerId: 1, index: 2 }, { type: 'cancel' }]).state).toEqual(IDLE);
    expect(run([{ type: 'cancel' }], { kind: 'picked', key: 'a', members: order }).state).toEqual(IDLE);
  });

  it('cancels when the dragged member leaves, and when the picked member does', () => {
    expect(run([start('a'), { type: 'membersChanged', keys: ['b', 'c'] }]).state).toEqual(IDLE);
    expect(run([{ type: 'membersChanged', keys: ['b', 'c'] }], { kind: 'picked', key: 'a', members: order }).state).toEqual(IDLE);
  });

  it('puts a picked member down when someone else is added', () => {
    expect(run([{ type: 'membersChanged', keys: ['a', 'b', 'c', 'd'] }], { kind: 'picked', key: 'a', members: order }).state).toEqual(IDLE);
    expect(run([{ type: 'membersChanged', keys: ['c', 'a', 'b'] }], { kind: 'picked', key: 'a', members: order }).state).toMatchObject({ kind: 'picked' });
  });

  it('appends a new member to the preview and drops a missing one', () => {
    const { state } = run([start('a'), { type: 'membersChanged', keys: ['a', 'c', 'd'] }]);
    expect(state).toMatchObject({ kind: 'drag', preview: ['a', 'c', 'd'] });
  });
});
