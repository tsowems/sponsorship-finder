import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeName, parseRating, slugify } from '@sponsors/db/normalize';
import { diffRegister, type ExistingSponsor } from './diff';
import { groupSkilledWorkerSponsors } from './group';
import { parseRegister } from './parse';

const CSV = `Organisation Name,Town/City,County,Type & Rating,Route\r
186 LONDON LIMITED,London,,Worker (A rating),Skilled Worker\r
186 London Limited,London,,Worker (A rating),Skilled Worker\r
"Smith & Sons Ltd ", Leeds  ,West Yorkshire,Worker (B rating),Skilled Worker\r
Choir Co,Bath,,Worker (A rating),Creative Worker\r
Premium Corp,Bristol,,Worker (A (Premium)),Skilled Worker\r
`;

test('normalizeName treats Ltd/Limited, & / and, case and punctuation as equal', () => {
  assert.equal(normalizeName('Smith & Sons Ltd.'), normalizeName('SMITH AND SONS LIMITED'));
  assert.equal(normalizeName('  2 Degrees  Limited '), '2 degrees limited');
});

test('parseRating', () => {
  assert.equal(parseRating('Worker (A rating)'), 'A');
  assert.equal(parseRating('Worker (B rating)'), 'B');
  assert.equal(parseRating('Worker (A (Premium))'), 'A (Premium)');
  assert.equal(parseRating('Worker (A (SME+))'), 'A (SME+)');
});

test('slugify', () => {
  assert.equal(slugify('Smith & Sons Ltd Leeds'), 'smith-and-sons-ltd-leeds');
  assert.equal(slugify('Café Rouge — London'), 'cafe-rouge-london');
});

test('parse + group keeps Skilled Worker only and merges duplicate rows', () => {
  const grouped = groupSkilledWorkerSponsors(parseRegister(CSV));
  assert.equal(grouped.size, 3);
  const london = grouped.get('186 london limited|london')!;
  assert.equal(london.entryCount, 2);
  assert.equal(london.name, '186 London Limited'); // prefers non-shouty variant
  const smith = grouped.get('smith and sons limited|leeds')!;
  assert.equal(smith.name, 'Smith & Sons Ltd');
  assert.equal(smith.town, 'Leeds');
  assert.equal(smith.rating, 'B');
  assert.equal(grouped.get('premium corp|bristol')!.rating, 'A (Premium)');
});

test('parseRegister rejects unexpected columns', () => {
  assert.throws(() => parseRegister('Name,City\nX,Y\n'), /missing expected columns/);
});

const existingRow = (o: Partial<ExistingSponsor> & Pick<ExistingSponsor, 'id' | 'key' | 'name' | 'town'>): ExistingSponsor => ({
  status: 'active',
  rating: 'A',
  county: null,
  entryCount: 1,
  routes: ['Skilled Worker'],
  ...o,
});

test('diffRegister detects added, removed, readded, rating and detail changes', () => {
  const incoming = groupSkilledWorkerSponsors(parseRegister(CSV));
  const existing: ExistingSponsor[] = [
    existingRow({ id: 1, key: '186 london limited|london', name: '186 London Limited', town: 'London' }), // entryCount 1 -> 2
    existingRow({ id: 2, key: 'smith and sons limited|leeds', name: 'Smith & Sons Ltd', town: 'Leeds', county: 'West Yorkshire' }), // A -> B
    existingRow({ id: 3, key: 'premium corp|bristol', name: 'Premium Corp', town: 'Bristol', status: 'removed' }), // back
    existingRow({ id: 4, key: 'gone limited|york', name: 'Gone Limited', town: 'York' }), // removed
    existingRow({ id: 5, key: 'old limited|york', name: 'Old Limited', town: 'York', status: 'removed' }), // stays removed
  ];
  const d = diffRegister(existing, incoming);
  assert.deepEqual(d.added, []);
  assert.deepEqual(d.removed, [{ id: 4, key: 'gone limited|york' }]);
  assert.deepEqual(d.readded.map((r) => r.id), [3]);
  const byId = new Map(d.updated.map((u) => [u.id, u]));
  assert.deepEqual(byId.get(2)?.rating, { from: 'A', to: 'B' });
  assert.equal(byId.get(2)?.location, undefined);
  assert.ok(byId.has(1) && !byId.get(1)!.rating && !byId.get(1)!.location && !byId.get(1)!.routes, 'cosmetic only');

  const fresh = diffRegister([], incoming);
  assert.equal(fresh.added.length, 3);
});

test('a sponsor that changes town is a location change, not remove + add', () => {
  const incoming = groupSkilledWorkerSponsors(
    parseRegister('Organisation Name,Town/City,County,Type & Rating,Route\nAcme Ltd,Bradford,West Yorkshire,Worker (A rating),Skilled Worker\n'),
  );
  const d = diffRegister([existingRow({ id: 9, key: 'acme limited|leeds', name: 'Acme Ltd', town: 'Leeds' })], incoming);
  assert.deepEqual(d.added, []);
  assert.deepEqual(d.removed, []);
  assert.equal(d.updated.length, 1);
  assert.equal(d.updated[0].id, 9);
  assert.equal(d.updated[0].newKey, 'acme limited|bradford');
  assert.deepEqual(d.updated[0].location, { from: 'Leeds', to: 'Bradford, West Yorkshire' });
});

test('ambiguous moves (two same-name sponsors) stay as remove + add', () => {
  const incoming = groupSkilledWorkerSponsors(
    parseRegister(
      'Organisation Name,Town/City,County,Type & Rating,Route\nAcme Ltd,Bradford,,Worker (A rating),Skilled Worker\nAcme Ltd,Hull,,Worker (A rating),Skilled Worker\n',
    ),
  );
  const d = diffRegister([existingRow({ id: 9, key: 'acme limited|leeds', name: 'Acme Ltd', town: 'Leeds' })], incoming);
  assert.equal(d.added.length, 2);
  assert.equal(d.removed.length, 1);
});

test('county change is a location change; routes are tracked across all rows', () => {
  const incoming = groupSkilledWorkerSponsors(
    parseRegister(
      'Organisation Name,Town/City,County,Type & Rating,Route\nAcme Ltd,Leeds,West Yorkshire,Worker (A rating),Skilled Worker\nAcme Ltd,Leeds,West Yorkshire,Worker (A rating),Global Business Mobility: Senior or Specialist Worker\n',
    ),
  );
  const sponsor = incoming.get('acme limited|leeds')!;
  assert.deepEqual(sponsor.routes, ['Global Business Mobility: Senior or Specialist Worker', 'Skilled Worker']);
  assert.equal(sponsor.entryCount, 1); // only Skilled Worker rows count as entries

  const d = diffRegister([existingRow({ id: 9, key: 'acme limited|leeds', name: 'Acme Ltd', town: 'Leeds' })], incoming);
  assert.deepEqual(d.updated[0].location, { from: 'Leeds', to: 'Leeds, West Yorkshire' });
  assert.deepEqual(d.updated[0].routes, { from: ['Skilled Worker'], to: sponsor.routes });

  // Before route tracking existed, routes are empty: fill silently, no event
  const silent = diffRegister([existingRow({ id: 9, key: 'acme limited|leeds', name: 'Acme Ltd', town: 'Leeds', county: 'West Yorkshire', routes: [] })], incoming);
  assert.equal(silent.updated.length, 1);
  assert.equal(silent.updated[0].routes, undefined);
  assert.equal(silent.updated[0].location, undefined);
});

test('grouping is independent of row order (a reshuffled register is not a change)', () => {
  const rows = parseRegister(CSV);
  const a = groupSkilledWorkerSponsors(rows);
  const b = groupSkilledWorkerSponsors([...rows].reverse());
  assert.deepEqual([...b.entries()].sort(), [...a.entries()].sort());
  const d = diffRegister(
    [...a.values()].map((s, i) => existingRow({ id: i, key: s.key, rating: s.rating, name: s.name, town: s.town, county: s.county, entryCount: s.entryCount, routes: s.routes })),
    b,
  );
  assert.equal(d.added.length + d.removed.length + d.updated.length, 0);
});
