/** "Troll Guardian Druid", the way the Armory names a character. Missing parts are skipped. */
export function identityLine(race: string | null, spec: string, className: string): string {
  return [race, spec, className].filter(Boolean).join(' ');
}
