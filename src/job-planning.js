export const PRIORITY_FAMILIES = [
  {
    priority: 1,
    label: 'Business & data analytics',
    roles: ['Business Analyst', 'Business Analytics Associate', 'Junior Business Analyst', 'Data Analyst', 'Reporting Analyst', 'MIS Analyst', 'BI Analyst', 'Analytics Trainee'],
  },
  {
    priority: 2,
    label: 'Product & product operations',
    roles: ['Product Analyst', 'Product Operations Associate', 'Associate Product Manager', 'Junior Product Manager (entry-level)', 'Product Operations Analyst', 'AI Product roles'],
  },
  {
    priority: 3,
    label: 'Operations & business management',
    roles: ['Operations Analyst', 'Business Operations Associate', 'Process Analyst', 'Program Coordinator', 'Management Trainee', 'Supply Chain Analyst', 'Operations Excellence'],
  },
  {
    priority: 4,
    label: 'Marketing & growth',
    roles: ['Marketing Analyst', 'Marketing Operations Associate', 'Growth Analyst', 'CRM Analyst', 'Customer Insights Analyst', 'Digital Marketing Analytics'],
  },
  {
    priority: 5,
    label: 'Technology, FinTech & financial analytics',
    roles: ['Technology Business Analyst', 'FinTech Analyst', 'Business Systems Analyst', 'Risk Analyst', 'Financial Analyst', 'Implementation Associate', 'Product Support Analyst'],
  },
  {
    priority: 6,
    label: 'Healthcare & other industries',
    roles: ['Healthcare Business Analyst', 'Hospital Operations Analyst', 'Healthcare Operations Associate', 'Healthcare Reporting Analyst', 'Retail, e-commerce, consulting, BFSI, SaaS, manufacturing roles'],
  },
];

export const INDUSTRIES = [
  'Consulting', 'BFSI', 'FinTech', 'SaaS / Technology', 'Healthcare', 'Retail', 'E-commerce',
  'Manufacturing', 'Supply chain / Logistics', 'Education', 'Public sector', 'Other',
];

export const EXPERIENCE_OPTIONS = [
  'Internship', 'Graduate programme', 'Campus placement', 'Fresher', '0-2 years', '2-5 years', '5+ years', 'Unknown',
];

export const CHECKLIST_ITEMS = [
  ['educationEquivalency', 'Education equivalency'],
  ['workAuthorization', 'Work authorization'],
  ['visaSponsorship', 'Visa sponsorship'],
  ['languageRequirements', 'Language requirements'],
  ['timeZoneExpectations', 'Time-zone expectations'],
  ['relocationNeeds', 'Relocation needs'],
];

const skillTerms = [
  'Excel', 'SQL', 'business metrics', 'dashboards', 'Power BI', 'Tableau', 'Looker Studio',
  'communication', 'stakeholder management', 'structured problem-solving', 'requirements gathering',
  'product documentation', 'market research', 'process improvement', 'forecasting', 'supply chain',
  'CRM', 'financial analysis', 'risk analysis', 'customer insights', 'Python', 'statistics',
];

function normalize(value = '') {
  return String(value).toLocaleLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}

export function priorityForRole(title = '', explicitPriority = '') {
  const titleText = normalize(title);
  if (explicitPriority && Number(explicitPriority) >= 1 && Number(explicitPriority) <= 6) return Number(explicitPriority);
  if (/healthcare|hospital/.test(titleText)) return 6;
  if (/technology business analyst|business systems analyst|fintech|financial analyst|risk analyst|implementation|product support/.test(titleText)) return 5;
  for (const family of PRIORITY_FAMILIES) {
    if (family.roles.some((role) => titleText.includes(normalize(role).replace(' (entry-level)', '')))) return family.priority;
  }
  const aliases = [
    ['analytics', 1], ['data analyst', 1], ['reporting', 1], ['business intelligence', 1],
    ['product', 2], ['operations', 3], ['process', 3], ['program coordinator', 3], ['supply chain', 3],
    ['marketing', 4], ['growth', 4], ['crm', 4], ['fintech', 5], ['risk analyst', 5], ['financial analyst', 5],
    ['healthcare', 6], ['hospital', 6], ['retail', 6], ['e-commerce', 6],
  ];
  return aliases.find(([term]) => titleText.includes(term))?.[1] ?? 6;
}

function evidence(text, pattern) {
  const found = [];
  for (const match of text.matchAll(pattern)) {
    const start = Math.max(0, match.index - 50);
    const end = Math.min(text.length, match.index + match[0].length + 70);
    const quote = text.slice(start, end).replace(/\s+/g, ' ').trim();
    if (!found.some((item) => item.toLowerCase() === quote.toLowerCase())) found.push(quote);
    if (found.length === 4) break;
  }
  return found;
}

export function analyzeJobDescription(description = '', profileSkills = []) {
  const text = String(description).trim();
  const lower = normalize(text);
  const matchedSkills = skillTerms.filter((term) => lower.includes(normalize(term)));
  const knownSkills = (Array.isArray(profileSkills)
    ? profileSkills
    : String(profileSkills?.skills || profileSkills || '').split(/[,;\n]/))
    .map((skill) => normalize(typeof skill === 'string' ? skill : skill?.name || ''))
    .filter(Boolean);
  const matchedProfileSkills = matchedSkills.filter((skill) => knownSkills.some((known) => known.includes(normalize(skill)) || normalize(skill).includes(known)));
  const missingSkills = matchedSkills.filter((skill) => !matchedProfileSkills.includes(skill));
  const yearEvidence = evidence(text, /\b(?:\d+\s*(?:-|to)\s*)?\d+\+?\s+years?\b/gi);
  const educationEvidence = evidence(text, /\b(?:MBA|master'?s degree|bachelor'?s degree|undergraduate degree|equivalent qualification)\b/gi);
  const authorizationEvidence = evidence(text, /\b(?:work authorization|right to work|legally authorized|must be authorized|authorized to work)\b/gi);
  const sponsorshipEvidence = evidence(text, /\b(?:visa sponsorship|sponsor(?:ship)? (?:is )?(?:available|provided|not available)|will sponsor)\b/gi);
  const remoteEvidence = evidence(text, /\b(?:remote|hybrid|on[- ]site|work from anywhere|must be located|remote within)\b/gi);
  const languageEvidence = evidence(text, /\b(?:English|Hindi|French|Spanish|German|Mandarin|Arabic|Japanese|Portuguese|Korean) language\b/gi);
  const deadlineEvidence = evidence(text, /\b(?:deadline|apply by|applications? close(?:s| on)?)\b.{0,45}\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi);
  const salaryEvidence = evidence(text, /\b(?:INR|USD|EUR|GBP|CAD|AUD|SGD|JPY)\s?\d[\d,.]*(?:\s?(?:-|to|–)\s?(?:INR|USD|EUR|GBP|CAD|AUD|SGD|JPY)?\s?\d[\d,.]*)?|[₹€£]\s?\d[\d,.]*/gi);
  const yearMatch = text.match(/\b(?:(\d+)\s*(?:-|to)\s*)?(\d+)\+?\s+years?\b/i);
  return {
    matchedSkills,
    matchedProfileSkills,
    missingSkills,
    experienceEvidence: yearEvidence,
    minimumYears: yearMatch ? Number(yearMatch[1] || yearMatch[2]) : null,
    educationEvidence,
    authorizationEvidence,
    sponsorshipEvidence,
    remoteEvidence,
    languageEvidence,
    deadlineEvidence,
    salaryEvidence,
  };
}

export function getJobFit(job, profile, assessedSkills = [], locationPreferences = []) {
  const priority = Number(job.priority) || priorityForRole(job.title);
  const priorityPoints = [24, 21, 18, 15, 12, 9][priority - 1] || 6;
  const experience = normalize(job.experienceLevel);
  const earlyCareer = /intern|graduate|campus|fresher|entry|0-2|junior|associate|trainee/.test(experience);
  const experiencePoints = earlyCareer ? 20 : experience === 'unknown' || !experience ? 10 : 2;

  const profileSkills = [
    ...(profile.skills || '').split(/[,;\n]/),
    ...assessedSkills.filter((skill) => skill.current !== null && skill.current !== undefined).map((skill) => skill.name),
  ].map(normalize).filter(Boolean);
  const requiredSkills = Array.isArray(job.requiredSkills)
    ? job.requiredSkills
    : String(job.requiredSkills || '').split(/[,;\n]/).filter(Boolean);
  const matches = requiredSkills.filter((required) => profileSkills.some((known) => known.includes(normalize(required)) || normalize(required).includes(known)));
  const skillPoints = requiredSkills.length ? Math.round(24 * matches.length / requiredSkills.length) : 10;

  const preferredLocation = locationPreferences.find((preference) => {
    const preferenceLocations = [
      preference.location,
      preference.country,
      preference.city,
    ].flatMap((location) => String(location || '').split(',')).map(normalize).filter(Boolean);
    const listingText = normalize([
      job.city,
      job.region,
      job.country,
      job.timeZone,
      job.remoteEligibleCountries,
    ].filter(Boolean).join(' '));
    const modeMatches = !preference.mode || normalize(preference.mode) === 'any' || normalize(preference.mode) === normalize(job.mode);
    return preferenceLocations.length > 0
      && preferenceLocations.every((location) => listingText.includes(location))
      && modeMatches;
  });
  const locationPoints = profile.relocationOpen === false
    ? 6
    : preferredLocation
      ? { 1: 16, 2: 14, 3: 12 }[Number(preferredLocation.priority)] || 12
      : locationPreferences.length ? 8 : 12;
  const checklist = job.eligibilityChecklist || {};
  const unresolved = CHECKLIST_ITEMS.map(([key]) => checklist[key] || 'unknown');
  const blocked = unresolved.includes('not-eligible');
  const verified = ['workAuthorization', 'visaSponsorship'].every((key) => checklist[key] === 'confirmed');
  const eligibilityPoints = blocked ? 0 : verified ? 10 : 5;

  const growthPoints = { strong: 10, some: 7, limited: 3, unknown: 5 }[normalize(job.growthSignal)] ?? 5;
  let deadlinePoints = 5;
  if (job.deadline && job.deadlineVerified) {
    const daysRemaining = Math.ceil((new Date(`${job.deadline}T23:59:59`).getTime() - Date.now()) / 86400000);
    deadlinePoints = daysRemaining < 0 ? 0 : daysRemaining <= 3 ? 10 : daysRemaining <= 14 ? 8 : 6;
  }

  const managerRole = /(?:product|ai) product manager|product manager/i.test(job.title || '');
  const statedYears = Number(job.minimumYears || analyzeJobDescription(job.description).minimumYears || 0);
  const stretch = managerRole && (statedYears > 2 || /2-5|5\+|senior|experienced/.test(experience));
  const total = priorityPoints + experiencePoints + skillPoints + locationPoints + eligibilityPoints + growthPoints + deadlinePoints;
  return {
    score: Math.min(100, total),
    priority,
    stretch,
    matches,
    requiredSkills,
    factors: {
      'Role priority': priorityPoints,
      'Early-career fit': experiencePoints,
      'Recorded skill match': skillPoints,
      'Location flexibility': locationPoints,
      'Eligibility verified': eligibilityPoints,
      'Growth signal': growthPoints,
      'Deadline': deadlinePoints,
    },
  };
}

export function filterJobListings(scoredJobs, filters = {}) {
  if (!Array.isArray(scoredJobs)) return [];
  const includes = (value, query) => !query || normalize(value).includes(normalize(query));
  return scoredJobs.filter(({ job, fit }) => {
    if (!job || typeof job !== 'object') return false;
    if (filters.role && !includes(job.title, filters.role) && !includes(job.company, filters.role)) return false;
    if (filters.priority && (fit?.priority ?? priorityForRole(job.title)) !== Number(filters.priority)) return false;
    if (filters.industry && !includes(job.industry, filters.industry)) return false;
    if (!includes(job.country, filters.country) || !includes(job.region, filters.region) || !includes(job.city, filters.city)) return false;
    if (!includes(job.timeZone, filters.timeZone)) return false;
    if (filters.mode && job.mode !== filters.mode) return false;
    if (filters.remoteCountry && !includes(job.remoteEligibleCountries, filters.remoteCountry)) return false;
    if (filters.experience && job.experienceLevel !== filters.experience) return false;
    if (filters.employmentType && job.employmentType !== filters.employmentType) return false;
    if (filters.authorization && job.workAuthorizationRequirement !== filters.authorization) return false;
    if (filters.sponsorship && job.visaSponsorship !== filters.sponsorship) return false;
    if ((filters.currency || filters.verifiedSalaryOnly || filters.minimumSalary || filters.maximumSalary) && !job.salaryVerified) return false;
    if (filters.currency && String(job.currency || '').toUpperCase() !== String(filters.currency).trim().toUpperCase()) return false;
    if (filters.minimumSalary && Number(job.salaryMaximum || 0) < Number(filters.minimumSalary)) return false;
    if (filters.maximumSalary && Number(job.salaryMinimum || 0) > Number(filters.maximumSalary)) return false;
    if (filters.deadlineBefore && (!job.deadlineVerified || !job.deadline || job.deadline > filters.deadlineBefore)) return false;
    return true;
  });
}

const applicationStageRank = {
  Researching: 0,
  Reviewing: 0,
  Saved: 0,
  Applied: 1,
  Interviewing: 2,
  Offer: 3,
  Closed: 4,
};

export function applicationStageForJob(stage) {
  if (stage === 'Reviewing' || stage === 'Saved') return 'Researching';
  return applicationStageRank[stage] === undefined ? 'Researching' : stage;
}

export function applicationStageToJob(stage) {
  return stage === 'Researching' ? 'Reviewing' : stage;
}

function applicationLocation(application) {
  return normalize([application.city, application.region, application.country].filter(Boolean).join(' '));
}

export function findJobApplication(job, applications) {
  return applications.find((application) => (
    application.jobId === job.id
    || (normalize(application.company) === normalize(job.company)
      && normalize(application.role) === normalize(job.title)
      && normalizedJobUrl(application.jobUrl) === normalizedJobUrl(job.jobUrl)
      && (!application.jobUrl || !job.jobUrl
        ? applicationLocation(application) === applicationLocation(job)
        : true))
  ));
}

function normalizedJobUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return normalize(value).replace(/\/+$/, '');
  }
}

export function upsertJobApplication(job, applications, id = Date.now(), date = new Date().toISOString().slice(0, 10)) {
  const existing = findJobApplication(job, applications);
  const existingIndex = existing ? applications.indexOf(existing) : -1;
  const requestedStage = applicationStageForJob(job.stage);
  const stage = existing && applicationStageRank[existing.stage] > applicationStageRank[requestedStage]
    ? existing.stage
    : requestedStage;
  const application = {
    ...existing,
    id: existing?.id ?? id,
    company: job.company,
    role: job.title,
    stage,
    date: existing?.date ?? date,
    country: job.country || existing?.country || '',
    region: job.region || existing?.region || '',
    city: job.city || existing?.city || '',
    jobUrl: job.jobUrl || existing?.jobUrl || '',
    jobId: job.id,
    isDemo: false,
  };
  const nextApplications = existingIndex >= 0
    ? applications.map((item, index) => index === existingIndex ? application : item)
    : [application, ...applications];
  return { application, applications: nextApplications, alreadyTracked: Boolean(existing) };
}

export function buildJobSearchQuery(roleFilter = '', priorityFilter = '') {
  if (roleFilter && roleFilter.trim()) return roleFilter.trim();
  if (priorityFilter && Number(priorityFilter) >= 1 && Number(priorityFilter) <= 6) {
    const family = PRIORITY_FAMILIES.find((item) => item.priority === Number(priorityFilter));
    if (family) return family.roles.slice(0, 5).join(' OR ');
  }
  return 'Business Analyst OR Business Analytics Associate OR Product Analyst OR Associate Product Manager OR Operations Analyst OR Marketing Analyst OR FinTech Analyst OR Healthcare Business Analyst';
}

export function externalJobSearches(query, country, city) {
  const search = [query, city, country].filter(Boolean).join(' ');
  const location = [city, country].filter(Boolean).join(', ');
  const linkedIn = new URL('https://www.linkedin.com/jobs/search/');
  linkedIn.searchParams.set('keywords', search || 'Business Analyst Product Analyst Associate Product Manager');
  if (location) linkedIn.searchParams.set('location', location);
  const indeed = new URL('https://www.indeed.com/jobs');
  indeed.searchParams.set('q', search || 'Business Analyst Product Analyst Associate Product Manager');
  if (location) indeed.searchParams.set('l', location);
  const google = new URL('https://www.google.com/search');
  google.searchParams.set('q', `${search || 'Business Analyst Product Analyst Associate Product Manager'} jobs openings`);
  return [
    { label: 'LinkedIn Jobs (manual research)', href: linkedIn.toString() },
    { label: 'Indeed (manual research)', href: indeed.toString() },
    { label: 'Google Jobs search (manual research)', href: google.toString() },
  ];
}