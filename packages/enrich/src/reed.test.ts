import assert from 'node:assert/strict';
import { test } from 'node:test';
import { employerKey, reedJobsFor, reedKeywords, salaryText, type ReedResult } from './reed';

const ad = (over: Partial<ReedResult>): ReedResult => ({
  jobId: 1, employerName: 'Aosa Care Services Ltd', jobTitle: 'Care Assistant', locationName: 'Leicester',
  minimumSalary: 12.6, maximumSalary: 13.2, currency: 'GBP', date: '05/11/2026', jobUrl: 'https://www.reed.co.uk/jobs/care-assistant/1', ...over,
});

test('employerKey and reedKeywords', () => {
  assert.equal(employerKey('AOSA CARE SERVICES LIMITED'), 'aosa care services');
  assert.equal(employerKey('Beam Bug Limited T/A Caremark (Chichester)'), 'beam bug');
  assert.equal(reedKeywords('Bright Care (UK) Ltd'), 'bright care');
});

test('reedJobsFor keeps only the sponsor’s own adverts', () => {
  const jobs = reedJobsFor('AOSA CARE SERVICES LIMITED', [
    ad({}),
    ad({ jobId: 2, employerName: 'Care Recruitment Agency Ltd', jobTitle: 'Care Assistant (client: Aosa)' }),
    ad({ jobId: 3, employerName: 'Aosa Care Services Limited', jobTitle: 'Senior Carer - Driver', locationName: 'Wigston', minimumSalary: 26000, maximumSalary: 28000, date: '01/11/2026' }),
    ad({ jobId: 4, employerName: 'Aosa Care', jobTitle: 'Different company' }),
    ad({ jobId: 5, jobUrl: undefined }),
  ]);
  assert.deepEqual(jobs.map((j) => j.externalId), ['1', '3']);
  assert.equal(jobs[0].department, '£12.60–£13.20 an hour');
  assert.equal(jobs[1].department, '£26,000–£28,000');
  assert.equal(jobs[1].postedAt?.toISOString().slice(0, 10), '2026-11-01');
  assert.ok(jobs.every((j) => j.isUk));
});

test('salaryText', () => {
  assert.equal(salaryText(ad({ minimumSalary: 30000, maximumSalary: 30000 })), '£30,000');
  assert.equal(salaryText(ad({ minimumSalary: null, maximumSalary: null })), null);
  assert.equal(salaryText(ad({ minimumSalary: 11.44, maximumSalary: null })), '£11.44 an hour');
  assert.equal(salaryText(ad({ currency: 'EUR' })), null);
});
