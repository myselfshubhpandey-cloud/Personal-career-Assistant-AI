import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeImportedData } from './data-transfer.js';

test('import merges records without removing existing saved data', () => {
  const current = {
    profile: { name: 'A User', role: 'Analyst' },
    applications: [{ id: 1, company: 'Northwind', role: 'Analyst', stage: 'Interviewing' }],
    roadmap: [{ id: 'sql', skill: 'SQL', status: 'Done', done: true }],
    letters: [{ id: 11, company: 'Northwind', body: 'Existing draft' }],
  };
  const imported = {
    profile: { name: '', city: 'Toronto' },
    applications: [{ id: 1, company: 'Northwind', role: 'Analyst', stage: 'Applied' }, { id: 2, company: 'Contoso', role: 'Associate' }],
    roadmap: [{ id: 'sql', skill: 'SQL', status: 'In progress', done: false }, { id: 'excel', skill: 'Excel' }],
    letters: [{ id: 12, company: 'Contoso', body: 'New draft' }],
  };
  const merged = mergeImportedData(current, imported);
  assert.deepEqual(merged.profile, { name: 'A User', role: 'Analyst', city: 'Toronto' });
  assert.equal(merged.applications.length, 2);
  assert.equal(merged.applications[0].stage, 'Applied');
  assert.equal(merged.roadmap.length, 2);
  assert.equal(merged.roadmap[0].status, 'Done');
  assert.equal(merged.letters.length, 2);
});

test('import deduplicates applications by company, role, and posting URL', () => {
  const merged = mergeImportedData(
    { applications: [{ id: 1, company: 'Northwind', role: 'Analyst', jobUrl: 'https://jobs.example/1', stage: 'Researching' }] },
    { applications: [
      { id: 2, company: 'Northwind', role: 'Analyst', jobUrl: 'https://jobs.example/1', stage: 'Applied' },
      { id: 3, company: 'Northwind', role: 'Analyst', jobUrl: 'https://jobs.example/2', stage: 'Researching' },
    ] },
  );
  assert.equal(merged.applications.length, 2);
  assert.equal(merged.applications[0].stage, 'Applied');
});

test('import rejects JSON that is not a Career Studio data object', () => {
  assert.throws(() => mergeImportedData({}, []), /JSON object/);
  assert.throws(() => mergeImportedData({}, { unrelated: true }), /Career Studio data/);
});
