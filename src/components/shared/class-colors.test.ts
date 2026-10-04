import { describe, expect, it } from 'vitest';
import { classColor, classTextColor } from './class-colors';

const CLASSES = ['Death Knight', 'Demon Hunter', 'Druid', 'Evoker', 'Hunter', 'Mage', 'Monk', 'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior'];
// Lightest surface a name sits on, so passing here passes on the darker ones too.
const RAISED = '#2b261f';

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('classTextColor', () => {
  it.each(CLASSES)('%s text reads on dark surfaces (WCAG AA)', (name) => {
    expect(contrast(classTextColor(name), RAISED)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps colors that already read', () => {
    expect(classTextColor('Mage')).toBe(classColor('Mage'));
  });

  it('lightens Death Knight red, keeping the red hue', () => {
    const c = classTextColor('Death Knight');
    expect(c).not.toBe(classColor('Death Knight'));
    expect(parseInt(c.slice(1, 3), 16)).toBeGreaterThan(parseInt(c.slice(3, 5), 16));
  });
});
