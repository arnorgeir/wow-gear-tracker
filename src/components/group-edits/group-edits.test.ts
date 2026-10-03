import { describe, expect, it } from 'vitest';
import { createGroupEdits } from './group-edits';

const setup = (initial: string[]) => {
  const emitted: string[][] = [];
  const edits = createGroupEdits(initial, (keys) => emitted.push(keys));
  return { edits, emitted };
};

describe('createGroupEdits', () => {
  it('applies two quick removals made before the first navigation finishes', () => {
    const { edits, emitted } = setup(['a', 'b', 'c']);
    edits.remove('a');
    edits.remove('b');
    expect(emitted).toEqual([['b', 'c'], ['c']]);
    expect(edits.keys()).toEqual(['c']);
  });

  it('keeps both of two quick additions, and never goes past five', () => {
    const { edits, emitted } = setup(['a', 'b', 'c']);
    edits.add('d');
    edits.add('e');
    edits.add('f');
    expect(edits.keys()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(emitted).toEqual([['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd', 'e']]);
  });

  it('does not bring back a member removed while a search add was still waiting', async () => {
    const { edits } = setup(['a', 'b']);
    const searchAdd = (async () => { await Promise.resolve(); edits.add('c'); })();
    edits.remove('b');
    await searchAdd;
    expect(edits.keys()).toEqual(['a', 'c']);
  });

  it('says nothing for an edit that changes nothing', () => {
    const { edits, emitted } = setup(['a', 'b']);
    edits.add('a');
    edits.remove('z');
    expect(emitted).toEqual([]);
  });

  it('takes the committed keys back once every navigation has finished, without navigating', () => {
    const { edits, emitted } = setup(['a', 'b']);
    edits.remove('a');
    edits.reset(['b']);
    expect(edits.keys()).toEqual(['b']);
    edits.remove('b');
    expect(emitted).toEqual([['b'], []]);
  });
});
