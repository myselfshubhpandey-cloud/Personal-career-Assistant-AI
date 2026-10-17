import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildListing,
  classifyGeography,
  classifyRole,
  classifyWorkplace,
  detectSkills,
  estimateMatch,
  extractExperience,
  filterListings,
  findDuplicates,
  htmlToText,
  isRelevant,
  listingToJob,
  mergeSourceListings,
  parseJobUrl,
  trimListings,
} from './discovery.js';
import { FeedError, fetchAshby, fetchGreenhouse, fetchGreenhouseJob, fetchRemotive, minutesUntilAllowed } from './feeds.js';

const NOW = '2026-10-17T02:00:00.000Z';

function listing(overrides = {}) {
  return buildListing({
    sourceType: 'greenhouse', sourceKey: 'acme', sourceLabel: 'Acme', externalId: '1',
    title: 'Business Analyst', company: 'Acme', location: 'Bengaluru, India', workplaceRaw: {},
    officialUrl: 'https://job-boards.greenhouse.io/acme/jobs/1', applyUrl: 'https://job-boards.greenhouse.io/acme/jobs/1',
    postedAt: '2026-10-10T00:00:00Z', descriptionHtml: '<p>We want a fresher with Excel and SQL. MBA preferred.</p>', checkedAt: NOW,
    ...overrides,
  });
}

test('htmlToText strips tags and decodes Greenhouse-style encoded HTML without running it', () => {
  const encoded = '&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;ul&gt;&lt;li&gt;SQL&lt;/li&gt;&lt;li&gt;Excel&lt;/li&gt;&lt;/ul&gt;&lt;script&gt;alert(1)&lt;/script&gt;';
  const value = htmlToText(encoded);
  assert.match(value, /Hello & welcome/);
  assert.match(value, /- SQL\n- Excel/);
  assert.doesNotMatch(value, /alert|<|script/);
  assert.equal(htmlToText('x'.repeat(50), 10), 'xxxxxxxxxx...');
});

test('role classification follows the requested priorities and flags senior titles', () => {
  assert.equal(classifyRole('Business Analyst').family.key, 'primary');
  assert.equal(classifyRole('Junior Data Analyst - Gurugram').family.key, 'primary');
  assert.equal(classifyRole('Product Analyst').family.key, 'secondary');
  assert.equal(classifyRole('Associate Product Manager').family.key, 'secondary');
  assert.equal(classifyRole('Associate Product Manager').senior, false);
  assert.equal(classifyRole('Operations Associate').family.key, 'additional');
  assert.equal(classifyRole('Financial Analyst, FP&A').family.key, 'additional');
  assert.equal(classifyRole('Senior Data Analyst').senior, true);
  assert.equal(classifyRole('Software Engineer').family, null);
});

test('workplace and geography classification keep India and genuinely open remote roles', () => {
  assert.equal(classifyWorkplace({ workplaceType: 'Hybrid' }), 'Hybrid');
  assert.equal(classifyWorkplace({ isRemote: true }), 'Remote');
  assert.equal(classifyWorkplace({ location: 'Mumbai' }), 'Not stated');
  assert.equal(classifyGeography('Gurgaon, Haryana', 'Not stated').key, 'india');
  assert.equal(classifyGeography('Remote - India', 'Remote').key, 'india');
  assert.equal(classifyGeography('Remote - Worldwide', 'Remote').key, 'remote-open');
  assert.equal(classifyGeography('Remote - APAC', 'Remote').key, 'remote-open');
  assert.equal(classifyGeography('Remote - US', 'Remote').key, 'remote-restricted');
  assert.equal(classifyGeography('Remote', 'Remote').key, 'remote-unclear');
  assert.equal(classifyGeography('London, UK', 'On-site').key, 'other');
});

test('experience extraction reads the listing wording and keeps evidence quotes', () => {
  const fresher = extractExperience('Business Analyst', 'Freshers welcome. 0-1 years of experience. MBA from a recognised institute.');
  assert.equal(fresher.level, 'Entry / fresher / intern');
  assert.equal(fresher.minYears, 0);
  assert.ok(fresher.evidence.some((line) => line.includes('Freshers welcome')));
  assert.ok(fresher.education.some((line) => line.includes('MBA')));
  assert.equal(extractExperience('Data Analyst', 'You have 3+ years in analytics.').level, '2 to 5 years');
  assert.equal(extractExperience('Data Analyst', 'At least 6 years of experience.').level, '5+ years');
  assert.equal(extractExperience('Data Analyst', 'Great team.').level, 'Not stated');
  assert.equal(extractExperience('Data Analyst Intern', '').level, 'Entry / fresher / intern');
  assert.equal(extractExperience('Analyst', 'Internal tools team. 1-2 years experience.').level, 'Up to 2 years', '"internal" is not "intern"');
});

test('skills are detected as whole words only', () => {
  assert.deepEqual(detectSkills('Strong SQL, Excel and Power BI. Financial modeling a plus.'), ['Excel', 'SQL', 'Power BI', 'financial modelling']);
  assert.deepEqual(detectSkills('Rapid growth'), [], 'R is not detected inside other words');
});

test('relevance requires a target role and India or remote geography', () => {
  assert.equal(isRelevant(listing()), true);
  assert.equal(isRelevant(listing({ title: 'Software Engineer' })), false);
  assert.equal(isRelevant(listing({ location: 'Austin, US' })), false);
  assert.equal(isRelevant(listing({ location: 'Remote - US', workplaceRaw: { isRemote: true } })), false);
});

test('merging keeps saved and recent listings when they disappear, and never touches other sources', () => {
  const old = listing();
  const other = listing({ sourceKey: 'beta', externalId: '9', company: 'Beta' });
  const saved = { ...listing({ externalId: '2' }), savedJobId: 42 };
  const fresh = [listing({ externalId: '3', checkedAt: '2026-10-18T00:00:00.000Z' })];
  const merged = mergeSourceListings([old, other, saved], fresh, 'greenhouse', 'acme', '2026-10-18T00:00:00.000Z');
  const byId = Object.fromEntries(merged.map((item) => [item.id, item]));
  assert.equal(byId[old.id].stillListed, false);
  assert.equal(byId[saved.id].savedJobId, 42);
  assert.equal(byId[other.id].stillListed, true);
  assert.ok(byId['greenhouse:acme:3']);
  const relisted = mergeSourceListings(merged, [listing({ checkedAt: '2026-10-19T00:00:00.000Z' })], 'greenhouse', 'acme', '2026-10-19T00:00:00.000Z');
  const back = relisted.find((item) => item.id === old.id);
  assert.equal(back.stillListed, true);
  assert.equal(back.discoveredAt, NOW, 'first discovery date is preserved');
  const later = mergeSourceListings([old], [], 'greenhouse', 'acme', '2026-12-31T00:00:00.000Z');
  assert.equal(later.length, 0, 'old unsaved listings are dropped after 30 days');
});

test('trimListings caps storage but always keeps saved listings', () => {
  const many = Array.from({ length: 10 }, (_, index) => ({ id: `x${index}`, lastCheckedAt: `2026-10-${String(index + 10).padStart(2, '0')}`, savedJobId: index === 0 ? 1 : undefined }));
  const trimmed = trimListings(many, 3);
  assert.equal(trimmed.length, 3);
  assert.ok(trimmed.some((item) => item.id === 'x0'));
  assert.ok(trimmed.some((item) => item.id === 'x9'));
});

test('duplicates are detected across sources and against the tracker', () => {
  const first = listing();
  const sameUrl = listing({ sourceType: 'ashby', sourceKey: 'acme', externalId: 'a', officialUrl: 'https://job-boards.greenhouse.io/acme/jobs/1?utm=x', checkedAt: '2026-10-17T03:00:00.000Z' });
  const sameTitle = listing({ sourceType: 'remotive', sourceKey: 'data', externalId: 'r', title: 'Business Analyst (Remote)', location: 'Bangalore', officialUrl: 'https://remotive.com/x', checkedAt: '2026-10-17T04:00:00.000Z' });
  const { duplicates, inTracker } = findDuplicates([first, sameUrl, sameTitle], [{ id: 7, company: 'acme', title: 'business analyst', jobUrl: '' }]);
  assert.equal(duplicates[sameUrl.id].duplicateOf, first.id);
  assert.equal(duplicates[sameUrl.id].reason, 'Same job link');
  assert.equal(duplicates[sameTitle.id].duplicateOf, first.id);
  assert.equal(duplicates[first.id], undefined);
  assert.equal(inTracker[first.id], 7);
});

test('estimated match uses confirmed facts only and lists skills to learn', () => {
  const item = listing();
  const none = estimateMatch(item, {});
  assert.deepEqual(none.skillsYouHave, []);
  assert.deepEqual(none.skillsToLearn, ['Excel', 'SQL']);
  const some = estimateMatch(item, { confirmedSkills: ['SQL'], educationText: 'MBA Operations and Marketing' });
  assert.deepEqual(some.skillsYouHave, ['SQL']);
  assert.deepEqual(some.skillsToLearn, ['Excel']);
  assert.ok(some.score > none.score);
  assert.ok(some.reasons.some((reason) => reason.includes('MBA')));
  const stretch = estimateMatch(listing({ title: 'Senior Data Analyst', descriptionHtml: '5+ years required' }), {});
  assert.ok(stretch.score < none.score);
  assert.ok(stretch.cautions.some((caution) => caution.includes('stretch')));
  const twoYears = estimateMatch(listing({ descriptionHtml: '1-2 years of experience' }), { hasConfirmedExperience: false });
  assert.ok(twoYears.cautions.some((caution) => caution.includes('not confirmed any experience')));
});

test('filters cover role, location, experience, remote status, source, duplicates and saved', () => {
  const a = listing();
  const b = listing({ sourceType: 'ashby', externalId: '2', title: 'Product Analyst', location: 'Remote - Worldwide', workplaceRaw: { isRemote: true }, descriptionHtml: '3 years experience' });
  const items = [{ listing: a, inTracker: 1 }, { listing: b, duplicate: { duplicateOf: a.id } }];
  assert.equal(filterListings(items, { role: 'secondary' }).length, 1);
  assert.equal(filterListings(items, { geography: 'india' })[0].listing.id, a.id);
  assert.equal(filterListings(items, { location: 'bengaluru' }).length, 1);
  assert.equal(filterListings(items, { experience: '2 to 5 years' })[0].listing.id, b.id);
  assert.equal(filterListings(items, { workplace: 'Remote' }).length, 1);
  assert.equal(filterListings(items, { source: 'ashby' }).length, 1);
  assert.equal(filterListings(items, { hideDuplicates: true }).length, 1);
  assert.equal(filterListings(items, { hideSaved: true }).length, 1);
  assert.equal(filterListings(items, { query: 'product' }).length, 1);
});

test('saving a listing creates an honest tracker record', () => {
  const job = listingToJob(listing(), NOW);
  assert.equal(job.title, 'Business Analyst');
  assert.equal(job.city, 'Bengaluru');
  assert.equal(job.country, 'India');
  assert.equal(job.jobUrl, 'https://job-boards.greenhouse.io/acme/jobs/1');
  assert.equal(job.source, 'Greenhouse employer feed (Acme)');
  assert.equal(job.sourceVerified, false, 'the user still confirms the listing at source');
  assert.equal(job.experienceLevel, 'Fresher');
  assert.equal(job.stage, 'Saved');
  assert.equal(job.salaryVerified, false);
});

test('pasted links are recognised; unsupported sites fall back to manual entry', () => {
  assert.deepEqual(parseJobUrl('https://job-boards.greenhouse.io/acme/jobs/12345'), { kind: 'greenhouse-job', token: 'acme', jobId: '12345', url: 'https://job-boards.greenhouse.io/acme/jobs/12345' });
  assert.equal(parseJobUrl('https://boards.greenhouse.io/acme').kind, 'greenhouse-board');
  assert.equal(parseJobUrl('https://boards.greenhouse.io/embed/job_app?for=acme&token=55').jobId, '55');
  assert.equal(parseJobUrl('https://careers.acme.com/jobs?gh_jid=77').kind, 'greenhouse-vanity');
  assert.equal(parseJobUrl('https://jobs.ashbyhq.com/Acme/0b8c2f9e-1234-4abc-9def-1234567890ab').kind, 'ashby-job');
  assert.equal(parseJobUrl('https://jobs.ashbyhq.com/Acme').kind, 'ashby-board');
  assert.equal(parseJobUrl('https://jobs.lever.co/acme/abc').kind, 'lever');
  assert.equal(parseJobUrl('https://www.linkedin.com/jobs/view/1').sourceName, 'LinkedIn (opened manually)');
  assert.equal(parseJobUrl('https://www.naukri.com/job-listings-x').sourceName, 'Naukri');
  assert.equal(parseJobUrl('https://careers.example.in/role/1').sourceName, 'Company careers page (careers.example.in)');
  assert.equal(parseJobUrl('javascript:alert(1)').kind, 'invalid');
  assert.equal(parseJobUrl('not a url').kind, 'invalid');
});

function mockFetch(responses) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const reply = typeof responses === 'function' ? responses(url) : responses;
    if (reply instanceof Error) throw reply;
    return { ok: reply.status === 200, status: reply.status, json: async () => { if (reply.body === 'bad') throw new SyntaxError('bad'); return reply.body; } };
  };
  return { fetchImpl, calls };
}

test('Greenhouse adapter reads the official board feed', async () => {
  const { fetchImpl, calls } = mockFetch({ status: 200, body: { jobs: [
    { id: 1, title: 'Business Analyst', location: { name: 'Pune, India' }, absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/1', updated_at: '2026-10-01T00:00:00Z', content: '&lt;p&gt;Freshers, Excel&lt;/p&gt;' },
    { id: 2, title: 'Backend Engineer', location: { name: 'Pune' }, absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/2' },
    { title: 'missing id' },
  ] } });
  const result = await fetchGreenhouse({ token: 'acme', label: 'Acme' }, NOW, { fetchImpl });
  assert.equal(calls[0], 'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true');
  assert.equal(result.total, 3);
  assert.equal(result.listings.length, 2);
  assert.equal(result.listings[0].company, 'Acme');
  assert.equal(result.listings[0].experience.level, 'Entry / fresher / intern');
  assert.deepEqual(result.listings.filter(isRelevant).map((item) => item.title), ['Business Analyst']);
});

test('adapters turn failures into clear errors', async () => {
  await assert.rejects(fetchGreenhouse({ token: 'acme' }, NOW, mockFetch({ status: 404 })), (error) => error instanceof FeedError && error.kind === 'not-found');
  await assert.rejects(fetchGreenhouse({ token: 'acme' }, NOW, mockFetch({ status: 429 })), /slow down/);
  await assert.rejects(fetchGreenhouse({ token: 'acme' }, NOW, mockFetch({ status: 500 })), /HTTP 500/);
  await assert.rejects(fetchGreenhouse({ token: 'acme' }, NOW, mockFetch({ status: 200, body: 'bad' })), /not job data/);
  await assert.rejects(fetchGreenhouse({ token: 'acme' }, NOW, mockFetch({ status: 200, body: { nope: true } })), /unexpected format/);
  await assert.rejects(fetchGreenhouse({ token: '../etc' }, NOW, mockFetch({ status: 200, body: {} })), /unexpected characters/);
  await assert.rejects(fetchAshby({ token: 'Acme' }, NOW, mockFetch(new TypeError('Failed to fetch'))), /Ashby did not allow/);
  await assert.rejects(fetchGreenhouseJob('acme', 'abc', '', NOW, mockFetch({ status: 200, body: {} })), /unexpected job number/);
});

test('Ashby adapter skips unlisted jobs and maps workplace type', async () => {
  const { fetchImpl } = mockFetch({ status: 200, body: { jobs: [
    { id: 'u1', title: 'Data Analyst', location: 'Remote', isRemote: true, workplaceType: 'Remote', isListed: true, jobUrl: 'https://jobs.ashbyhq.com/acme/u1', applyUrl: 'https://jobs.ashbyhq.com/acme/u1/application', publishedAt: '2026-10-02T00:00:00Z', employmentType: 'FullTime', descriptionPlain: 'Remote within India. SQL.', address: { postalAddress: { addressCountry: 'India' } } },
    { id: 'u2', title: 'Business Analyst', location: 'Hyderabad', isListed: false, jobUrl: 'https://jobs.ashbyhq.com/acme/u2' },
  ] } });
  const result = await fetchAshby({ token: 'acme', label: 'Acme' }, NOW, { fetchImpl });
  assert.equal(result.listings.length, 1);
  assert.equal(result.listings[0].workplace, 'Remote');
  assert.equal(result.listings[0].geography, 'india');
  assert.equal(result.listings[0].applyUrl, 'https://jobs.ashbyhq.com/acme/u1/application');
});

test('Remotive adapter applies the 24-hour delay from its terms', async () => {
  const { fetchImpl, calls } = mockFetch({ status: 200, body: { jobs: [
    { id: 1, title: 'Data Analyst', company_name: 'Remote Co', candidate_required_location: 'Worldwide', publication_date: '2026-10-15T00:00:00', url: 'https://remotive.com/remote-jobs/data/1', description: '<p>SQL</p>' },
    { id: 2, title: 'Data Analyst', company_name: 'New Co', candidate_required_location: 'Worldwide', publication_date: '2026-10-17T01:00:00Z', url: 'https://remotive.com/remote-jobs/data/2', description: '' },
  ] } });
  const result = await fetchRemotive({ token: 'data' }, NOW, { fetchImpl });
  assert.equal(calls[0], 'https://remotive.com/api/remote-jobs?category=data');
  assert.equal(result.listings.length, 1);
  assert.equal(result.listings[0].geography, 'remote-open');
});

test('sources are not re-checked too often', () => {
  const now = new Date(NOW).getTime();
  assert.equal(minutesUntilAllowed({ type: 'greenhouse' }, now), 0);
  assert.equal(minutesUntilAllowed({ type: 'greenhouse', lastStatus: 'ok', lastCheckedAt: new Date(now - 10 * 60000).toISOString() }, now), 20);
  assert.equal(minutesUntilAllowed({ type: 'greenhouse', lastStatus: 'error', lastCheckedAt: new Date(now - 10 * 60000).toISOString() }, now), 0, 'failed checks can be retried');
  assert.equal(minutesUntilAllowed({ type: 'remotive', lastStatus: 'ok', lastCheckedAt: new Date(now - 60 * 60000).toISOString() }, now), 300);
  assert.equal(minutesUntilAllowed({ type: 'ashby', rateLimitedAt: new Date(now - 60 * 60000).toISOString() }, now), 120);
});
