import { describe, expect, it } from 'vitest';
import { gridColumns } from './grid-columns';

const a = 'eu.argent-dawn.birkibjörn';
const b = 'eu.argent-dawn.sólrún';
const c = 'eu.argent-dawn.ylfa';

describe('gridColumns', () => {
  it('keeps rendered members as they are when nothing is pending', () => {
    expect(gridColumns([a, b], [a, b])).toEqual([{ kind: 'member', index: 0 }, { kind: 'member', index: 1 }]);
  });

  it('adds a pending column for a requested member the server has not rendered', () => {
    expect(gridColumns([a], [a, b])).toEqual([{ kind: 'member', index: 0 }, { kind: 'pending', key: b }]);
  });

  it('follows the latest request across rapid additions', () => {
    expect(gridColumns([a], [a, b, c])).toEqual([{ kind: 'member', index: 0 }, { kind: 'pending', key: b }, { kind: 'pending', key: c }]);
  });

  it('drops a rendered member as soon as it is no longer requested', () => {
    expect(gridColumns([a, b], [b])).toEqual([{ kind: 'member', index: 1 }]);
  });

  it('is all pending columns when nothing has rendered yet', () => {
    expect(gridColumns([], [a, b])).toEqual([{ kind: 'pending', key: a }, { kind: 'pending', key: b }]);
  });

  it('is empty when nobody is requested', () => {
    expect(gridColumns([a], [])).toEqual([]);
  });
});
