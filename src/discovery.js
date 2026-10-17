// Pure logic for the Job feeds module: normalising listings from free, official
// employer feeds, judging relevance, spotting duplicates and estimating a match.
// Nothing here fetches data or invents listings.

export const ROLE_FAMILIES = [
  {
    key: 'primary',
    label: 'Business & data analyst',
    tier: 'Primary',
    pattern: /\b(business analyst|data analyst|business intelligence|bi analyst|analytics (associate|analyst|trainee|intern)|reporting analyst|mis analyst|business analytics|data analytics (associate|intern|trainee)|junior analyst|analyst,? (business|data))\b/i,
  },
  {
    key: 'secondary',
    label: 'Product analyst & entry-level product',
    tier: 'Secondary',
    pattern: /\b(product analyst|associate product manager|apm|product management (intern|trainee|associate)|junior product manager|product (operations|ops) (associate|analyst)|product intern|product manager,? (entry|new grad|graduate))\b/i,
  },
  {
    key: 'additional',
    label: 'Operations, marketing, finance, fintech & healthcare',
    tier: 'Additional',
    pattern: /\b(operations (analyst|associate|executive|intern|trainee)|business operations|bizops|marketing (analyst|associate|intern)|growth analyst|financial analyst|finance analyst|fp&a|credit analyst|risk analyst|fintech|payments analyst|healthcare (business|operations|analyst)|revenue cycle analyst|strategy (analyst|associate)|management trainee|process analyst|supply chain analyst|category analyst|pricing analyst)\b/i,
  },
];

const SENIOR_PATTERN = /\b(senior|sr\.?|lead|principal|staff|head|director|vp|vice president|chief|manager ii|manager iii)\b/i;

const INDIA_PLACES = [
  'india', 'bengaluru', 'bangalore', 'mumbai', 'navi mumbai', 'delhi', 'new delhi', 'ncr', 'gurgaon', 'gurugram',
  'noida', 'ghaziabad', 'faridabad', 'hyderabad', 'pune', 'chennai', 'kolkata', 'ahmedabad', 'jaipur', 'kochi',
  'cochin', 'chandigarh', 'indore', 'coimbatore', 'thiruvananthapuram', 'trivandrum', 'bhubaneswar', 'lucknow',
  'nagpur', 'vadodara', 'mysuru', 'mysore', 'visakhapatnam', 'surat',
];
const INDIA_CITIES = INDIA_PLACES.filter((place) => place !== 'india' && place !== 'ncr');

function findCity(location) {
  const value = text(location).toLowerCase();
  return INDIA_CITIES.find((place) => new RegExp(`\\b${place.replace(/ /g, '\\s+')}\\b`).test(value)) || '';
}

const OPEN_REMOTE = /\b(worldwide|anywhere|global(ly)?|apac|asia|asia[- ]pacific|emea and apac|all countries|any location)\b/i;
const OTHER_COUNTRY = /\b(us|usa|u\.s\.|united states|canada|uk|united kingdom|europe|eu|germany|france|spain|netherlands|poland|ireland|portugal|brazil|mexico|latam|latin america|australia|new zealand|singapore|japan|philippines|south africa|nigeria|kenya|uae|dubai|israel|americas|north america|emea)\b/i;

export const SKILL_TERMS = [
  'Excel', 'Google Sheets', 'SQL', 'Power BI', 'Tableau', 'Looker', 'Looker Studio', 'Python', 'R programming',
  'statistics', 'A/B testing', 'Google Analytics', 'dashboards', 'data visualization', 'data analysis',
  'requirements gathering', 'user stories', 'JIRA', 'Confluence', 'process mapping', 'BPMN', 'stakeholder management',
  'communication', 'presentation', 'problem solving', 'financial modelling', 'financial modeling', 'forecasting',
  'budgeting', 'market research', 'CRM', 'Salesforce', 'SAP', 'ERP', 'supply chain', 'inventory', 'Agile', 'Scrum',
  'product analytics', 'Mixpanel', 'Amplitude', 'ETL', 'data modelling', 'data modeling', 'PowerPoint', 'VBA', 'DAX',
];

function text(value) {
  return value === null || value === undefined ? '' : String(value);
}

export function normalizeKey(value) {
  return text(value).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: '...', bull: '-' };

function decodeEntities(value) {
  return text(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(number) && number > 0 && number < 0x110000 ? String.fromCodePoint(number) : '';
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

// Converts (possibly entity-encoded) HTML from a feed into readable plain text.
// Tags are removed, never rendered, so feed content cannot run in the app.
export function htmlToText(html, maxLength = 6000) {
  let value = text(html);
  if (/&lt;\/?[a-z]/i.test(value)) value = decodeEntities(value);
  value = value
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|ul|ol|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  value = decodeEntities(value)
    .replace(/[ \t\f\v\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n+- /g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

export function classifyRole(title) {
  const value = text(title);
  const family = ROLE_FAMILIES.find((item) => item.pattern.test(value)) || null;
  const senior = SENIOR_PATTERN.test(value) && !/\bassociate product manager\b/i.test(value);
  return { family, senior };
}

export function classifyWorkplace(raw = {}) {
  const hint = `${text(raw.workplaceType)} ${raw.isRemote ? 'remote' : ''} ${text(raw.location)}`.toLowerCase();
  if (/hybrid/.test(hint)) return 'Hybrid';
  if (/remote|work from home|wfh/.test(hint)) return 'Remote';
  if (/on-?site|onsite|in[- ]office|office/.test(hint)) return 'On-site';
  return 'Not stated';
}

// India, remote roles plausibly open to India, or neither.
export function classifyGeography(location, workplace) {
  const value = text(location).toLowerCase();
  const inIndia = INDIA_PLACES.some((place) => new RegExp(`\\b${place.replace(/ /g, '\\s+')}\\b`, 'i').test(value));
  if (inIndia) return { key: 'india', label: 'India' };
  if (workplace === 'Remote') {
    if (OPEN_REMOTE.test(value)) return { key: 'remote-open', label: 'Remote, open internationally' };
    const stripped = value.replace(/\bremote\b|[-,/()|]/g, ' ').trim();
    if (!stripped) return { key: 'remote-unclear', label: 'Remote, country rules not stated' };
    if (OTHER_COUNTRY.test(value)) return { key: 'remote-restricted', label: 'Remote, limited to other countries' };
    return { key: 'remote-unclear', label: 'Remote, country rules not stated' };
  }
  return { key: 'other', label: 'Outside India' };
}

export const RELEVANT_GEOGRAPHY = ['india', 'remote-open', 'remote-unclear'];

function evidenceSentences(description, pattern, limit = 3) {
  const found = [];
  for (const sentence of text(description).split(/(?<=[.!?])\s+|\n+/)) {
    const trimmed = sentence.replace(/^[-\s]+/, '').trim();
    if (trimmed && pattern.test(trimmed) && !found.includes(trimmed)) found.push(trimmed.length > 220 ? `${trimmed.slice(0, 217)}...` : trimmed);
    if (found.length >= limit) break;
  }
  return found;
}

export const EXPERIENCE_LEVELS = ['Entry / fresher / intern', 'Up to 2 years', '2 to 5 years', '5+ years', 'Not stated'];

export function extractExperience(title, description) {
  const all = `${text(title)}\n${text(description)}`;
  const evidence = evidenceSentences(all, /\b(\d+\s*(\+|-|to|–)?\s*\d*\s*(\+)?\s*years?|freshers?|entry[- ]level|new grad|graduate (program|programme|trainee)|internship|intern\b|no (prior )?experience|0\s*-\s*\d\s*years?|batch of 20\d\d|20\d\d (batch|graduates?|pass[- ]?outs?))/i, 4);
  const yearMatches = [...all.matchAll(/\b(\d{1,2})\s*(?:\+|plus)?\s*(?:-|to|–)?\s*(\d{1,2})?\s*\+?\s*years?\b/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value <= 20);
  const minYears = yearMatches.length ? Math.min(...yearMatches) : null;
  let level = 'Not stated';
  if (/\b(intern|interns|internship|freshers?|entry[- ]level|new grads?|graduate trainee|trainees?|apprentice)\b/i.test(all) || minYears === 0) level = 'Entry / fresher / intern';
  else if (minYears !== null) level = minYears <= 2 ? 'Up to 2 years' : minYears < 5 ? '2 to 5 years' : '5+ years';
  if (minYears !== null && minYears >= 3 && level === 'Entry / fresher / intern') level = minYears < 5 ? '2 to 5 years' : '5+ years';
  const education = evidenceSentences(text(description), /\b(mba|pgdm|post[- ]?graduate|bachelor'?s?|master'?s?|degree|graduat(e|ion)|b\.?tech|b\.?com|bba)\b/i, 2);
  return { level, minYears, evidence, education };
}

export function detectSkills(description, title = '') {
  const value = ` ${text(title)} ${text(description)} `.toLowerCase();
  const found = [];
  for (const term of SKILL_TERMS) {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(value)) {
      const canonical = term.replace(/modeling$/i, 'modelling');
      if (!found.some((item) => item.toLowerCase() === canonical.toLowerCase())) found.push(canonical);
    }
  }
  return found;
}

function isoOrEmpty(value) {
  if (!value) return '';
  const date = new Date(typeof value === 'number' ? value : String(value));
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString();
}

function safeHttpUrl(value) {
  try {
    const url = new URL(text(value));
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

// Builds the stored listing record. Every field comes from the feed; nothing is guessed
// except the derived classifications, which are kept separate from the listing facts.
export function buildListing({ sourceType, sourceKey, sourceLabel, externalId, title, company, location, workplaceRaw, officialUrl, applyUrl, postedAt, employmentType, descriptionHtml, descriptionText, checkedAt }) {
  const description = descriptionText ? htmlToText(descriptionText) : htmlToText(descriptionHtml);
  const workplace = classifyWorkplace({ ...workplaceRaw, location });
  const geography = classifyGeography(location, workplace);
  const role = classifyRole(title);
  return {
    id: `${sourceType}:${normalizeKey(sourceKey).replace(/ /g, '-')}:${text(externalId)}`,
    sourceType,
    sourceKey: text(sourceKey),
    sourceLabel: text(sourceLabel),
    title: text(title).trim(),
    company: text(company).trim(),
    location: text(location).trim(),
    workplace,
    geography: geography.key,
    officialUrl: safeHttpUrl(officialUrl),
    applyUrl: safeHttpUrl(applyUrl),
    postedAt: isoOrEmpty(postedAt),
    employmentType: text(employmentType).trim(),
    description,
    experience: extractExperience(title, description),
    skills: detectSkills(description, title),
    roleFamily: role.family?.key || '',
    senior: role.senior,
    discoveredAt: checkedAt,
    lastCheckedAt: checkedAt,
    stillListed: true,
  };
}

export function isRelevant(listing) {
  return Boolean(listing && listing.roleFamily && RELEVANT_GEOGRAPHY.includes(listing.geography));
}

// Adds fresh listings from one source, keeps what the user already had, and marks
// listings that disappeared from the employer feed instead of deleting them.
export function mergeSourceListings(existing, fresh, sourceType, sourceKey, checkedAt, keepDays = 30) {
  const previous = Array.isArray(existing) ? existing.filter((item) => item && typeof item === 'object') : [];
  const freshList = Array.isArray(fresh) ? fresh : [];
  const freshIds = new Set(freshList.map((item) => item.id));
  const sameSource = (item) => item.sourceType === sourceType && normalizeKey(item.sourceKey) === normalizeKey(sourceKey);
  const cutoff = new Date(checkedAt).getTime() - keepDays * 86400000;
  const merged = [];
  for (const item of previous) {
    if (!sameSource(item)) { merged.push(item); continue; }
    if (freshIds.has(item.id)) continue;
    if (item.savedJobId || new Date(item.lastCheckedAt).getTime() >= cutoff) {
      merged.push({ ...item, stillListed: false, removedAt: item.removedAt || checkedAt });
    }
  }
  const byId = new Map(previous.map((item) => [item.id, item]));
  for (const item of freshList) {
    const old = byId.get(item.id);
    merged.push(old ? { ...item, discoveredAt: old.discoveredAt || item.discoveredAt, savedJobId: old.savedJobId, dismissed: old.dismissed, stillListed: true, removedAt: undefined } : item);
  }
  return merged;
}

export function trimListings(listings, max = 400) {
  const list = Array.isArray(listings) ? listings : [];
  if (list.length <= max) return list;
  const keep = list.filter((item) => item.savedJobId);
  const rest = list.filter((item) => !item.savedJobId)
    .sort((a, b) => String(b.lastCheckedAt).localeCompare(String(a.lastCheckedAt)));
  return [...keep, ...rest.slice(0, Math.max(0, max - keep.length))];
}

function urlKey(value) {
  try {
    const url = new URL(text(value));
    url.hash = '';
    url.search = '';
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return '';
  }
}

function titleKey(value) {
  return normalizeKey(value).replace(/\b(remote|hybrid|onsite|on site|india|wfh|full time|fulltime|immediate joiner|urgent)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

function cityKey(location) {
  const value = text(location).toLowerCase();
  const place = findCity(value);
  const aliases = { bangalore: 'bengaluru', gurgaon: 'gurugram', 'new delhi': 'delhi', cochin: 'kochi', mysore: 'mysuru', trivandrum: 'thiruvananthapuram' };
  return place ? aliases[place] || place : normalizeKey(value);
}

// Returns a map listingId -> { duplicateOf, reason } for likely duplicates within the
// discovered list, and listingId -> savedJobId for listings already in the tracker.
export function findDuplicates(listings, savedJobs = []) {
  const list = Array.isArray(listings) ? listings : [];
  const duplicates = {};
  const seenUrl = new Map();
  const seenTitle = new Map();
  const sorted = [...list].sort((a, b) => String(a.discoveredAt).localeCompare(String(b.discoveredAt)));
  for (const item of sorted) {
    const keyUrl = urlKey(item.officialUrl);
    const keyTitle = `${normalizeKey(item.company)}|${titleKey(item.title)}|${cityKey(item.location)}`;
    if (keyUrl && seenUrl.has(keyUrl)) duplicates[item.id] = { duplicateOf: seenUrl.get(keyUrl), reason: 'Same job link' };
    else if (seenTitle.has(keyTitle) && normalizeKey(item.company)) duplicates[item.id] = { duplicateOf: seenTitle.get(keyTitle), reason: 'Same employer, title and location' };
    if (keyUrl && !seenUrl.has(keyUrl)) seenUrl.set(keyUrl, item.id);
    if (!seenTitle.has(keyTitle)) seenTitle.set(keyTitle, item.id);
  }
  const inTracker = {};
  for (const item of list) {
    if (item.savedJobId) { inTracker[item.id] = item.savedJobId; continue; }
    const match = (Array.isArray(savedJobs) ? savedJobs : []).find((job) => job && (
      (urlKey(job.jobUrl) && urlKey(job.jobUrl) === urlKey(item.officialUrl))
      || (urlKey(job.applicationUrl) && urlKey(job.applicationUrl) === urlKey(item.applyUrl))
      || (normalizeKey(job.company) && normalizeKey(job.company) === normalizeKey(item.company) && titleKey(job.title) === titleKey(item.title))
    ));
    if (match) inTracker[item.id] = match.id;
  }
  return { duplicates, inTracker };
}

function matchesSkill(a, b) {
  const first = normalizeKey(a);
  const second = normalizeKey(b);
  return Boolean(first && second) && (first === second || first.includes(second) || second.includes(first));
}

// An ESTIMATE of fit based on the user's confirmed facts. Clearly separate from listing facts.
export function estimateMatch(listing, { confirmedSkills = [], hasConfirmedExperience = false, educationText = '' } = {}) {
  const reasons = [];
  const cautions = [];
  let score = 0;
  const family = ROLE_FAMILIES.find((item) => item.key === listing.roleFamily);
  if (family) {
    const points = { primary: 35, secondary: 28, additional: 20 }[family.key];
    score += points;
    reasons.push(`${family.tier} target role: ${family.label}.`);
  } else {
    cautions.push('Title does not match your target role list.');
  }
  if (listing.senior) {
    score -= 15;
    cautions.push('Title suggests a senior position.');
  }

  if (listing.geography === 'india') { score += 20; reasons.push('Located in India.'); }
  else if (listing.geography === 'remote-open') { score += 18; reasons.push('Remote and described as open internationally. Confirm India is eligible.'); }
  else if (listing.geography === 'remote-unclear') { score += 10; cautions.push('Remote, but the listing does not say which countries can apply.'); }
  else cautions.push('Location may not be open to candidates in India.');

  const level = listing.experience?.level;
  if (level === 'Entry / fresher / intern') { score += 25; reasons.push('Listing mentions entry-level, fresher, graduate or intern wording.'); }
  else if (level === 'Up to 2 years') {
    score += hasConfirmedExperience ? 18 : 12;
    (hasConfirmedExperience ? reasons : cautions).push(hasConfirmedExperience ? 'Asks for up to 2 years; compare with your confirmed experience.' : 'Asks for up to 2 years of experience; you have not confirmed any experience in your profile.');
  } else if (level === '2 to 5 years' || level === '5+ years') {
    score += 2;
    cautions.push(`Asks for ${level.toLowerCase()} of experience, which is likely a stretch right now.`);
  } else { score += 10; cautions.push('Experience requirement not stated; check the full listing.'); }

  const required = Array.isArray(listing.skills) ? listing.skills : [];
  const have = required.filter((skill) => confirmedSkills.some((mine) => matchesSkill(mine, skill)));
  const toLearn = required.filter((skill) => !have.includes(skill));
  if (required.length) {
    score += Math.round(20 * (have.length / required.length));
    if (have.length) reasons.push(`Mentions skills you have confirmed: ${have.join(', ')}.`);
  } else score += 8;

  const mbaWanted = (listing.experience?.education || []).some((line) => /\b(mba|pgdm|post[- ]?graduate)\b/i.test(line));
  if (mbaWanted && /\b(mba|pgdm)\b/i.test(educationText)) reasons.push('Mentions an MBA or postgraduate degree, which matches your confirmed education. Check whether graduating in 2027 is accepted.');

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    cautions,
    skillsYouHave: have,
    skillsToLearn: toLearn,
  };
}

// Applies the filter panel to listings (with their duplicate/match info).
export function filterListings(items, filters = {}) {
  const query = normalizeKey(filters.query);
  return (Array.isArray(items) ? items : []).filter(({ listing, duplicate, inTracker }) => {
    if (!listing) return false;
    if (!filters.showDismissed && listing.dismissed) return false;
    if (filters.role && listing.roleFamily !== filters.role) return false;
    if (filters.geography && listing.geography !== filters.geography) return false;
    if (filters.location && !normalizeKey(listing.location).includes(normalizeKey(filters.location))) return false;
    if (filters.experience && listing.experience?.level !== filters.experience) return false;
    if (filters.workplace && listing.workplace !== filters.workplace) return false;
    if (filters.source && listing.sourceType !== filters.source) return false;
    if (filters.hideDuplicates && duplicate) return false;
    if (filters.hideSaved && inTracker) return false;
    if (filters.hideSenior && listing.senior) return false;
    if (filters.hideRemoved && listing.stillListed === false) return false;
    if (query && !normalizeKey(`${listing.title} ${listing.company} ${listing.location} ${(listing.skills || []).join(' ')}`).includes(query)) return false;
    return true;
  });
}

// Maps a discovered listing to a job-tracker record. The user still reviews it.
export function listingToJob(listing, now = new Date().toISOString()) {
  const indianCity = findCity(listing.location);
  const experienceMap = {
    'Entry / fresher / intern': 'Fresher',
    'Up to 2 years': '0-2 years',
    '2 to 5 years': '2-5 years',
    '5+ years': '5+ years',
    'Not stated': 'Unknown',
  };
  const employment = /intern/i.test(listing.employmentType) ? 'Internship'
    : /full/i.test(listing.employmentType) ? 'Full-time'
      : /part/i.test(listing.employmentType) ? 'Part-time'
        : /contract/i.test(listing.employmentType) ? 'Contract' : 'Unknown';
  const sourceNames = { greenhouse: 'Greenhouse employer feed', ashby: 'Ashby employer feed', remotive: 'Remotive' };
  return {
    title: listing.title,
    company: listing.company,
    country: listing.geography === 'india' ? 'India' : '',
    region: '',
    city: indianCity ? indianCity.replace(/\b\w/g, (letter) => letter.toUpperCase()) : '',
    timeZone: '',
    mode: listing.workplace === 'Not stated' ? 'Unknown' : listing.workplace,
    remoteEligibleCountries: listing.geography === 'remote-open' ? listing.location : '',
    relocationRequirement: 'Unknown',
    experienceLevel: experienceMap[listing.experience?.level] || 'Unknown',
    minimumYears: listing.experience?.minYears ?? null,
    employmentType: employment,
    workAuthorizationRequirement: 'Not stated',
    visaSponsorship: 'Not stated',
    languageRequirement: 'Not stated',
    currency: '', salaryMinimum: '', salaryMaximum: '', salaryVerified: false, salarySource: '',
    deadline: '', deadlineVerified: false, deadlineSource: '',
    sourceVerified: false,
    jobUrl: listing.officialUrl,
    applicationUrl: listing.applyUrl || '',
    source: `${sourceNames[listing.sourceType] || listing.sourceType}${listing.sourceLabel ? ` (${listing.sourceLabel})` : ''}`,
    lastChecked: text(listing.lastCheckedAt).slice(0, 10),
    requiredSkills: listing.skills || [],
    growthSignal: 'Unknown',
    stage: 'Saved',
    notes: '',
    description: listing.description,
    priority: { primary: 1, secondary: 2, additional: 3 }[listing.roleFamily] || 6,
    industry: '',
    eligibilityChecklist: {},
    id: Date.now(),
    createdAt: now,
    sourceType: 'feed',
    discoveredListingId: listing.id,
  };
}

// Recognises job-board URLs pasted by the user.
export function parseJobUrl(input) {
  let url;
  try {
    url = new URL(text(input).trim());
  } catch {
    return { kind: 'invalid' };
  }
  if (!['https:', 'http:'].includes(url.protocol)) return { kind: 'invalid' };
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    if (parts[0] === 'embed') {
      const token = url.searchParams.get('for');
      const id = url.searchParams.get('token');
      if (token && id) return { kind: 'greenhouse-job', token, jobId: id, url: url.href };
      if (token) return { kind: 'greenhouse-board', token, url: url.href };
    }
    if (parts[0] && parts[1] === 'jobs' && /^\d+$/.test(parts[2] || '')) return { kind: 'greenhouse-job', token: parts[0], jobId: parts[2], url: url.href };
    if (parts[0] && host !== 'boards-api.greenhouse.io') return { kind: 'greenhouse-board', token: parts[0], url: url.href };
  }
  if (url.searchParams.get('gh_jid')) {
    return { kind: 'greenhouse-vanity', jobId: url.searchParams.get('gh_jid'), url: url.href, host };
  }
  if (host === 'jobs.ashbyhq.com' && parts[0]) {
    if (parts[1] && /^[0-9a-f-]{20,}$/i.test(parts[1])) return { kind: 'ashby-job', board: decodeURIComponent(parts[0]), jobId: parts[1], url: url.href };
    return { kind: 'ashby-board', board: decodeURIComponent(parts[0]), url: url.href };
  }
  if (/(^|\.)lever\.co$/.test(host)) return { kind: 'lever', company: parts[0] || '', url: url.href };
  if (/(^|\.)linkedin\.com$/.test(host)) return { kind: 'manual', sourceName: 'LinkedIn (opened manually)', url: url.href };
  const known = {
    'naukri.com': 'Naukri', 'indeed.com': 'Indeed', 'in.indeed.com': 'Indeed', 'internshala.com': 'Internshala',
    'instahyre.com': 'Instahyre', 'wellfound.com': 'Wellfound', 'foundit.in': 'Foundit', 'iimjobs.com': 'iimjobs',
    'hirist.tech': 'Hirist', 'cutshort.io': 'Cutshort', 'smartrecruiters.com': 'SmartRecruiters', 'jobs.smartrecruiters.com': 'SmartRecruiters',
    'myworkdayjobs.com': 'Workday careers page', 'apply.workable.com': 'Workable', 'remotive.com': 'Remotive',
  };
  const knownKey = Object.keys(known).find((key) => host === key || host.endsWith(`.${key}`));
  return { kind: 'manual', sourceName: knownKey ? known[knownKey] : `Company careers page (${host})`, url: url.href };
}
