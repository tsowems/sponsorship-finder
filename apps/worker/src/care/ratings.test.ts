import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ratingsFromSheetXml, rowCells, summariseRatings } from './ratings';

const cell = (v: string, rep?: number) =>
  `<table:table-cell office:value-type="string"${rep ? ` table:number-columns-repeated="${rep}"` : ''}><text:p>${v}</text:p></table:table-cell>`;
const row = (...cells: string[]) => `<table:table-row table:style-name="ro1">${cells.join('')}</table:table-row>`;
const header = row(cell('Location ID'), cell('Location Name'), cell('Service / Population Group'), cell('Domain'), cell('Latest Rating'), cell('Provider ID'));
const loc = (id: string, group: string, domain: string, rating: string, provider: string) => row(cell(id), cell('Somewhere &amp; Co'), cell(group), cell(domain), cell(rating), cell(provider));

async function* chunked(text: string, size: number) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

test('rowCells handles repeated and empty cells', () => {
  assert.deepEqual(rowCells(row(cell('a'), '<table:table-cell table:number-columns-repeated="2"/>', cell('b', 2), cell('c')), 10), ['a', '', '', 'b', 'b', 'c']);
  assert.deepEqual(rowCells(row(cell('a'), cell('b'), cell('c')), 2), ['a', 'b']);
  assert.deepEqual(rowCells(row('<table:table-cell><text:p>A <text:span>B</text:span> &amp; C</text:p></table:table-cell>'), 5), ['A B & C']);
});

test('ratingsFromSheetXml keeps overall ratings of the given locations, across chunk boundaries', async () => {
  const xml = [
    '<office:spreadsheet><table:table table:name="README">', row(cell('Location ID'), cell('ignored')), '</table:table>',
    '<table:table table:name="Locations">', header,
    loc('L1', 'Overall', 'Overall', 'Good', 'P1'),
    loc('L1', 'Overall', 'Safe', 'Inadequate', 'P1'),
    loc('L2', 'Overall', 'Overall', 'Requires improvement', 'P1'),
    loc('L3', 'Overall', 'Overall', 'Not Rated', 'P2'),
    loc('L9', 'Overall', 'Overall', 'Outstanding', 'P1'), // a care home: not in the wanted set
    '</table:table><table:table table:name="Providers">', row(cell('Provider ID')), loc('L1', 'Overall', 'Overall', 'Inadequate', 'P1'), '</table:table>',
  ].join('');
  for (const size of [7, 64, 100_000]) {
    const { byProvider } = await ratingsFromSheetXml(chunked(xml, size), new Set(['L1', 'L2', 'L3']));
    assert.equal(summariseRatings(byProvider.get('P1')!), '1 Good, 1 Requires improvement', `chunk ${size}`);
    assert.equal(summariseRatings(byProvider.get('P2')!), 'Not yet rated');
  }
});

test('summariseRatings', () => {
  assert.equal(summariseRatings(new Map([['Good', 1]])), 'Good');
  assert.equal(summariseRatings(new Map([['Good', 3]])), 'Good (all 3 services)');
  assert.equal(summariseRatings(new Map([['Inadequate', 1], ['Outstanding', 2]])), '2 Outstanding, 1 Inadequate');
  assert.equal(summariseRatings(new Map()), null);
});
