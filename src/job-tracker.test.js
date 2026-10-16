import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applicationStageForJob,
  applicationStageToJob,
  countJobsByStatus,
  JOB_STATUSES,
  jobNextActions,
  jobStatusOptions,
  normalizeJobStage,
  searchJobs,
  upsertJobApplication,
} from './job-planning.js';
import { csvCell, jobsToCsv } from './job-export.js';

test('job statuses match the requested tracker list', () => {
  assert.deepEqual(JOB_STATUSES, ['Saved', 'Interested', 'Preparing', 'Applied', 'Interview', 'Rejected', 'Offer']);
});

test('legacy stages migrate without losing unknown values', () => {
  assert.equal(normalizeJobStage('Reviewing'), 'Interested');
  assert.equal(normalizeJobStage('Interviewing'), 'Interview');
  assert.equal(normalizeJobStage(undefined), 'Saved');
  assert.equal(normalizeJobStage('Closed'), 'Closed');
  assert.deepEqual(jobStatusOptions('Closed'), [...JOB_STATUSES, 'Closed']);
  assert.deepEqual(jobStatusOptions('Applied'), JOB_STATUSES);
});

test('job and application stages stay linked both ways', () => {
  assert.equal(applicationStageForJob('Preparing'), 'Researching');
  assert.equal(applicationStageForJob('Interview'), 'Interviewing');
  assert.equal(applicationStageForJob('Rejected'), 'Closed');
  assert.equal(applicationStageForJob('Offer'), 'Offer');
  assert.equal(applicationStageToJob('Interviewing'), 'Interview');
  assert.equal(applicationStageToJob('Researching'), 'Interested');
  const tracked = upsertJobApplication({ id: 'j1', company: 'Acme', title: 'Data Analyst', stage: 'Interview' }, []);
  assert.equal(tracked.application.stage, 'Interviewing');
});

const sample = [
  { job: { id: 1, title: 'Business Analyst', company: 'Northwind', stage: 'Saved', source: 'Naukri', notes: 'Referral from senior', requiredSkills: ['SQL', 'Excel'] } },
  { job: { id: 2, title: 'Product Analyst', company: 'Contoso', stage: 'Applied', source: 'Company careers page' } },
  { job: { id: 3, title: 'Data Analyst', company: 'Fabrikam', stage: 'Interviewing' } },
];

test('tracker search covers title, company, source, notes and skills', () => {
  assert.equal(searchJobs(sample, 'northwind').length, 1);
  assert.equal(searchJobs(sample, 'referral').length, 1);
  assert.equal(searchJobs(sample, 'careers page').length, 1);
  assert.equal(searchJobs(sample, 'sql').length, 1);
  assert.equal(searchJobs(sample, 'analyst').length, 3);
  assert.equal(searchJobs(sample, '', 'Interview').length, 1, 'legacy Interviewing counts as Interview');
  assert.equal(searchJobs(sample, 'analyst', 'Applied')[0].job.company, 'Contoso');
  assert.deepEqual(searchJobs(undefined, 'x'), []);
});

test('status counts include every status and ignore bad records', () => {
  const counts = countJobsByStatus([...sample.map((item) => item.job), null, 'bad']);
  assert.equal(counts.Saved, 1);
  assert.equal(counts.Applied, 1);
  assert.equal(counts.Interview, 1);
  assert.equal(counts.Offer, 0);
});

test('next actions come only from saved jobs and are ordered by urgency', () => {
  const now = new Date('2026-10-17T10:00:00+05:30');
  const actions = jobNextActions([
    { id: 'a', title: 'BA', company: 'One', stage: 'Applied', createdAt: '2026-09-20T00:00:00Z' },
    { id: 'b', title: 'PA', company: 'Two', stage: 'Interested', deadline: '2026-10-19', deadlineVerified: true },
    { id: 'c', title: 'DA', company: 'Three', stage: 'Preparing' },
    { id: 'd', title: 'Ops', company: 'Four', stage: 'Rejected' },
    { id: 'e', title: 'Mkt', company: 'Five', stage: 'Saved', sourceVerified: false },
    { id: 'f', title: 'Fin', company: 'Six', stage: 'Saved', deadline: '2026-10-19', deadlineVerified: false, sourceVerified: true },
  ], now);
  assert.deepEqual(actions.map((action) => action.jobId), ['b', 'c', 'a', 'e']);
  assert.match(actions[0].reason, /deadline in 3 days/);
  assert.match(actions[2].reason, /follow-up/);
  assert.deepEqual(jobNextActions(undefined), []);
});

test('CSV cells are escaped and protected from formula injection', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('+91 999'), "'+91 999");
  assert.equal(csvCell(null), '');
});

test('jobs export to CSV with header, verified-only salary and safe rows', () => {
  const csv = jobsToCsv([
    { title: 'Business Analyst', company: 'Northwind', stage: 'Reviewing', city: 'Noida', country: 'India', source: 'Naukri', jobUrl: 'https://example.com/1', lastChecked: '2026-10-16', sourceVerified: true, salaryVerified: false, salaryMinimum: 500000, currency: 'INR', requiredSkills: ['SQL', 'Excel'], notes: 'Line one\nLine two', createdAt: '2026-10-15T08:00:00Z' },
    null,
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0].split(',')[0], 'Job title');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^Business Analyst,Northwind,Interested,"Noida, India"/);
  assert.match(lines[1], /SQL; Excel/);
  assert.doesNotMatch(lines[1], /500000/, 'unverified salary is not exported');
  assert.match(lines[1], /"Line one\nLine two"/);
  assert.equal(jobsToCsv([]).split('\r\n').length, 1);
});
