import { describe, expect, it } from 'vitest';
import { encodeGroupCookie } from '@/core/characters/member-key';
import { resolveGroupRequest } from './group-page-params';

const birki = { region: 'eu', realmSlug: 'argent-dawn', nameKey: 'birkibjörn' };

describe('resolveGroupRequest', () => {
  it('redirects to the remembered group when the link has no chars', () => {
    const cookie = encodeGroupCookie(['eu.argent-dawn.birkibjörn', 'eu.argent-dawn.hrafnhildur']);
    expect(resolveGroupRequest(undefined, cookie)).toEqual({ redirect: '/group?chars=eu.argent-dawn.birkibj%C3%B6rn,eu.argent-dawn.hrafnhildur' });
  });

  it('renders an empty group without a cookie, or with an empty or malformed one', () => {
    expect(resolveGroupRequest(undefined, undefined)).toEqual({ keys: [] });
    expect(resolveGroupRequest(undefined, '')).toEqual({ keys: [] });
    expect(resolveGroupRequest(undefined, '%E0%A4%A')).toEqual({ keys: [] });
  });

  it('keeps members on realms with accented slugs', () => {
    expect(resolveGroupRequest('eu.festung-der-stürme.Birkibjörn', undefined))
      .toEqual({ keys: [{ region: 'eu', realmSlug: 'festung-der-stürme', nameKey: 'birkibjörn' }] });
  });

  it('never redirects when chars is present, even empty', () => {
    expect(resolveGroupRequest('', encodeGroupCookie(['eu.argent-dawn.birkibjörn']))).toEqual({ keys: [] });
  });

  it('parses chars, joining a repeated parameter', () => {
    expect(resolveGroupRequest('eu.argent-dawn.Birkibjörn', undefined)).toEqual({ keys: [birki] });
    expect(resolveGroupRequest(['eu.argent-dawn.birkibjörn', 'junk'], undefined)).toEqual({ keys: [birki] });
  });
});
