import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanTown, mergeTowns } from './towns';

test('cleanTown drops postcodes, countries and counties; saint → st; aliases', () => {
  assert.equal(cleanTown('london england'), 'london');
  assert.equal(cleanTown('london ec3a 7ag'), 'london');
  assert.equal(cleanTown('basingstoke rg24 8pe'), 'basingstoke');
  assert.equal(cleanTown('london area united kingdom'), 'london');
  assert.equal(cleanTown('rochester kent'), 'rochester');
  assert.equal(cleanTown('salford greater manchester'), 'salford');
  assert.equal(cleanTown('greater london'), 'london');
  assert.equal(cleanTown('saint helens'), 'st helens');
  assert.equal(cleanTown('newcastle'), 'newcastle upon tyne');
  assert.equal(cleanTown('newcastle under lyme'), 'newcastle under lyme', 'different town, untouched');
  assert.equal(cleanTown('west yorkshire'), 'west yorkshire', 'a region on its own is left alone');
  assert.equal(cleanTown('london colney'), 'london colney', 'real place starting with a city name');
  assert.equal(cleanTown('londonderry'), 'londonderry');
  assert.equal(cleanTown('ky11 9yd'), 'ky11 9yd', 'all-postcode values are kept rather than emptied');
});

test('mergeTowns groups spellings; districts with their own entries stay separate', () => {
  const merged = mergeTowns([
    { normalized: 'london', name: 'London', count: 100 },
    { normalized: 'london england', name: 'London England', count: 5 },
    { normalized: 'greater london', name: 'Greater London', count: 4 },
    { normalized: 'ilford', name: 'Ilford', count: 50 },
    { normalized: 'ilford london', name: 'Ilford, London', count: 3 },
    { normalized: 'hackney london', name: 'Hackney London', count: 2 },
    { normalized: 'newcastle upon tyne', name: 'Newcastle upon Tyne', count: 40 },
    { normalized: 'newcastle', name: 'Newcastle', count: 9 },
  ]);
  const by = Object.fromEntries(merged.map((m) => [m.key, m]));
  assert.equal(by.london.count, 111); // london + england + greater + hackney
  assert.equal(by.london.name, 'London');
  assert.deepEqual(by.ilford.variants.sort(), ['ilford', 'ilford london']);
  assert.equal(by['newcastle upon tyne'].count, 49);
  assert.equal(by['newcastle upon tyne'].name, 'Newcastle upon Tyne');
  assert.equal(by.hackney, undefined);
});
