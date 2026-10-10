import { describe, expect, it } from 'vitest';
import {
  addMember, characterHref, decodeGroupCookie, encodeGroupCookie, findByMemberKey, formatMemberKey, groupHref,
  memberKeyFromParts, memberKeyFromPath, memberKeyOf, parseMemberKey, parseMemberKeys, removeMember, selectGroup, type MemberKey,
} from './member-key';

const birki: MemberKey = { region: 'eu', realmSlug: 'argent-dawn', nameKey: 'birkibjörn' };
const key = (region: 'eu' | 'us', name: string): MemberKey => ({ region, realmSlug: 'argent-dawn', nameKey: name });

describe('member keys', () => {
  it('builds a key from a character, folding the name', () => {
    expect(memberKeyOf({ region: 'eu', realmSlug: 'argent-dawn', name: 'Birkibjörn' })).toEqual(birki);
    expect(formatMemberKey(birki)).toBe('eu.argent-dawn.birkibjörn');
  });

  it('parses a hand-typed key with capitals and ö', () => {
    expect(parseMemberKey('EU.Argent-Dawn.BIRKIBJÖRN')).toEqual(birki);
    expect(parseMemberKey(' eu.argent-dawn.birkibjörn ')).toEqual(birki);
  });

  it('rejects keys that are not region, realm slug and a name of letters', () => {
    for (const bad of ['', 'eu.argent-dawn', 'xx.argent-dawn.birki', 'eu.argent dawn.birki', 'eu.argent-dawn.birki2', 'eu.-dawn.birki', 'eu.a.b.c']) {
      expect(parseMemberKey(bad)).toBeNull();
    }
  });

  it('parses a list, dropping junk and repeats but keeping order', () => {
    expect(parseMemberKeys('eu.argent-dawn.hrafnhildur,junk,,EU.argent-dawn.Hrafnhildur,eu.argent-dawn.birkibjörn'))
      .toEqual([key('eu', 'hrafnhildur'), birki]);
  });

  it('applies the region rule before the cap', () => {
    const keys = [key('eu', 'a'), key('us', 'b'), key('us', 'c'), key('us', 'd'), key('us', 'e'),
      key('eu', 'f'), key('eu', 'g'), key('eu', 'h'), key('eu', 'i'), key('eu', 'j')];
    const { members, dropped } = selectGroup(keys);
    expect(members.map((k) => k.nameKey)).toEqual(['a', 'f', 'g', 'h', 'i']);
    expect(dropped.map((k) => k.nameKey)).toEqual(['b', 'c', 'd', 'e']);
    expect(selectGroup([])).toEqual({ members: [], dropped: [] });
  });

  it('finds a tracked character by region, realm slug and folded name', () => {
    const rows = [
      { region: 'eu' as const, realmSlug: 'azjol-nerub', name: 'Birkibjörn', id: 1 },
      { region: 'eu' as const, realmSlug: 'argent-dawn', name: 'Birkibjörn', id: 2 },
    ];
    expect(findByMemberKey(rows, birki)?.id).toBe(2);
    expect(findByMemberKey(rows, key('us', 'birkibjörn'))).toBeUndefined();
  });

  it('adds without repeats or going past five, and removes', () => {
    expect(addMember(['a'], 'b')).toEqual(['a', 'b']);
    expect(addMember(['a', 'b'], 'a')).toEqual(['a', 'b']);
    expect(addMember(['a', 'b', 'c', 'd', 'e'], 'f')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(removeMember(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('builds a group link that round-trips through the URL', () => {
    const href = groupHref([formatMemberKey(birki), 'eu.argent-dawn.hrafnhildur']);
    expect(href).toBe('/group?chars=eu.argent-dawn.birkibj%C3%B6rn,eu.argent-dawn.hrafnhildur');
    const chars = new URL(href, 'http://localhost').searchParams.get('chars')!;
    expect(parseMemberKeys(chars)).toEqual([birki, key('eu', 'hrafnhildur')]);
    expect(groupHref([])).toBe('/group?chars=');
  });

  describe('accented realm slugs', () => {
    const stürme: MemberKey = { region: 'eu', realmSlug: 'festung-der-stürme', nameKey: 'birkibjörn' };
    const k = formatMemberKey(stürme);

    it('round-trips through format and parse', () => {
      expect(k).toBe('eu.festung-der-stürme.birkibjörn');
      expect(parseMemberKey(k)).toEqual(stürme);
      expect(parseMemberKey('EU.Festung-der-STÜRME.Birkibjörn')).toEqual(stürme);
    });

    it('round-trips through a group link and the cookie', () => {
      const chars = new URL(groupHref([k]), 'http://localhost').searchParams.get('chars')!;
      expect(parseMemberKeys(chars)).toEqual([stürme]);
      expect(decodeGroupCookie(encodeGroupCookie([k]))).toEqual([stürme]);
    });

    it('still rejects malformed slugs', () => {
      for (const bad of ['eu.festung der-stürme.birki', 'eu.festung.der.birki', 'eu.festung--der.birki', 'eu.festung-.birki', 'eu..birki']) {
        expect(parseMemberKey(bad)).toBeNull();
      }
    });
  });

  it('round-trips the cookie, and treats a malformed one as empty', () => {
    expect(decodeGroupCookie(encodeGroupCookie([formatMemberKey(birki)]))).toEqual([birki]);
    expect(decodeGroupCookie('eu.argent-dawn.birkibjörn')).toEqual([birki]); // already decoded by Next
    expect(decodeGroupCookie('%E0%A4%A')).toEqual([]);
    expect(decodeGroupCookie(undefined)).toEqual([]);
    expect(decodeGroupCookie(encodeGroupCookie([]))).toEqual([]);
  });
});

describe('character paths', () => {
  const rusty: MemberKey = { region: 'eu', realmSlug: 'tarren-mill', nameKey: 'rustý' };

  it('links to the folded, encoded name', () => {
    expect(characterHref({ region: 'eu', realmSlug: 'tarren-mill', name: 'Rustý' })).toBe('/characters/eu/tarren-mill/rust%C3%BD');
  });

  it('builds a key from parts in any case', () => {
    expect(memberKeyFromParts('EU', 'Tarren-Mill', 'RUSTÝ')).toEqual(rusty);
    expect(memberKeyFromParts('eu', 'argent-dawn', 'Birkibjörn')).toEqual(birki);
  });

  it('rejects parts that are not region, realm slug and a name of letters', () => {
    expect(memberKeyFromParts('xx', 'tarren-mill', 'rustý')).toBeNull();
    expect(memberKeyFromParts('eu', 'tarren mill', 'rustý')).toBeNull();
    expect(memberKeyFromParts('eu', '-mill', 'rustý')).toBeNull();
    expect(memberKeyFromParts('eu', 'tarren-mill', 'rusty2')).toBeNull();
    expect(memberKeyFromParts('eu', 'tarren-mill', 'rus.ty')).toBeNull();
    expect(memberKeyFromParts('eu', 'tarren-mill', '')).toBeNull();
  });

  it('reads a path whether or not Next already decoded it', () => {
    expect(memberKeyFromPath('eu', 'tarren-mill', 'rust%C3%BD')).toEqual(rusty);
    expect(memberKeyFromPath('eu', 'tarren-mill', 'rustý')).toEqual(rusty);
    expect(memberKeyFromPath('EU', 'Tarren-Mill', 'RUST%C3%9D')).toEqual(rusty);
  });

  it('round-trips a link back to its key', () => {
    const [, , region, realm, name] = characterHref({ region: 'eu', realmSlug: 'tarren-mill', name: 'Rustý' }).split('/');
    expect(memberKeyFromPath(region!, realm!, name!)).toEqual(rusty);
  });

  it('treats a segment that will not decode as no key', () => {
    expect(memberKeyFromPath('eu', 'tarren-mill', '%E0%A4%A')).toBeNull();
  });
});
