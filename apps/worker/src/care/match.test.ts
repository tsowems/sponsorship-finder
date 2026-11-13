import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeName } from '@sponsors/db';
import { indexProviders, matchSponsor, providerKey, tradingName, type ServiceRecord } from './match';

const svc = (providerId: string, providerName: string, homeCare: boolean, place: string, regulator: ServiceRecord['regulator'] = 'cqc'): ServiceRecord => ({
  regulator, providerId, providerName, homeCare, place,
});
const sponsor = (name: string, town: string) => ({ name, normalizedName: normalizeName(name), town });

test('providerKey and tradingName', () => {
  assert.equal(providerKey('Bright Care (UK) Ltd'), 'bright care');
  assert.equal(providerKey('The Bright Care Company Limited'), 'bright care');
  assert.equal(providerKey('Beam Bug Limited T/A Caremark (Chichester)'), 'beam bug');
  assert.equal(tradingName('Beam Bug Limited T/A Caremark (Chichester)'), 'caremark chichester');
  assert.equal(tradingName('Beam Bug Limited'), null);
});

test('matchSponsor: town match, company-name match, ambiguity and care homes', () => {
  const index = indexProviders([
    svc('1', 'Aosa Care Services Ltd', true, 'Unit 2, Mill Lane, Leicester'),
    svc('2', 'Sunny Home Limited', false, '4 High St, Lincoln'),
    svc('3', 'Oasis Support Ltd', true, '18 Braemar Avenue, Bristol'),
    svc('4', 'Oasis Support', true, '2 Station Rd, Leeds'),
    svc('5', 'Fona Godema Ltd', true, 'Basildon'),
    svc('5', 'Fona Godema Ltd', false, 'Southend'),
    svc('SP1', 'Highland Carers Ltd', true, 'Inverness Highland', 'care_inspectorate'),
  ]);
  const [a] = matchSponsor(sponsor('AOSA CARE SERVICES LIMITED', 'Leicester'), index);
  assert.equal(a.providerId, '1');
  assert.equal(a.matchedBy, 'name_and_town');
  assert.equal(a.homeCare, true);

  const [b] = matchSponsor(sponsor('Aosa Care Services Ltd', 'Wigston'), index);
  assert.equal(b.matchedBy, 'company_name', 'unique registered company name, different town');

  const [c] = matchSponsor(sponsor('Sunny Home Ltd', 'Lincoln'), index);
  assert.equal(c.homeCare, false, 'registered, but only as a care home');

  assert.deepEqual(matchSponsor(sponsor('Oasis Support Ltd', 'Newport'), index), [], 'two providers with that name, neither in town');
  assert.equal(matchSponsor(sponsor('Oasis Support Ltd', 'Leeds'), index)[0].providerId, '4');

  const [f] = matchSponsor(sponsor('Fona Godema Ltd', 'Basildon'), index);
  assert.equal(f.services, 2);
  assert.equal(f.homeCareServices, 1);

  assert.deepEqual(matchSponsor(sponsor('Aosa Care Services', 'Wigston'), index), [], 'not a company name and not in town');
  assert.equal(matchSponsor(sponsor('Highland Carers Limited', 'Inverness'), index)[0].regulator, 'care_inspectorate');
  assert.equal(matchSponsor(sponsor('Bath Care Ltd', 'Bath'), indexProviders([svc('9', 'Bath Care', true, 'Bathgate'), svc('10', 'Bath Care', true, 'Leeds')])).length, 0, 'whole-word towns only');
});
