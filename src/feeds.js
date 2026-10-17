// Fetches listings from free, public, no-login employer feeds.
// - Greenhouse Job Board API: documented as public; browser access via JSONP is officially supported.
// - Ashby public job posting API: public; browser (CORS) access is not documented, so failures are reported.
// - Remotive public API: free with conditions (credit Remotive, 24-hour delay, a few requests per day).
// Lever is intentionally NOT fetched: its docs say cross-origin requests from other sites are not supported.
// Nothing here logs in, solves CAPTCHAs, uses proxies or retries around a refusal.

import { buildListing, normalizeKey } from './discovery.js';

export class FeedError extends Error {
  constructor(message, kind = 'error') {
    super(message);
    this.name = 'FeedError';
    this.kind = kind;
  }
}

export const SOURCE_TYPES = {
  greenhouse: { label: 'Greenhouse employer board', minMinutesBetweenChecks: 30 },
  ashby: { label: 'Ashby employer board', minMinutesBetweenChecks: 30 },
  remotive: { label: 'Remotive remote jobs', minMinutesBetweenChecks: 360 },
};

export function minutesUntilAllowed(source, now = Date.now()) {
  // Counts from the last successful check (or a "too many requests" reply), so a typo or
  // network failure can be retried straight away without hammering a working source.
  const rule = SOURCE_TYPES[source?.type];
  const last = [source?.lastStatus === 'ok' ? source.lastCheckedAt : null, source?.rateLimitedAt]
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter(Number.isFinite);
  if (!rule || !last.length) return 0;
  const elapsed = (now - Math.max(...last)) / 60000;
  const minimum = source.rateLimitedAt && new Date(source.rateLimitedAt).getTime() === Math.max(...last) ? Math.max(rule.minMinutesBetweenChecks, 180) : rule.minMinutesBetweenChecks;
  return Math.max(0, Math.ceil(minimum - elapsed));
}

async function fetchJson(url, { timeoutMs = 15000, fetchImpl = globalThis.fetch } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new FeedError('You appear to be offline. Connect to the internet and try again.', 'offline');
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;
  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: controller?.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch (error) {
    if (error?.name === 'AbortError') throw new FeedError('The source took too long to respond. Try again later.', 'timeout');
    throw new FeedError('The browser could not reach this source. It may block requests from other websites, or the network is down.', 'network');
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (response.status === 404) throw new FeedError('Not found. Check the board name or link is correct and the employer still uses this job board.', 'not-found');
  if (response.status === 429) throw new FeedError('The source asked us to slow down (too many requests). Wait a few hours before checking again.', 'rate-limited');
  if (!response.ok) throw new FeedError(`The source returned an error (HTTP ${response.status}). Try again later.`, 'http');
  try {
    return await response.json();
  } catch {
    throw new FeedError('The source sent something that was not job data. It may have changed or be temporarily unavailable.', 'bad-data');
  }
}

let jsonpCounter = 0;
// JSONP as documented by Greenhouse for browser use. Only used for boards-api.greenhouse.io.
export function jsonp(url, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') { reject(new FeedError('Browser features are not available.', 'network')); return; }
    const target = new URL(url);
    if (target.hostname !== 'boards-api.greenhouse.io' || target.protocol !== 'https:') { reject(new FeedError('Blocked: JSONP is only used for the official Greenhouse API.', 'blocked')); return; }
    jsonpCounter += 1;
    const callbackName = `careerStudioGh${Date.now()}_${jsonpCounter}`;
    target.searchParams.set('callback', callbackName);
    const script = document.createElement('script');
    let finished = false;
    const cleanup = () => {
      finished = true;
      clearTimeout(timer);
      script.remove();
      try { delete window[callbackName]; } catch { window[callbackName] = undefined; }
    };
    const timer = setTimeout(() => { if (!finished) { cleanup(); reject(new FeedError('Greenhouse took too long to respond. Try again later.', 'timeout')); } }, timeoutMs);
    window[callbackName] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { if (!finished) { cleanup(); reject(new FeedError('Greenhouse could not be reached, or this board name does not exist.', 'network')); } };
    script.src = target.href;
    script.referrerPolicy = 'no-referrer';
    document.head.appendChild(script);
  });
}

async function greenhouseGet(path, options = {}) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${path}`;
  try {
    return await fetchJson(url, options);
  } catch (error) {
    if (error instanceof FeedError && error.kind === 'network' && !options.fetchImpl) return jsonp(url, options);
    throw error;
  }
}

function cleanToken(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '');
}

function assertToken(token) {
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(token)) throw new FeedError('That board name has unexpected characters. Paste the careers page link instead.', 'invalid');
}

export async function lookupGreenhouseBoard(tokenInput, options = {}) {
  const token = cleanToken(tokenInput);
  assertToken(token);
  const board = await greenhouseGet(encodeURIComponent(token), options);
  if (!board || typeof board !== 'object' || typeof board.name !== 'string') throw new FeedError('This does not look like a Greenhouse job board.', 'bad-data');
  return { token, name: board.name };
}

function greenhouseListing(job, source, checkedAt) {
  return buildListing({
    sourceType: 'greenhouse',
    sourceKey: source.token,
    sourceLabel: source.label,
    externalId: job.id,
    title: job.title,
    company: job.company_name || source.label,
    location: job.location?.name || '',
    workplaceRaw: {},
    officialUrl: job.absolute_url,
    applyUrl: job.absolute_url,
    postedAt: job.first_published || job.updated_at,
    employmentType: '',
    descriptionHtml: job.content || '',
    checkedAt,
  });
}

export async function fetchGreenhouse(source, checkedAt = new Date().toISOString(), options = {}) {
  const token = cleanToken(source.token);
  assertToken(token);
  const data = await greenhouseGet(`${encodeURIComponent(token)}/jobs?content=true`, options);
  if (!data || !Array.isArray(data.jobs)) throw new FeedError('Greenhouse returned an unexpected format.', 'bad-data');
  return { total: data.jobs.length, listings: data.jobs.filter((job) => job && job.id && job.title).map((job) => greenhouseListing(job, source, checkedAt)) };
}

export async function fetchGreenhouseJob(token, jobId, label, checkedAt = new Date().toISOString(), options = {}) {
  const cleaned = cleanToken(token);
  assertToken(cleaned);
  if (!/^\d+$/.test(String(jobId))) throw new FeedError('That Greenhouse job link has an unexpected job number.', 'invalid');
  const job = await greenhouseGet(`${encodeURIComponent(cleaned)}/jobs/${jobId}`, options);
  if (!job || !job.id || !job.title) throw new FeedError('Greenhouse did not return this job. It may have closed.', 'not-found');
  return greenhouseListing(job, { token: cleaned, label: label || job.company_name || cleaned }, checkedAt);
}

function ashbyListing(job, source, checkedAt) {
  const secondary = Array.isArray(job.secondaryLocations) ? job.secondaryLocations.map((item) => item?.location).filter(Boolean) : [];
  const country = job.address?.postalAddress?.addressCountry;
  const location = [job.location, ...secondary, country && !String(job.location || '').includes(country) ? country : ''].filter(Boolean).join(' / ');
  return buildListing({
    sourceType: 'ashby',
    sourceKey: source.token,
    sourceLabel: source.label,
    externalId: job.id || normalizeKey(job.jobUrl || job.title).replace(/ /g, '-'),
    title: job.title,
    company: source.label,
    location,
    workplaceRaw: { workplaceType: job.workplaceType, isRemote: job.isRemote },
    officialUrl: job.jobUrl,
    applyUrl: job.applyUrl,
    postedAt: job.publishedAt,
    employmentType: job.employmentType,
    descriptionText: job.descriptionPlain,
    descriptionHtml: job.descriptionHtml,
    checkedAt,
  });
}

export async function fetchAshby(source, checkedAt = new Date().toISOString(), options = {}) {
  const token = cleanToken(source.token);
  if (!token || token.length > 120 || /[/?#]/.test(token)) throw new FeedError('That Ashby board name looks wrong. Paste the jobs.ashbyhq.com link instead.', 'invalid');
  let data;
  try {
    data = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`, options);
  } catch (error) {
    if (error instanceof FeedError && error.kind === 'network') {
      throw new FeedError('Ashby did not allow this browser to read the board, or the network is down. You can still open the jobs page and add roles with "Import from link".', 'network');
    }
    throw error;
  }
  if (!data || !Array.isArray(data.jobs)) throw new FeedError('Ashby returned an unexpected format.', 'bad-data');
  // Unlisted jobs are meant for direct links only, so they are not shown as discoveries.
  const listed = data.jobs.filter((job) => job && job.title && job.isListed !== false);
  return { total: listed.length, listings: listed.map((job) => ashbyListing(job, source, checkedAt)) };
}

export async function fetchAshbyJob(board, jobId, checkedAt = new Date().toISOString(), options = {}) {
  const result = await fetchAshby({ token: board, label: board }, checkedAt, options);
  const listing = result.listings.find((item) => item.id.endsWith(`:${jobId}`) || item.officialUrl.includes(jobId));
  if (!listing) throw new FeedError('That job was not found on the Ashby board. It may have closed.', 'not-found');
  return listing;
}

const REMOTIVE_CATEGORIES = ['data', 'business', 'product', 'finance', 'marketing', 'all-others'];

export async function fetchRemotive(source, checkedAt = new Date().toISOString(), options = {}) {
  const category = REMOTIVE_CATEGORIES.includes(source.token) ? source.token : 'data';
  const data = await fetchJson(`https://remotive.com/api/remote-jobs?category=${encodeURIComponent(category)}`, options);
  if (!data || !Array.isArray(data.jobs)) throw new FeedError('Remotive returned an unexpected format.', 'bad-data');
  const dayAgo = new Date(checkedAt).getTime() - 86400000;
  // Remotive's terms ask for a 24-hour delay before showing jobs.
  const delayed = data.jobs.filter((job) => job && job.title && new Date(job.publication_date).getTime() <= dayAgo);
  return {
    total: delayed.length,
    listings: delayed.map((job) => buildListing({
      sourceType: 'remotive',
      sourceKey: category,
      sourceLabel: `Remotive, ${category}`,
      externalId: job.id,
      title: job.title,
      company: job.company_name,
      location: `Remote - ${job.candidate_required_location || 'not stated'}`,
      workplaceRaw: { isRemote: true },
      officialUrl: job.url,
      applyUrl: job.url,
      postedAt: job.publication_date,
      employmentType: job.job_type,
      descriptionHtml: job.description,
      checkedAt,
    })),
  };
}

export async function fetchSource(source, checkedAt, options = {}) {
  if (source.type === 'greenhouse') return fetchGreenhouse(source, checkedAt, options);
  if (source.type === 'ashby') return fetchAshby(source, checkedAt, options);
  if (source.type === 'remotive') return fetchRemotive(source, checkedAt, options);
  throw new FeedError('Unknown source type.', 'invalid');
}
