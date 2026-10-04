const CLASS_COLORS: Record<string, string> = {
  'Death Knight': '#C41E3A', 'Demon Hunter': '#A330C9', Druid: '#FF7C0A', Evoker: '#33937F', Hunter: '#AAD372',
  Mage: '#3FC7EB', Monk: '#00FF98', Paladin: '#F48CBA', Priest: '#E8E8E8', Rogue: '#FFF468',
  Shaman: '#2F8FEF', Warlock: '#8788EE', Warrior: '#C69B6D',
};

export const classColor = (className: string) => CLASS_COLORS[className] ?? '#a79e8e';

const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (rgb: number[]) => 0.2126 * linear(rgb[0] / 255) + 0.7152 * linear(rgb[1] / 255) + 0.0722 * linear(rgb[2] / 255);
const SURFACE_LUMINANCE = 0.02; // #2b261f, the lightest dark surface a name sits on
const MIN_CONTRAST = 4.5;

/** The class color for text: mixed toward white until it reads on the dark surfaces. */
export function classTextColor(className: string): string {
  const rgb = [1, 3, 5].map((i) => parseInt(classColor(className).slice(i, i + 2), 16));
  for (let mix = 0; mix <= 1; mix += 0.05) {
    const out = rgb.map((c) => Math.round(c + (255 - c) * mix));
    if ((luminance(out) + 0.05) / (SURFACE_LUMINANCE + 0.05) >= MIN_CONTRAST) {
      return mix === 0 ? classColor(className) : `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
    }
  }
  return '#ffffff';
}
