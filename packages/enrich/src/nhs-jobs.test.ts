import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeName } from '@sponsors/db/normalize';
import { canFetch, detectAts } from './careers';
import { employerCodeFromAdvertUrl, NHS_JOBS_EMPLOYER, parseNhsJobsXml, tidySalary } from './nhs-jobs';
import { nhsNameKey } from './public-bodies';

const key = (s: string) => nhsNameKey(normalizeName(s));

test('nhsNameKey ignores "The", NHS, Foundation, Trust, word order and short forms', () => {
  assert.equal(key('The Great Western Hospitals NHS Foundation Trust'), key('GREAT WESTERN HOSPITALS NHS FOUNDATION TRUST'));
  assert.equal(key('Bradford District Care Trust NHS'), key('Bradford District Care NHS Foundation Trust'));
  assert.equal(key('Oxford University Hospitals NHS Trust'), key('Oxford University Hospitals NHS Foundation Trust'));
  assert.equal(key('NHS Kent and Medway ICB'), key('NHS Kent and Medway Integrated Care Board'));
  assert.notEqual(key('North Bristol NHS Trust'), key('Bristol NHS Foundation Trust'));
  assert.notEqual(key('Birmingham Community Healthcare NHS Foundation Trust'), key('Birmingham Women’s and Children’s NHS Foundation Trust'));
});

test('parseNhsJobsXml reads vacancies; codes come from advert URLs', () => {
  const xml = `<?xml version="1.0"?><nhsJobs><totalPages>1</totalPages><totalResults>2</totalResults>
    <vacancyDetails><closeDate>2026-11-22</closeDate><employer>Moorfields Eye Hospital NHS Foundation Trust</employer><id>5671207</id>
      <locations><locations>London, EC1V 2PD</locations><locations>Croydon, CR7 7YE</locations></locations>
      <postDate>2026-11-01T05:25:50.696544</postDate><salary>£66274.00 to £73496.00</salary><title>Principal Radiographer &amp; Lead</title>
      <type>Permanent</type><url>https://beta.jobs.nhs.uk/candidate/jobadvert/C9273-26-0253</url></vacancyDetails>
    <vacancyDetails><title>No url</title></vacancyDetails></nhsJobs>`;
  const { total, vacancies } = parseNhsJobsXml(xml);
  assert.equal(total, 2);
  assert.equal(vacancies.length, 1);
  assert.equal(vacancies[0].title, 'Principal Radiographer & Lead');
  assert.equal(vacancies[0].location, 'London');
  assert.equal(vacancies[0].salary, '£66,274 to £73,496');
  assert.equal(employerCodeFromAdvertUrl(vacancies[0].url), 'C9273');
  const live = parseNhsJobsXml('<nhsJobs><totalResults>1</totalResults><vacancyDetails><title>Consultant</title><url>https://www.jobs.nhs.uk/candidate/jobadvert/C9321-26-1917</url><locations><location>Oxford, OX3 7LE</location></locations></vacancyDetails></nhsJobs>');
  assert.equal(live.vacancies[0].location, 'Oxford', 'live feed format');
  assert.equal(tidySalary('Negotiable'), 'Negotiable');
  assert.equal(tidySalary('£12.45 to £13.10 an hour'), '£12.45 to £13.10 an hour');
});

test('NHS Jobs links count as readable only with an employer code', () => {
  const withCode = detectAts('<a href="https://www.jobs.nhs.uk/candidate/search/results?employerCode=C9820">Vacancies</a>');
  assert.equal(withCode?.provider, 'nhsjobs');
  assert.equal(withCode?.slug, 'C9820');
  assert.ok(withCode && canFetch(withCode));
  const generic = detectAts('<a href="https://www.jobs.nhs.uk/">NHS Jobs</a>');
  assert.equal(generic?.provider, 'nhsjobs');
  assert.ok(generic && !canFetch(generic));
  assert.ok(NHS_JOBS_EMPLOYER.test('the ridge medical practice'));
  assert.ok(!NHS_JOBS_EMPLOYER.test('acme software limited'));
});
