import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectAts, findCareersLinks } from './careers';
import { pickCompany } from './companies-house';
import { candidateDomains, domainLabel } from './domains';
import { extractLinks, htmlToText } from './html';
import { isPrivateAddress, parseRobots } from './http';
import { isUkLocation } from './location';
import { canonicalCompanyNumber, companyNumbersOnPage, isParkedPage, verifyPage } from './verify';

test('candidate domains drop company-type words and skip generic names', () => {
  assert.deepEqual(candidateDomains('acme robotics limited').slice(0, 4), ['acmerobotics.co.uk', 'acmerobotics.com', 'acmerobotics.uk', 'acme-robotics.co.uk']);
  assert.deepEqual(candidateDomains('care services limited'), []); // too generic to guess safely
  assert.deepEqual(candidateDomains('abc ltd'), []); // too short
  assert.ok(candidateDomains('monzo bank limited').includes('monzobank.co.uk'));
  // "Acme Robotics Ltd t/a Acme Shop" normalises to "... t a acme shop": guess from the legal name
  assert.equal(candidateDomains('acme robotics limited t a acme shop')[0], 'acmerobotics.co.uk');
});

test('domainLabel handles co.uk-style suffixes', () => {
  assert.equal(domainLabel('www.acme-robotics.co.uk'), 'acmerobotics');
  assert.equal(domainLabel('acme.com'), 'acme');
});

test('company numbers are found near "company number" wording and canonicalised', () => {
  const text = htmlToText('<footer>Acme Ltd. Registered in England and Wales. Company No. 1234567. VAT 999 9999 99</footer>');
  assert.ok(companyNumbersOnPage(text).has('01234567'));
  assert.ok(companyNumbersOnPage('Registered company number: SC123456').has('SC123456'));
  assert.equal(canonicalCompanyNumber('sc 123456'), 'SC123456');
});

test('verifyPage: number beats name; name needs the legal suffix; parked pages rejected', () => {
  const base = { url: 'https://www.acmerobotics.co.uk/', companyNumber: '01234567', normalizedName: 'acme robotics limited', town: 'Leeds' };
  assert.equal(verifyPage({ ...base, html: '<p>Company number 01234567</p>' }), 'company_number');
  assert.equal(verifyPage({ ...base, html: '<p>© 2026 Acme Robotics Ltd. All rights reserved.</p>' }), 'company_name');
  assert.equal(verifyPage({ ...base, html: '<p>Acme Robotics makes robots</p>' }), null);
  assert.equal(
    verifyPage({ ...base, companyNumber: null, html: '<title>Acme Robotics | Home</title><p>Our office in Leeds</p>' }),
    'domain_and_title',
  );
  assert.equal(verifyPage({ ...base, html: '<h1>This domain is for sale</h1> Acme Robotics Ltd' }), null);
  assert.ok(isParkedPage('<script src="https://sedoparking.com/x.js"></script>'));
});

test('detectAts finds job boards in links, iframes and scripts; fetchable providers win', () => {
  assert.deepEqual(detectAts('<a href="https://boards.greenhouse.io/monzo">Jobs</a>'), { provider: 'greenhouse', slug: 'monzo', url: 'https://job-boards.greenhouse.io/monzo' });
  assert.equal(detectAts('<script src="https://boards.greenhouse.io/embed/job_board/js?for=acme"></script>')?.slug, 'acme');
  assert.equal(detectAts('https://jobs.lever.co/palantir/123')?.provider, 'lever');
  assert.equal(detectAts('<iframe src="https://jobs.ashbyhq.com/ramp/embed">')?.slug, 'ramp');
  assert.equal(detectAts('https://apply.workable.com/huggingface/')?.slug, 'huggingface');
  assert.equal(detectAts('https://bunq.recruitee.com/o/x')?.provider, 'recruitee');
  const both = detectAts('<a href="https://acme.teamtailor.com/jobs">a</a> <a href="https://jobs.lever.co/acme">b</a>');
  assert.equal(both?.provider, 'lever');
  assert.equal(detectAts('<a href="https://boards.greenhouse.io/embed">x</a>'), null);
});

test('findCareersLinks ranks careers links and ignores job sites and blogs', () => {
  const html = `<a href="/about">About</a><a href="/blog/jobs-report">Jobs report</a><a href="/careers">Careers</a>
    <a href="https://www.linkedin.com/company/acme/jobs">LinkedIn</a><a href="https://jobs.lever.co/acme">Open roles</a>`;
  const links = extractLinks(html, 'https://acme.com/');
  assert.deepEqual(findCareersLinks(links, 'https://acme.com'), ['https://jobs.lever.co/acme', 'https://acme.com/careers']);
});

test('isUkLocation', () => {
  assert.ok(isUkLocation('London, UK'));
  assert.ok(isUkLocation('Cardiff, London or Remote (UK)'));
  assert.ok(isUkLocation('Anywhere', 'GB'));
  assert.ok(!isUkLocation('London', 'CA'));
  assert.ok(!isUkLocation('New York, NY'));
  assert.ok(!isUkLocation('Cambridge, MA'));
  assert.ok(!isUkLocation('London, Ontario'));
  assert.ok(!isUkLocation('Berlin'));
});

test('pickCompany wants an exact name; prefers active and same town', () => {
  const items = [
    { title: 'ACME ROBOTICS LIMITED', company_number: '1', company_status: 'dissolved', address: { locality: 'Leeds' } },
    { title: 'ACME ROBOTICS LIMITED', company_number: '2', company_status: 'active', address: { locality: 'York' } },
    { title: 'ACME ROBOTICS LIMITED', company_number: '3', company_status: 'active', address: { locality: 'Leeds' } },
    { title: 'ACME ROBOTICS GROUP LIMITED', company_number: '4', company_status: 'active', address: { locality: 'Leeds' } },
  ];
  assert.equal(pickCompany(items, 'acme robotics limited', 'leeds')?.company_number, '3');
  assert.equal(pickCompany(items, 'acme limited', 'leeds'), null);
});

test('robots.txt parsing and private address blocking', () => {
  const rules = parseRobots('User-agent: Googlebot\nDisallow: /g\n\nUser-agent: *\nDisallow: /private\nDisallow:\n');
  assert.deepEqual(rules, ['/private']);
  assert.deepEqual(parseRobots('User-agent: SponsorshipHunterBot\nDisallow: /\nUser-agent: *\nDisallow: /x'), ['/']);
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.10', '172.20.1.1', '169.254.169.254', '::1', 'fd00::1']) assert.ok(isPrivateAddress(ip), ip);
  assert.ok(!isPrivateAddress('8.8.8.8'));
});
