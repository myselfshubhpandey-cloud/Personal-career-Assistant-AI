import React, { useMemo, useState } from 'react';
import { BadgeCheck, CircleAlert, Copy, ExternalLink, Info, Link2, Plus, Radar, RefreshCw, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import {
  estimateMatch,
  EXPERIENCE_LEVELS,
  filterListings,
  findDuplicates,
  isRelevant,
  listingToJob,
  mergeSourceListings,
  parseJobUrl,
  ROLE_FAMILIES,
  trimListings,
} from './discovery.js';
import { FeedError, fetchAshbyJob, fetchGreenhouseJob, fetchSource, lookupGreenhouseBoard, minutesUntilAllowed, SOURCE_TYPES } from './feeds.js';
import { confirmedFacts, confirmedSkillNames } from './profile-facts.js';
import { copyText } from './browser-actions.js';
import './feeds.css';

const GEOGRAPHY_LABELS = {
  india: 'India',
  'remote-open': 'Remote, open internationally',
  'remote-unclear': 'Remote, countries not stated',
};
const SOURCE_LABELS = { greenhouse: 'Greenhouse', ashby: 'Ashby', remotive: 'Remotive' };
const REMOTIVE_CATEGORIES = [['data', 'Data'], ['business', 'Business'], ['product', 'Product'], ['finance', 'Finance'], ['marketing', 'Marketing']];

const emptyFilters = {
  query: '', role: '', geography: '', location: '', experience: '', workplace: '', source: '',
  hideDuplicates: true, hideSaved: false, hideSenior: true, hideRemoved: false, showDismissed: false,
};

function formatDate(value, withTime = false) {
  if (!value) return 'Not stated';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Not stated';
  return new Intl.DateTimeFormat('en-IN', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
}

function errorMessage(error) {
  return error instanceof FeedError ? error.message : `Something went wrong: ${error?.message || 'unknown error'}`;
}

function wait(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export default function JobFeeds({ data, applyChange, notify, onSaveListing, onOpenTracker, onManualFromUrl }) {
  const sources = Array.isArray(data.discoverySources) ? data.discoverySources : [];
  const listings = useMemo(() => (Array.isArray(data.discovered) ? data.discovered : []), [data.discovered]);
  const [sourceInput, setSourceInput] = useState('');
  const [sourceType, setSourceType] = useState('auto');
  const [sourceLabel, setSourceLabel] = useState('');
  const [remotiveCategory, setRemotiveCategory] = useState('data');
  const [addError, setAddError] = useState('');
  const [busy, setBusy] = useState('');
  const [importText, setImportText] = useState('');
  const [importResults, setImportResults] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [expanded, setExpanded] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const profileBasis = useMemo(() => ({
    confirmedSkills: confirmedSkillNames(data.facts),
    hasConfirmedExperience: confirmedFacts(data.facts, 'experience').length > 0,
    educationText: confirmedFacts(data.facts, 'education').map((item) => `${item.qualification} ${item.details}`).join(' '),
  }), [data.facts]);

  const { duplicates, inTracker } = useMemo(() => findDuplicates(listings, data.jobs), [listings, data.jobs]);
  const items = useMemo(() => listings.map((listing) => ({
    listing,
    duplicate: duplicates[listing.id],
    inTracker: inTracker[listing.id],
    match: estimateMatch(listing, profileBasis),
  })), [listings, duplicates, inTracker, profileBasis]);
  const visible = filterListings(items, filters).sort((a, b) => (b.match.score - a.match.score) || String(b.listing.postedAt).localeCompare(String(a.listing.postedAt)));
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const updateSource = (id, changes) => applyChange((current) => ({
    ...current,
    discoverySources: (current.discoverySources || []).map((item) => item.id === id ? { ...item, ...changes } : item),
  }));

  const addSource = async (event) => {
    event.preventDefault();
    setAddError('');
    const raw = sourceInput.trim();
    if (!raw) { setAddError('Paste a careers page link or type a board name.'); return; }
    let type = sourceType;
    let token = raw;
    if (/^https?:\/\//i.test(raw)) {
      const parsed = parseJobUrl(raw);
      if (parsed.kind === 'greenhouse-board' || parsed.kind === 'greenhouse-job') { type = 'greenhouse'; token = parsed.token; }
      else if (parsed.kind === 'ashby-board' || parsed.kind === 'ashby-job') { type = 'ashby'; token = parsed.board; }
      else if (parsed.kind === 'lever') { setAddError('Lever boards cannot be read from this app because Lever does not allow requests from other websites. Use "Import from link" to add Lever jobs one by one.'); return; }
      else if (parsed.kind === 'greenhouse-vanity') { setAddError('This company hosts Greenhouse jobs on its own site, so the board name is hidden. Use "Import from link" for single jobs, or ask the company for its Greenhouse board link.'); return; }
      else { setAddError('This link is not a Greenhouse or Ashby job board. Use "Import from link" to add a single job manually.'); return; }
    } else if (type === 'auto') {
      setAddError('Choose Greenhouse or Ashby, or paste the full careers page link.');
      return;
    }
    if (sources.some((item) => item.type === type && item.token.toLowerCase() === token.toLowerCase())) { setAddError('This board is already in your sources.'); return; }
    setBusy('add');
    try {
      let label = sourceLabel.trim();
      if (type === 'greenhouse') {
        const board = await lookupGreenhouseBoard(token);
        token = board.token;
        label = label || board.name;
      }
      const source = { id: `${type}-${token}-${Date.now()}`, type, token, label: label || token, addedAt: new Date().toISOString() };
      applyChange((current) => ({ ...current, discoverySources: [...(current.discoverySources || []), source] }));
      setSourceInput('');
      setSourceLabel('');
      notify(`${source.label} added. Tap "Check now" to load its jobs.`);
    } catch (error) {
      setAddError(errorMessage(error));
    } finally {
      setBusy('');
    }
  };

  const addRemotive = () => {
    if (sources.some((item) => item.type === 'remotive' && item.token === remotiveCategory)) { setAddError('That Remotive category is already added.'); return; }
    const label = `Remotive, ${REMOTIVE_CATEGORIES.find(([key]) => key === remotiveCategory)?.[1] || remotiveCategory}`;
    applyChange((current) => ({ ...current, discoverySources: [...(current.discoverySources || []), { id: `remotive-${remotiveCategory}-${Date.now()}`, type: 'remotive', token: remotiveCategory, label, addedAt: new Date().toISOString() }] }));
    notify(`${label} added.`);
  };

  const checkSource = async (source) => {
    const waitMinutes = minutesUntilAllowed(source);
    if (waitMinutes > 0) { notify(`To be polite to ${source.label}, check again in ${waitMinutes} minutes.`); return false; }
    const checkedAt = new Date().toISOString();
    updateSource(source.id, { checking: true });
    try {
      const result = await fetchSource(source, checkedAt);
      const relevant = result.listings.filter(isRelevant);
      applyChange((current) => ({
        ...current,
        discovered: trimListings(mergeSourceListings(current.discovered, relevant, source.type, source.token, checkedAt)),
        discoverySources: (current.discoverySources || []).map((item) => item.id === source.id ? {
          ...item, checking: false, lastCheckedAt: checkedAt, lastStatus: 'ok', lastError: '', lastTotal: result.total, lastRelevant: relevant.length,
        } : item),
      }));
      return true;
    } catch (error) {
      // Saved jobs and previously found listings are left untouched on failure.
      updateSource(source.id, { checking: false, lastStatus: 'error', lastError: errorMessage(error), ...(error?.kind === 'rate-limited' ? { rateLimitedAt: checkedAt } : {}) });
      return false;
    }
  };

  const checkAll = async () => {
    setBusy('all');
    let ok = 0;
    let skipped = 0;
    for (const source of sources) {
      if (minutesUntilAllowed(source) > 0) { skipped += 1; continue; }
      if (await checkSource(source)) ok += 1;
      await wait(1200);
    }
    setBusy('');
    const failed = sources.length - ok - skipped;
    notify(`Checked ${ok} ${ok === 1 ? 'source' : 'sources'}${failed ? `, ${failed} failed (see the source list)` : ''}${skipped ? `, ${skipped} skipped to avoid checking too often` : ''}.`);
  };

  const removeSource = (source) => {
    applyChange((current) => ({
      ...current,
      discoverySources: (current.discoverySources || []).filter((item) => item.id !== source.id),
      discovered: (current.discovered || []).filter((item) => item.savedJobId || !(item.sourceType === source.type && item.sourceKey.toLowerCase() === source.token.toLowerCase())),
    }));
    setConfirmRemove(null);
    notify(`${source.label} removed. Jobs you saved to your tracker were kept.`);
  };

  const importLinks = async () => {
    const lines = [...new Set(importText.split(/\s+/).map((line) => line.trim()).filter(Boolean))].slice(0, 20);
    if (!lines.length) return;
    setBusy('import');
    const results = [];
    for (const line of lines) {
      const parsed = parseJobUrl(line);
      const checkedAt = new Date().toISOString();
      try {
        if (parsed.kind === 'invalid') { results.push({ url: line, status: 'error', message: 'Not a valid web link. It should start with https://' }); continue; }
        let listing = null;
        if (parsed.kind === 'greenhouse-job') listing = await fetchGreenhouseJob(parsed.token, parsed.jobId, '', checkedAt);
        else if (parsed.kind === 'ashby-job') listing = await fetchAshbyJob(parsed.board, parsed.jobId, checkedAt);
        if (listing) {
          const imported = { ...listing, importedByLink: true };
          applyChange((current) => {
            const existing = current.discovered || [];
            const others = existing.filter((item) => item.id !== imported.id);
            const old = existing.find((item) => item.id === imported.id);
            return { ...current, discovered: trimListings([...others, { ...imported, discoveredAt: old?.discoveredAt || imported.discoveredAt, savedJobId: old?.savedJobId }]) };
          });
          results.push({ url: line, status: 'ok', message: `${listing.title} at ${listing.company} loaded from the employer's feed.` });
        } else {
          const reasons = {
            lever: 'Lever does not allow this app to read its jobs. Add it manually; the link is filled in for you.',
            'greenhouse-board': 'This is a whole job board. Add it under "Your sources" instead.',
            'ashby-board': 'This is a whole job board. Add it under "Your sources" instead.',
            'greenhouse-vanity': 'This company hosts its jobs on its own site. Add it manually; the link is filled in for you.',
            manual: 'This site has no free public job feed, so the app does not read it. Add it manually; the link is filled in for you.',
          };
          results.push({ url: line, status: 'manual', message: reasons[parsed.kind] || reasons.manual, parsed });
        }
      } catch (error) {
        results.push({ url: line, status: 'error', message: `${errorMessage(error)} You can still add it manually.`, parsed });
      }
    }
    setImportResults(results);
    setBusy('');
  };

  const saveListing = (listing) => {
    const jobId = onSaveListing(listingToJob(listing));
    applyChange((current) => ({ ...current, discovered: (current.discovered || []).map((item) => item.id === listing.id ? { ...item, savedJobId: jobId } : item) }));
  };

  const setDismissed = (listing, dismissed) => applyChange((current) => ({ ...current, discovered: (current.discovered || []).map((item) => item.id === listing.id ? { ...item, dismissed } : item) }));

  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">OFFICIAL FEEDS ONLY</p>
          <h1>Job feeds</h1>
          <p className="section-description">Listings here come straight from employers' public job boards (Greenhouse and Ashby) and, if you add it, Remotive's free remote-jobs feed. Nothing is a sample, nothing is scraped, and nothing is submitted for you.</p>
        </div>
      </div>

      <section className="panel feed-panel">
        <div className="feed-panel-head">
          <div><h3><Radar size={18} /> Your sources</h3><small>Add the job boards of companies you want to watch. Only roles matching your targets in India or remote are kept.</small></div>
          <button type="button" className="button button-primary" onClick={checkAll} disabled={!sources.length || busy === 'all'}><RefreshCw size={15} className={busy === 'all' ? 'spin' : ''} /> {busy === 'all' ? 'Checking...' : 'Check all sources'}</button>
        </div>

        {sources.length ? (
          <div className="source-list">
            {sources.map((source) => {
              const waitMinutes = minutesUntilAllowed(source);
              return (
                <div className={`source-row ${source.lastStatus === 'error' ? 'has-error' : ''}`} key={source.id}>
                  <div className="source-info">
                    <strong>{source.label}</strong>
                    <small>{SOURCE_TYPES[source.type]?.label || source.type} · {source.token}</small>
                    <small>
                      {source.checking ? 'Checking now...'
                        : source.lastCheckedAt ? `Last checked ${formatDate(source.lastCheckedAt, true)}${source.lastStatus === 'ok' ? `: ${source.lastRelevant} of ${source.lastTotal} jobs matched your targets` : ''}`
                          : 'Not checked yet'}
                    </small>
                    {source.lastStatus === 'error' && <p className="job-form-error" role="alert"><CircleAlert size={15} /> {source.lastError} Your saved jobs and earlier results are unchanged.</p>}
                    {source.type === 'remotive' && <small>Jobs from <a href="https://remotive.com" target="_blank" rel="noreferrer">Remotive</a>. Shown after a 24-hour delay, as Remotive's terms require.</small>}
                  </div>
                  <div className="source-actions">
                    <button type="button" className="button button-outline" disabled={source.checking || waitMinutes > 0} onClick={() => checkSource(source)}>{waitMinutes > 0 ? `Check again in ${waitMinutes} min` : 'Check now'}</button>
                    {confirmRemove === source.id
                      ? <><button type="button" className="button button-outline" onClick={() => setConfirmRemove(null)}>Keep</button><button type="button" className="button danger-solid" onClick={() => removeSource(source)}>Remove</button></>
                      : <button type="button" className="icon-button danger-button" aria-label={`Remove ${source.label}`} onClick={() => setConfirmRemove(source.id)}><Trash2 size={16} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="feed-help">
            <Info size={18} />
            <div>
              <strong>How to find a company's job board</strong>
              <ol>
                <li>Open the company's careers page in Safari and tap any job.</li>
                <li>Look at the address bar. If it contains <code>job-boards.greenhouse.io/NAME</code>, <code>boards.greenhouse.io/NAME</code> or <code>jobs.ashbyhq.com/NAME</code>, copy that link.</li>
                <li>Paste it below and tap <b>Add source</b>.</li>
              </ol>
              <small>Other systems (Lever, Workday, Naukri, LinkedIn) cannot be read by this app. Use "Import from link" to add those jobs one at a time.</small>
            </div>
          </div>
        )}

        <form className="source-add" onSubmit={addSource}>
          <label className="field source-link-field"><span>Careers page link or board name</span><input value={sourceInput} onChange={(event) => setSourceInput(event.target.value)} placeholder="https://job-boards.greenhouse.io/companyname" autoCapitalize="none" autoCorrect="off" spellCheck="false" /></label>
          <label className="field"><span>Board type</span><select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="auto">Detect from link</option><option value="greenhouse">Greenhouse</option><option value="ashby">Ashby</option></select></label>
          <label className="field"><span>Company name (optional)</span><input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} placeholder="Filled in from the board if possible" /></label>
          <button type="submit" className="button button-primary" disabled={busy === 'add'}><Plus size={15} /> {busy === 'add' ? 'Checking board...' : 'Add source'}</button>
        </form>
        {addError && <p className="job-form-error" role="alert"><CircleAlert size={15} /> {addError}</p>}
        <div className="remotive-add">
          <label className="field"><span>Optional: Remotive remote jobs (free public feed)</span><select value={remotiveCategory} onChange={(event) => setRemotiveCategory(event.target.value)}>{REMOTIVE_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <button type="button" className="button button-outline" onClick={addRemotive}><Plus size={15} /> Add Remotive category</button>
          <small>Remotive lists worldwide remote jobs; many are not open to India. Checked at most every 6 hours, as Remotive asks.</small>
        </div>
      </section>

      <section className="panel feed-panel">
        <div className="feed-panel-head"><div><h3><Link2 size={18} /> Import from link</h3><small>Paste one or more job links (one per line). Greenhouse and Ashby links are read from the employer's feed. Other links open a form with the link filled in, so you copy the details yourself.</small></div></div>
        <textarea className="import-box" rows={3} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={'https://job-boards.greenhouse.io/company/jobs/1234567\nhttps://www.naukri.com/job-listings-...'} aria-label="Job links to import" autoCapitalize="none" autoCorrect="off" spellCheck="false" />
        <div className="import-actions"><button type="button" className="button button-primary" disabled={!importText.trim() || busy === 'import'} onClick={importLinks}><Link2 size={15} /> {busy === 'import' ? 'Importing...' : 'Import links'}</button></div>
        {importResults.length > 0 && (
          <ul className="import-results">
            {importResults.map((result) => (
              <li key={result.url} className={`import-${result.status}`}>
                <span className="import-url">{result.url}</span>
                <span>{result.message}</span>
                {result.status !== 'ok' && result.parsed && result.parsed.kind !== 'invalid' && (
                  <button type="button" className="button button-outline" onClick={() => onManualFromUrl({ jobUrl: result.url, source: result.parsed.sourceName || (result.parsed.kind === 'lever' ? 'Lever careers page' : 'Company careers page') })}><Plus size={15} /> Add manually</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel feed-panel">
        <div className="feed-panel-head"><div><h3><SlidersHorizontal size={18} /> Filter discovered jobs</h3><small>{visible.length} of {listings.length} shown</small></div><button type="button" className="text-button" onClick={() => setFilters(emptyFilters)}>Reset</button></div>
        <div className="feed-filters">
          <label className="tracker-search"><Search size={16} /><input type="search" value={filters.query} onChange={(event) => setFilter('query', event.target.value)} placeholder="Search title, company, skills" aria-label="Search discovered jobs" /></label>
          <label className="field"><span>Role</span><select value={filters.role} onChange={(event) => setFilter('role', event.target.value)}><option value="">All target roles</option>{ROLE_FAMILIES.map((family) => <option key={family.key} value={family.key}>{family.tier}: {family.label}</option>)}</select></label>
          <label className="field"><span>Location</span><select value={filters.geography} onChange={(event) => setFilter('geography', event.target.value)}><option value="">India and remote</option>{Object.entries(GEOGRAPHY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="field"><span>City or place contains</span><input value={filters.location} onChange={(event) => setFilter('location', event.target.value)} placeholder="e.g. Bengaluru" /></label>
          <label className="field"><span>Experience</span><select value={filters.experience} onChange={(event) => setFilter('experience', event.target.value)}><option value="">Any</option>{EXPERIENCE_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label>
          <label className="field"><span>Remote status</span><select value={filters.workplace} onChange={(event) => setFilter('workplace', event.target.value)}><option value="">Any</option>{['Remote', 'Hybrid', 'On-site', 'Not stated'].map((mode) => <option key={mode}>{mode}</option>)}</select></label>
          <label className="field"><span>Source</span><select value={filters.source} onChange={(event) => setFilter('source', event.target.value)}><option value="">All sources</option>{Object.entries(SOURCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        </div>
        <div className="feed-toggles">
          {[['hideDuplicates', 'Hide likely duplicates'], ['hideSenior', 'Hide senior titles'], ['hideSaved', 'Hide jobs already in my tracker'], ['hideRemoved', 'Hide jobs no longer listed'], ['showDismissed', 'Show dismissed jobs']].map(([key, label]) => (
            <label className="confirm-check" key={key}><input type="checkbox" checked={filters[key]} onChange={(event) => setFilter(key, event.target.checked)} /><span>{label}</span></label>
          ))}
        </div>
      </section>

      <section className="feed-results">
        {visible.length ? visible.map(({ listing, duplicate, inTracker: trackerId, match }) => {
          const original = duplicate ? listings.find((item) => item.id === duplicate.duplicateOf) : null;
          return (
            <article className={`panel feed-card ${listing.dismissed ? 'is-dismissed' : ''}`} key={listing.id}>
              <div className="feed-card-head">
                <div>
                  <h3>{listing.title}</h3>
                  <strong>{listing.company || 'Employer not stated'}</strong>
                  <div className="feed-tags">
                    <span className="feed-tag">{SOURCE_LABELS[listing.sourceType] || listing.sourceType}</span>
                    <span className="feed-tag">{listing.workplace}</span>
                    <span className="feed-tag">{GEOGRAPHY_LABELS[listing.geography] || 'Location unclear'}</span>
                    {listing.importedByLink && <span className="feed-tag">Imported by link</span>}
                    {duplicate && <span className="feed-tag warn">Possible duplicate{original ? ` of ${original.title} (${SOURCE_LABELS[original.sourceType] || original.sourceType})` : ''}: {duplicate.reason.toLowerCase()}</span>}
                    {trackerId && <span className="feed-tag good">In your tracker</span>}
                    {listing.stillListed === false && <span className="feed-tag warn">No longer in the employer's feed since {formatDate(listing.removedAt)}</span>}
                  </div>
                </div>
                <div className="match-badge" title="Estimated match, calculated by Career Studio"><strong>{match.score}</strong><span>ESTIMATED MATCH</span></div>
              </div>

              <div className="feed-columns">
                <div className="verified-box">
                  <p className="box-label"><BadgeCheck size={14} /> From the listing ({SOURCE_LABELS[listing.sourceType] || listing.sourceType} feed{listing.sourceLabel ? `: ${listing.sourceLabel}` : ''})</p>
                  <dl>
                    <dt>Location</dt><dd>{listing.location || 'Not stated'}</dd>
                    <dt>Remote status</dt><dd>{listing.workplace}</dd>
                    {listing.employmentType && <><dt>Job type</dt><dd>{listing.employmentType}</dd></>}
                    <dt>Posted or updated by employer</dt><dd>{formatDate(listing.postedAt)}</dd>
                    <dt>First found by you</dt><dd>{formatDate(listing.discoveredAt, true)}</dd>
                    <dt>Last checked</dt><dd>{formatDate(listing.lastCheckedAt, true)}</dd>
                    <dt>Experience wording</dt>
                    <dd>{listing.experience?.evidence?.length ? <ul>{listing.experience.evidence.map((line) => <li key={line}>"{line}"</li>)}</ul> : 'No experience wording found in the listing text.'}</dd>
                    {listing.experience?.education?.length > 0 && <><dt>Education wording</dt><dd><ul>{listing.experience.education.map((line) => <li key={line}>"{line}"</li>)}</ul></dd></>}
                  </dl>
                </div>
                <div className="estimate-box">
                  <p className="box-label"><Info size={14} /> Estimated match (Career Studio's guess, not from the employer)</p>
                  <div className="match-bar"><span style={{ width: `${match.score}%` }} /></div>
                  <p className="estimate-level">Experience level read from text: <b>{listing.experience?.level || 'Not stated'}</b></p>
                  {match.reasons.length > 0 && <><strong>Why it may suit you</strong><ul>{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></>}
                  {match.cautions.length > 0 && <><strong>Check carefully</strong><ul className="cautions">{match.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul></>}
                  <strong>Skills mentioned</strong>
                  <p>{match.skillsYouHave.length ? <>You confirmed: <b>{match.skillsYouHave.join(', ')}</b>. </> : null}
                    {match.skillsToLearn.length ? <>May still need to learn or confirm: <b>{match.skillsToLearn.join(', ')}</b>.</> : (listing.skills || []).length ? 'You have confirmed every skill detected.' : 'No common skill keywords found; read the full listing.'}</p>
                  <small>Based only on facts you confirmed in Career profile. No professional experience is assumed unless you confirmed it.</small>
                </div>
              </div>

              <div className="feed-actions">
                {listing.officialUrl && <a className="button button-outline" href={listing.officialUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open official listing</a>}
                {trackerId
                  ? <button type="button" className="button button-outline" onClick={onOpenTracker}>View in tracker</button>
                  : <button type="button" className="button button-primary" onClick={() => saveListing(listing)}><Plus size={15} /> Save to tracker</button>}
                <button type="button" className="text-button" onClick={() => setExpanded(expanded === listing.id ? null : listing.id)}>{expanded === listing.id ? 'Hide description' : 'Show description'}</button>
                {listing.officialUrl && <button type="button" className="text-button" onClick={() => copyText(listing.officialUrl, notify, 'Job link copied.')}><Copy size={14} /> Copy link</button>}
                <button type="button" className="text-button" onClick={() => setDismissed(listing, !listing.dismissed)}>{listing.dismissed ? 'Restore' : <><X size={14} /> Not interested</>}</button>
              </div>
              {expanded === listing.id && <div className="feed-description"><p className="box-label">Listing text as published (formatting removed)</p><p className="preline">{listing.description || 'The feed did not include a description.'}</p></div>}
            </article>
          );
        }) : (
          <div className="empty-jobs">
            <Radar size={24} />
            <h3>{listings.length ? 'No discovered jobs match these filters.' : 'No jobs discovered yet.'}</h3>
            <p>{listings.length ? 'Try resetting the filters, or untick "Hide senior titles".' : 'Add a company job board above and tap "Check now". Only real listings from the employer\'s feed will appear here.'}</p>
          </div>
        )}
      </section>
    </>
  );
}
