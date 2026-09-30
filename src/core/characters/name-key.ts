/**
 * The one definition of "same character name": case-folded with the locale rules that also fold
 * non-ASCII letters like ö. Backs the database's unique index on (region, realm_id, name_key),
 * and is imported directly by the client-side search bar so both sides agree without either one
 * reaching into `src/core/db`.
 */
export function nameKeyOf(name: string): string {
  return name.toLocaleLowerCase('en');
}
