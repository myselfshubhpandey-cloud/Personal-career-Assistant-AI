import { findJobApplication } from './job-planning.js';

const collectionKeys = [
  'jobs',
  'locationPreferences',
  'learningPlan',
  'letters',
  'research',
  'posts',
  'imagePrompts',
  'skills',
  'roadmap',
];

function mergeRecords(existingRecords, importedRecords, key) {
  const merged = Array.isArray(existingRecords) ? [...existingRecords] : [];
  if (!Array.isArray(importedRecords)) return merged;
  for (const imported of importedRecords) {
    if (!imported || typeof imported !== 'object' || Array.isArray(imported)) continue;
    const matchIndex = key === 'applications'
      ? merged.findIndex((saved) => saved && typeof saved === 'object' && findJobApplication(
        { ...imported, title: imported.role || imported.title },
        [saved],
      ))
      : merged.findIndex((saved) => saved && typeof saved === 'object'
        && saved.id !== undefined && imported.id !== undefined
        && String(saved.id) === String(imported.id));
    if (matchIndex < 0) {
      merged.push(imported);
      continue;
    }
    const saved = merged[matchIndex];
    const combined = { ...saved };
    for (const [field, value] of Object.entries(imported)) {
      if (value !== '' && value !== null && value !== undefined) combined[field] = value;
    }
    if (saved.status === 'Done') {
      combined.status = 'Done';
      combined.done = true;
    }
    merged[matchIndex] = combined;
  }
  return merged;
}

export function mergeImportedData(current, imported) {
  if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
    throw new Error('The selected file must contain a JSON object.');
  }
  const knownKeys = ['profile', 'resume', 'prep', 'applications', ...collectionKeys];
  if (!knownKeys.some((key) => Object.hasOwn(imported, key))) {
    throw new Error('The JSON file does not contain Career Studio data.');
  }

  const merged = { ...current };
  for (const key of ['profile', 'resume', 'prep']) {
    if (!imported[key] || typeof imported[key] !== 'object' || Array.isArray(imported[key])) continue;
    merged[key] = { ...(current[key] || {}) };
    for (const [field, value] of Object.entries(imported[key])) {
      if (value !== '' && value !== null && value !== undefined) merged[key][field] = value;
    }
    if (key === 'prep' && Array.isArray(current.prep?.checks) && Array.isArray(imported.prep.checks)) {
      merged.prep.checks = current.prep.checks.map((checked, index) => Boolean(checked || imported.prep.checks[index]));
    }
  }
  merged.applications = mergeRecords(current.applications, imported.applications, 'applications');
  for (const key of collectionKeys) {
    merged[key] = mergeRecords(current[key], imported[key], key);
  }
  return merged;
}
