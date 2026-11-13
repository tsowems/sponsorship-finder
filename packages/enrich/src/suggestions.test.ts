import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSuggestedUrl, sameSite } from './suggestions';

test('normalizeSuggestedUrl tidies links and refuses ones that are not company sites', () => {
  assert.equal(normalizeSuggestedUrl('www.martoncarehomes.co.uk/our-care-homes/'), 'https://www.martoncarehomes.co.uk/our-care-homes/');
  assert.equal(normalizeSuggestedUrl(' https://Acme.co.uk/careers#top '), 'https://acme.co.uk/careers');
  assert.equal(normalizeSuggestedUrl('http://acme.co.uk'), 'http://acme.co.uk/');
  for (const bad of ['', 'acme', 'ftp://acme.co.uk', 'javascript:alert(1)', 'https://user:pw@acme.co.uk', 'https://acme.co.uk:8080/', 'http://127.0.0.1/', 'http://[::1]/',
    'https://www.linkedin.com/company/acme', 'https://uk.indeed.com/cmp/acme', 'https://www.facebook.com/acme', 'https://www.sponsorshiphunter.com/sponsors/x', 'a b.com', `https://acme.co.uk/${'x'.repeat(600)}`]) {
    assert.equal(normalizeSuggestedUrl(bad), null, bad);
  }
});

test('sameSite treats subdomains of the confirmed site as the same site', () => {
  assert.ok(sameSite('https://recruitment.martoncarehomes.co.uk/', 'https://www.martoncarehomes.co.uk/'));
  assert.ok(sameSite('https://acme.co.uk/careers', 'https://www.acme.co.uk/'));
  assert.ok(!sameSite('https://notacme.co.uk/', 'https://acme.co.uk/'));
  assert.ok(!sameSite('https://ce0992li.webitrent.com/x', 'https://www.leeds.gov.uk/'));
});
