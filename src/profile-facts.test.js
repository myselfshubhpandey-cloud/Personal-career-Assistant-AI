import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoverLetterDraft,
  buildResumeDraft,
  compareJobSkills,
  confirmedSkillNames,
  emptyFact,
  normalizeFacts,
  unconfirmedCount,
} from './profile-facts.js';
import { mergeImportedData } from './data-transfer.js';

const facts = normalizeFacts({
  education: [
    { id: 'e1', qualification: 'MBA, Operations and Marketing', institution: 'Example Institute', dates: '2025 to 2027 (expected)', confirmed: true },
    { id: 'e2', qualification: 'Unverified diploma', confirmed: false },
  ],
  experience: [],
  skills: [
    { id: 's1', name: 'Excel', level: 'Comfortable', confirmed: true },
    { id: 's2', name: 'SQL', level: 'Learning', confirmed: true },
    { id: 's3', name: 'Python', level: 'Confident', confirmed: false },
  ],
  projects: [{ id: 'p1', name: 'Career tracker app', details: 'Built a job tracker for my own search', confirmed: true }],
  achievements: [{ id: 'a1', title: 'Made-up award', confirmed: false }],
});

test('normalizeFacts keeps only safe records and strict confirmation', () => {
  const result = normalizeFacts({ skills: [null, 'bad', { name: 'Excel', confirmed: 'yes', level: 'Expert' }] });
  assert.equal(result.skills.length, 1);
  assert.equal(result.skills[0].confirmed, false, 'only boolean true confirms');
  assert.equal(result.skills[0].level, 'Learning', 'unknown levels fall back to the lowest honest level');
  assert.deepEqual(result.projects, []);
  assert.deepEqual(normalizeFacts('nonsense').education, []);
});

test('old free-text profile fields migrate as unconfirmed entries only once', () => {
  const migrated = normalizeFacts(undefined, { education: 'MBA', expectedGraduation: '2027', skills: 'Excel, SQL' });
  assert.equal(migrated.education[0].qualification, 'MBA');
  assert.equal(migrated.education[0].dates, 'Expected 2027');
  assert.equal(migrated.education[0].confirmed, false);
  assert.deepEqual(migrated.skills.map((skill) => [skill.name, skill.confirmed]), [['Excel', false], ['SQL', false]]);
  const alreadyStructured = normalizeFacts({ education: [] }, { education: 'MBA' });
  assert.equal(alreadyStructured.education.length, 0, 'no re-migration once structured facts exist');
});

test('emptyFact starts unconfirmed with all fields present', () => {
  const fact = emptyFact('skills', 'x');
  assert.deepEqual(fact, { id: 'x', confirmed: false, name: '', level: 'Learning', evidence: '' });
});

test('resume draft uses only confirmed facts and shows placeholders for gaps', () => {
  const draft = buildResumeDraft({ name: 'Subham Pandey', email: 'me@example.com' }, facts);
  assert.match(draft.text, /SUBHAM PANDEY/);
  assert.match(draft.text, /MBA, Operations and Marketing \| Example Institute/);
  assert.match(draft.text, /Excel \(comfortable\), SQL \(learning\)/);
  assert.match(draft.text, /Career tracker app/);
  assert.doesNotMatch(draft.text, /Unverified diploma|Python|Made-up award/);
  assert.ok(draft.placeholders.some((item) => item.includes('summary')), 'unconfirmed summary becomes a placeholder');
  assert.ok(draft.placeholders.some((item) => item.includes('work experience')));
  assert.equal(draft.omittedUnconfirmed, 3);
  assert.doesNotMatch(draft.text, /—/, 'no em-dashes in generated text');
});

test('summary appears only after it is confirmed', () => {
  const profile = { name: 'A', headline: 'MBA student learning analytics.', summaryConfirmed: false };
  assert.doesNotMatch(buildResumeDraft(profile, facts).text, /learning analytics/);
  assert.match(buildResumeDraft({ ...profile, summaryConfirmed: true }, facts).text, /learning analytics/);
});

test('empty profile produces a draft made of placeholders, never invented facts', () => {
  const draft = buildResumeDraft({}, normalizeFacts({}));
  assert.match(draft.text, /\[Add your name in Career profile\]/);
  assert.ok(draft.placeholders.length >= 6);
  assert.doesNotMatch(draft.text, /ACHIEVEMENTS/, 'optional section is omitted when empty');
});

test('job skill comparison only counts confirmed skills', () => {
  const job = { title: 'Data Analyst', company: 'Acme', requiredSkills: ['SQL', 'Python', 'Power BI'] };
  const result = compareJobSkills(job, facts);
  assert.deepEqual(result.matched.map((skill) => skill.name), ['SQL']);
  assert.deepEqual(result.missing, ['Python', 'Power BI']);
  const tailored = buildResumeDraft({ name: 'A' }, facts, job);
  assert.match(tailored.text, /Target role: Data Analyst at Acme/);
  assert.match(tailored.text, /SKILLS\nSQL \(learning\), Excel/, 'matching skills listed first');
  assert.doesNotMatch(tailored.text, /Power BI/);
});

test('cover letter draft uses confirmed facts and flags missing ones', () => {
  const letter = buildCoverLetterDraft({ name: 'Subham Pandey' }, facts, { title: 'Data Analyst', company: 'Acme', requiredSkills: 'SQL, Python' });
  assert.match(letter.text, /Data Analyst role at Acme/);
  assert.match(letter.text, /MBA, Operations and Marketing at Example Institute/);
  assert.match(letter.text, /SQL \(learning\)/);
  assert.match(letter.text, /building Python/);
  assert.doesNotMatch(letter.text, /Python \(/, 'unconfirmed Python is never claimed');
  assert.match(letter.text, /Sincerely,\nSubham Pandey/);
  const blank = buildCoverLetterDraft({}, normalizeFacts({}), {});
  assert.match(blank.text, /\[job title\] role at \[company name\]/);
  assert.match(blank.text, /\[Your name\]/);
});

test('confirmed skill names and unconfirmed count', () => {
  assert.deepEqual(confirmedSkillNames(facts), ['Excel', 'SQL']);
  assert.equal(unconfirmedCount(facts), 3);
});

test('restoring a backup merges profile facts without deleting existing ones', () => {
  const current = { profile: {}, facts: { skills: [{ id: 's1', name: 'Excel', confirmed: true }], education: [] } };
  const merged = mergeImportedData(current, { facts: { skills: [{ id: 's1', name: 'Excel', level: 'Comfortable' }, { id: 's2', name: 'SQL' }] } });
  assert.equal(merged.facts.skills.length, 2);
  assert.equal(merged.facts.skills[0].confirmed, true);
  assert.equal(merged.facts.skills[0].level, 'Comfortable');
  assert.deepEqual(merged.facts.education, []);
});
