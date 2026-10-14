import { describe, expect, it } from 'vitest';
import type { JournalSection } from '../types';
import { parseJournalText, spellIndex } from './markup';

const spells = new Map([['Echo Slam', 5001], ['Void Fissure', 5002]]);
const t = (text: string) => ({ text });

describe('parseJournalText', () => {
  it('makes one list of consecutive bullets and splits lists at a paragraph', () => {
    expect(parseJournalText('$bullet;One\r\n$bullet;Two\r\nBetween\r\n$bullet;Three', spells)).toEqual([
      { kind: 'list', items: [[t('One')], [t('Two')]] },
      { kind: 'paragraph', parts: [t('Between')] },
      { kind: 'list', items: [[t('Three')]] },
    ]);
  });

  it('drops blank lines and splits on both \r\n and \n', () => {
    expect(parseJournalText('First\r\n\r\nSecond\n\nThird\n', spells).map((b) => b.kind)).toEqual(['paragraph', 'paragraph', 'paragraph']);
    expect(parseJournalText('', spells)).toEqual([]);
  });

  it('links [Name] by exact, case-different and plural name, else leaves the id null', () => {
    const [block] = parseJournalText('Hit [Echo Slam], [echo slam], [Void Fissures] and [Unknown].', spells);
    expect(block).toEqual({
      kind: 'paragraph',
      parts: [
        t('Hit '), { spell: 'Echo Slam', spellId: 5001 }, t(', '), { spell: 'echo slam', spellId: 5001 }, t(', '),
        { spell: 'Void Fissures', spellId: 5002 }, t(' and '), { spell: 'Unknown', spellId: null }, t('.'),
      ],
    });
  });

  it('removes unknown $token; markup', () => {
    expect(parseJournalText('Plain $icon; text$break;', spells)).toEqual([{ kind: 'paragraph', parts: [t('Plain  text')] }]);
  });
});

describe('spellIndex', () => {
  it('maps titles to spell ids across the tree, the first id winning, skipping nodes without one', () => {
    const node = (title: string, spellId: number | null, sections: JournalSection[] = []): JournalSection => ({ title, spellId, bodyText: null, sections });
    const index = spellIndex([node('Group', null, [node('Echo Slam', 1)]), node('Echo Slam', 2), node('Void Fissure', 3)]);
    expect([...index]).toEqual([['Echo Slam', 1], ['Void Fissure', 3]]);
  });
});
