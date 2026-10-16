import { normalizeJobStage } from './job-planning.js';

export const JOB_CSV_COLUMNS = [
  ['title', 'Job title'],
  ['company', 'Company'],
  ['stage', 'Status'],
  ['location', 'Location'],
  ['mode', 'Work mode'],
  ['employmentType', 'Employment type'],
  ['experienceLevel', 'Experience level'],
  ['source', 'Source'],
  ['jobUrl', 'Job URL'],
  ['lastChecked', 'Last checked'],
  ['sourceVerified', 'Source reviewed by me'],
  ['deadline', 'Verified deadline'],
  ['salary', 'Verified salary'],
  ['requiredSkills', 'Required skills'],
  ['notes', 'Notes'],
  ['createdAt', 'Added on'],
];

// Spreadsheet apps treat cells starting with = + - @ (or tab/CR) as formulas.
// Prefixing an apostrophe keeps pasted job text from running as a formula.
export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function jobRow(job) {
  return {
    title: job.title,
    company: job.company,
    stage: normalizeJobStage(job.stage),
    location: [job.city, job.region, job.country].filter(Boolean).join(', '),
    mode: job.mode,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    source: job.source,
    jobUrl: job.jobUrl,
    lastChecked: job.lastChecked,
    sourceVerified: job.sourceVerified ? 'Yes' : 'No',
    deadline: job.deadlineVerified ? job.deadline : '',
    salary: job.salaryVerified && job.currency
      ? `${job.salaryMinimum || ''}-${job.salaryMaximum || ''} ${job.currency}`.trim()
      : '',
    requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills.join('; ') : job.requiredSkills,
    notes: job.notes,
    createdAt: localDate(job.createdAt),
  };
}

// Uses the device's own time zone so "Added on" matches the date the user saw (IST in India).
function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value).slice(0, 10);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function jobsToCsv(jobs) {
  const rows = (Array.isArray(jobs) ? jobs : []).filter((job) => job && typeof job === 'object').map(jobRow);
  const header = JOB_CSV_COLUMNS.map(([, label]) => csvCell(label)).join(',');
  const body = rows.map((row) => JOB_CSV_COLUMNS.map(([key]) => csvCell(row[key])).join(','));
  return [header, ...body].join('\r\n');
}

export function downloadJobsCsv(jobs) {
  // Byte-order mark helps Excel and Numbers read the ₹ symbol and other UTF-8 text correctly.
  const file = new Blob(['﻿', jobsToCsv(jobs)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `career-studio-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
