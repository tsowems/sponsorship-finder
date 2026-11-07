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

test('diffRegister detects added, removed, readded, rating and detail changes', () => {
  const incoming = groupSkilledWorkerSponsors(parseRegister(CSV));
  const base = { county: null, entryCount: 1 };
  const existing: ExistingSponsor[] = [
    { id: 1, key: '186 london limited|london', status: 'active', rating: 'A', name: '186 London Limited', ...base }, // entryCount 1 -> 2
    { id: 2, key: 'smith and sons limited|leeds', status: 'active', rating: 'A', name: 'Smith & Sons Ltd', ...base, county: 'West Yorkshire' }, // A -> B
    { id: 3, key: 'premium corp|bristol', status: 'removed', rating: 'A', name: 'Premium Corp', ...base }, // back
    { id: 4, key: 'gone limited|york', status: 'active', rating: 'A', name: 'Gone Limited', ...base }, // removed
    { id: 5, key: 'old limited|york', status: 'removed', rating: 'A', name: 'Old Limited', ...base }, // stays removed
  ];
  const d = diffRegister(existing, incoming);
  assert.deepEqual(d.added, []);
  assert.deepEqual(d.removed, [{ id: 4, key: 'gone limited|york' }]);
  assert.deepEqual(d.readded.map((r) => r.id), [3]);
  assert.deepEqual(d.ratingChanged.map((r) => [r.id, r.from, r.to]), [[2, 'A', 'B']]);
  assert.deepEqual(d.detailsChanged.map((r) => r.id), [1]);

  const fresh = diffRegister([], incoming);
  assert.equal(fresh.added.length, 3);
});

test('grouping is independent of row order (a reshuffled register is not a change)', () => {
  const rows = parseRegister(CSV);
  const a = groupSkilledWorkerSponsors(rows);
  const b = groupSkilledWorkerSponsors([...rows].reverse());
  assert.deepEqual([...b.entries()].sort(), [...a.entries()].sort());
  const d = diffRegister(
    [...a.values()].map((s, i) => ({ id: i, key: s.key, status: 'active', rating: s.rating, name: s.name, county: s.county, entryCount: s.entryCount })),
    b,
  );
  assert.equal(d.added.length + d.removed.length + d.ratingChanged.length + d.detailsChanged.length, 0);
});
