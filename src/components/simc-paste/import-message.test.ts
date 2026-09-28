import { describe, expect, it } from 'vitest';
import { importMessage } from './import-message';

describe('importMessage', () => {
  it('counts what a paste brought in', () => {
    expect(importMessage({ changed: true, equipped: 16, bags: 4, vault: 3 }))
      .toBe('Imported 16 equipped, 4 bag and 3 Great Vault items.');
  });

  it('says nothing changed when the paste matched the last one', () => {
    expect(importMessage({ changed: false })).toBe('Nothing changed since your last paste.');
  });

  it('treats a reply with no body as nothing changed', () => {
    expect(importMessage(null)).toBe('Nothing changed since your last paste.');
  });
});
