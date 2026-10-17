import { describe, expect, it } from 'vitest';
import { orderByKeys } from './order-by-keys';

const m = (key: string) => ({ key });

describe('orderByKeys', () => {
  it('follows the order given', () => {
    expect(orderByKeys([m('a'), m('b'), m('c')], ['c', 'a', 'b']).map((x) => x.key)).toEqual(['c', 'a', 'b']);
  });

  it('keeps members missing from the order after the rest, and skips keys with no member', () => {
    expect(orderByKeys([m('a'), m('b'), m('c')], ['c', 'z']).map((x) => x.key)).toEqual(['c', 'a', 'b']);
  });
});
