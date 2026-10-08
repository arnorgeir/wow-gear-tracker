import type { CrestBalance } from '@/core/gear/crests';

/** What a crest chip says on hover and to screen readers. */
export const crestLabel = (b: CrestBalance) => b.steps === null ? `${b.name}: ${b.quantity}` : `${b.name}: ${b.quantity}, ${b.steps} ${b.steps === 1 ? 'step' : 'steps'}`;

/** The visible name when the icon is missing: "Myth" for Myth Mistcrest, as the character card always said. */
export const crestShortName = (b: CrestBalance) => b.name.split(' ')[0]!;
