import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeJobDescription,
  buildJobSearchQuery,
  externalJobSearches,
  filterJobListings,
  getJobFit,
  priorityForRole,
  upsertJobApplication,
} from './job-planning.js';
import {
  COMBINED_LEARNING_PLAN,
  mergeLearningPlan,
  mergeSkillAssessments,
  removeLegacyRoadmapSamples,
} from './learning-plan.js';

test('priority classification preserves specific technology and healthcare families', () => {
  assert.equal(priorityForRole('Business Analyst'), 1);
  assert.equal(priorityForRole('Associate Product Manager'), 2);
  assert.equal(priorityForRole('Technology Business Analyst'), 5);
  assert.equal(priorityForRole('Healthcare Business Analyst'), 6);
});

test('global manual search links accept arbitrary locations and never create listings', () => {
  const query = buildJobSearchQuery('', '1');
  const sources = externalJobSearches(query, 'Japan', 'Osaka');
  assert.equal(sources.length, 3);
  assert.ok(sources.every((source) => source.label.includes('manual research')));
  assert.ok(sources[0].href.includes('Osaka'));
  assert.ok(sources[0].href.includes('Japan'));
});

test('job description analysis quotes authorization, sponsorship, and verified salary clues', () => {
  const result = analyzeJobDescription('Must be authorized to work in Canada. Visa sponsorship is not available. Salary CAD 70,000 to CAD 82,000.');
  assert.ok(result.authorizationEvidence.length);
  assert.ok(result.sponsorshipEvidence.length);
  assert.ok(result.salaryEvidence.length);
});

test('job-description skills are split into profile matches and unlisted gaps', () => {
  const result = analyzeJobDescription('Must know Excel, SQL, and dashboards.', ['SQL']);
  assert.deepEqual(result.matchedProfileSkills, ['SQL']);
  assert.deepEqual(result.missingSkills, ['Excel', 'dashboards']);
});

test('location preferences prioritize matching listings without excluding other locations', () => {
  const preferences = [{ location: 'India', priority: 1 }];
  const base = { title: 'Business Analyst', company: 'Example', experienceLevel: 'Fresher', requiredSkills: [] };
  const india = getJobFit({ ...base, country: 'India' }, { skills: '' }, [], preferences);
  const canada = getJobFit({ ...base, country: 'Canada' }, { skills: '' }, [], preferences);
  assert.ok(india.score > canada.score);
  assert.ok(canada.score > 0);
});

test('unassessed baseline skills do not count as verified skill matches', () => {
  const fit = getJobFit(
    { title: 'Data Analyst', requiredSkills: ['SQL'] },
    { skills: '' },
    [{ name: 'SQL', current: null, target: null }],
  );
  assert.deepEqual(fit.matches, []);
});

test('tracking a job is idempotent and keeps its application status', () => {
  const job = { id: 'job-1', company: 'Example', title: 'Business Analyst', country: 'India', stage: 'Applied' };
  const first = upsertJobApplication(job, [], 100, '2026-10-09');
  const second = upsertJobApplication(job, first.applications, 101, '2026-10-10');
  assert.equal(second.applications.length, 1);
  assert.equal(second.application.id, 100);
  assert.equal(second.application.stage, 'Applied');
  assert.equal(second.application.jobId, 'job-1');
  assert.equal(second.alreadyTracked, true);
});

test('tracker duplicates match company, role, and posting URL', () => {
  const firstJob = { id: 'job-1', company: 'Example', title: 'Business Analyst', jobUrl: 'https://jobs.example/role/1' };
  const tracked = upsertJobApplication(firstJob, [], 100, '2026-10-09');
  const duplicate = upsertJobApplication({ ...firstJob, id: 'job-2', jobUrl: 'https://JOBS.example/role/1#apply' }, tracked.applications, 101);
  const differentPosting = upsertJobApplication({ ...firstJob, id: 'job-3', jobUrl: 'https://jobs.example/role/2' }, duplicate.applications, 102);
  assert.equal(duplicate.alreadyTracked, true);
  assert.equal(differentPosting.alreadyTracked, false);
  assert.equal(differentPosting.applications.length, 2);
});

test('city and work-mode preferences affect fit without excluding other places', () => {
  const base = { title: 'Business Analyst', company: 'Example', experienceLevel: 'Fresher', requiredSkills: [], mode: 'Remote', country: 'Canada', city: 'Toronto' };
  const preferred = getJobFit(base, { skills: '' }, [], [{ country: 'Canada', city: 'Toronto', mode: 'Remote', priority: 1 }]);
  const otherMode = getJobFit({ ...base, mode: 'On-site' }, { skills: '' }, [], [{ country: 'Canada', city: 'Toronto', mode: 'Remote', priority: 1 }]);
  assert.ok(preferred.score > otherMode.score);
  assert.ok(otherMode.score > 0);
});

test('job filters select only matching locations and verified salary facts', () => {
  const scored = [
    { job: { company: 'Northwind', title: 'Analyst', country: 'Canada', city: 'Toronto', salaryVerified: true, currency: 'CAD', salaryMinimum: 70000, salaryMaximum: 90000 }, fit: { priority: 1 } },
    { job: { company: 'Contoso', title: 'Analyst', country: 'India', city: 'Pune', salaryVerified: false, currency: '', salaryMinimum: '', salaryMaximum: '' }, fit: { priority: 1 } },
  ];
  const filtered = filterJobListings(scored, { country: 'Canada', city: 'Toronto', currency: 'CAD', minimumSalary: '75000' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].job.company, 'Northwind');
  assert.deepEqual(filterJobListings(scored, { currency: 'CAD', verifiedSalaryOnly: true }).map(({ job }) => job.company), ['Northwind']);
});

test('shared foundation covers core analytical work and optional skills remain separate', () => {
  const shared = COMBINED_LEARNING_PLAN.filter((item) => item.group === 'Shared foundation');
  const extensions = COMBINED_LEARNING_PLAN.filter((item) => item.group === 'Optional product and industry skills');
  assert.deepEqual(shared.slice(0, 4).map((item) => item.skill), [
    'Excel / spreadsheets', 'SQL', 'Business metrics', 'Dashboards and reporting',
  ]);
  assert.ok(extensions.length);
  assert.ok(COMBINED_LEARNING_PLAN.every((item) => item.resourceUrl.startsWith('https://')));
  assert.ok(COMBINED_LEARNING_PLAN.every((item) => item.status === 'Not started' && item.targetDate === '' && item.notes === ''));
});

test('learning plan and skill merges preserve saved progress and custom entries', () => {
  const learningPlan = mergeLearningPlan([
    { id: 'learn-sql', done: true },
    { id: 'my-step', title: 'My custom step', done: false },
  ]);
  assert.equal(learningPlan.find((item) => item.id === 'learn-sql').done, true);
  assert.equal(learningPlan.find((item) => item.id === 'learn-sql').status, 'Done');
  assert.ok(learningPlan.some((item) => item.id === 'my-step'));

  const skills = mergeSkillAssessments([
    { id: 'core-sql', name: 'SQL', current: 4, target: 5 },
    { id: 'custom', name: 'My skill', current: 2, target: 3 },
  ]);
  assert.equal(skills.find((item) => item.id === 'core-sql').current, 4);
  assert.equal(skills.find((item) => item.id === 'core-excel').current, null);
  assert.ok(skills.some((item) => item.name === 'My skill'));
});

test('combined roadmap migration keeps custom milestones and self-reported status', () => {
  const learningPlan = mergeLearningPlan(
    [{ id: 'learn-sql', status: 'In progress', targetDate: '2027-01-01', notes: 'Practice joins' }],
    [{ id: 'my-milestone', title: 'My saved goal', done: false, detail: 'Custom detail' }],
  );
  assert.equal(learningPlan.find((item) => item.id === 'learn-sql').status, 'In progress');
  assert.equal(learningPlan.find((item) => item.id === 'learn-sql').targetDate, '2027-01-01');
  assert.equal(learningPlan.find((item) => item.id === 'my-milestone').skill, 'My saved goal');
  assert.equal(learningPlan.find((item) => item.id === 'my-milestone').notes, 'Custom detail');
  assert.equal(learningPlan.find((item) => item.id === 'my-milestone').status, 'Not started');
});

test('only known old roadmap samples are removed', () => {
  const result = removeLegacyRoadmapSamples([
    { id: 1, title: 'Refresh portfolio case study' },
    { id: 4, title: 'Prepare a personal goal' },
  ]);
  assert.deepEqual(result.map((item) => item.title), ['Prepare a personal goal']);
});