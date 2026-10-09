import React, { useState } from 'react';
import { ArrowUpRight, BadgeCheck, BriefcaseBusiness, CircleAlert, ExternalLink, FileText, Globe2, Plus, Search, SlidersHorizontal, Target, Trash2 } from 'lucide-react';
import { analyzeJobDescription, buildJobSearchQuery, CHECKLIST_ITEMS, EXPERIENCE_OPTIONS, externalJobSearches, filterJobListings, findJobApplication, getJobFit, INDUSTRIES, PRIORITY_FAMILIES, priorityForRole } from './job-planning.js';
import './job-planning.css';

const checklistStates = [
  ['unknown', 'Not checked'],
  ['needs-action', 'Needs follow-up'],
  ['confirmed', 'Confirmed by me'],
  ['not-eligible', 'Not eligible'],
];

const workModes = ['Remote', 'Hybrid', 'On-site', 'Unknown'];
const employmentTypes = ['Internship', 'Graduate programme', 'Campus placement', 'Full-time', 'Part-time', 'Contract', 'Temporary', 'Unknown'];
const authOptions = ['Not stated', 'Must already have authorization', 'Sponsorship may be available', 'Other - verify'];
const sponsorshipOptions = ['Not stated', 'Yes', 'No', 'Conditional - verify'];

function emptyChecklist() {
  return Object.fromEntries(CHECKLIST_ITEMS.map(([key]) => [key, 'unknown']));
}

function emptyJob() {
  return {
    id: null,
    company: '',
    title: '',
    priority: '',
    industry: '',
    country: '',
    region: '',
    city: '',
    timeZone: '',
    mode: 'Unknown',
    remoteEligibleCountries: '',
    relocationRequirement: 'Unknown',
    experienceLevel: 'Unknown',
    minimumYears: '',
    employmentType: 'Unknown',
    workAuthorizationRequirement: 'Not stated',
    visaSponsorship: 'Not stated',
    languageRequirement: 'Not stated',
    currency: '',
    salaryMinimum: '',
    salaryMaximum: '',
    salaryVerified: false,
    salarySource: '',
    deadline: '',
    deadlineVerified: false,
    deadlineSource: '',
    sourceVerified: false,
    jobUrl: '',
    requiredSkills: [],
    growthSignal: 'Unknown',
    stage: 'Saved',
    description: '',
    eligibilityChecklist: emptyChecklist(),
  };
}

function JobField({ label, value, onChange, options, type = 'text', placeholder = '', required = false, min, step }) {
  return (
    <label className="job-field">
      <span>{label}</span>
      {options ? (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => {
            const [optionLabel, optionValue] = Array.isArray(option) ? option : [option, option];
            return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
          })}
        </select>
      ) : (
        <input type={type} value={value} min={min} step={step} required={required} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function isInternational(job) {
  return Boolean(job.country) && job.country.trim().toLowerCase() !== 'india';
}

export default function JobDiscovery({ data, update, notify, onCreateLetter, onTailorResume, onTrackApplication, onUpdateJob }) {
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const locationPreferences = Array.isArray(data.locationPreferences)
    ? data.locationPreferences.filter((item) => item && typeof item === 'object')
    : [];
  const applications = Array.isArray(data.applications) ? data.applications : [];
  const [filters, setFilters] = useState({
    role: '', priority: '', industry: '', country: '', region: '', city: '', timeZone: '',
    mode: '', remoteCountry: '', experience: '', employmentType: '', authorization: '',
    sponsorship: '', currency: '', verifiedSalaryOnly: false, minimumSalary: '', maximumSalary: '',
    deadlineBefore: '',
  });
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState(emptyJob);
  const [descriptionText, setDescriptionText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);
  const [locationDraft, setLocationDraft] = useState({ country: '', city: '', mode: 'Any' });
  const [locationPriority, setLocationPriority] = useState('1');

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const setDraftField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const addLocationPreference = (event) => {
    event.preventDefault();
    const preference = {
      country: locationDraft.country.trim(),
      city: locationDraft.city.trim(),
      mode: locationDraft.mode === 'Any' ? '' : locationDraft.mode,
      priority: Number(locationPriority),
    };
    if ((!preference.country && !preference.city && !preference.mode)
      || locationPreferences.some((item) => (
        (item.country || '').toLowerCase() === preference.country.toLowerCase()
        && (item.city || '').toLowerCase() === preference.city.toLowerCase()
        && (item.mode || '').toLowerCase() === preference.mode.toLowerCase()
      ))) return;
    update('locationPreferences', [...locationPreferences, { ...preference, id: Date.now() }]);
    setLocationDraft({ country: '', city: '', mode: 'Any' });
  };
  const updateLocationPreference = (id, field, value) => update('locationPreferences', locationPreferences.map((item) => (
    item.id === id ? { ...item, [field]: field === 'priority' ? Number(value) : value } : item
  )));
  const removeLocationPreference = (id) => update('locationPreferences', locationPreferences.filter((item) => item.id !== id));
  const clearFilters = () => setFilters({
    role: '', priority: '', industry: '', country: '', region: '', city: '', timeZone: '',
    mode: '', remoteCountry: '', experience: '', employmentType: '', authorization: '',
    sponsorship: '', currency: '', verifiedSalaryOnly: false, minimumSalary: '', maximumSalary: '',
    deadlineBefore: '',
  });

  const scoredJobs = filterJobListings(
    jobs.map((job) => ({ job, fit: getJobFit(job, data.profile, data.skills, locationPreferences) })),
    filters,
  )
    .sort((first, second) => second.fit.score - first.fit.score);

  const searchQuery = buildJobSearchQuery(filters.role, filters.priority);
  const externalSources = externalJobSearches(searchQuery, filters.country, filters.city);

  const saveJob = (event) => {
    event.preventDefault();
    const skills = Array.isArray(draft.requiredSkills) ? draft.requiredSkills : String(draft.requiredSkills || '').split(/[,;\n]/).map((skill) => skill.trim()).filter(Boolean);
    const job = {
      ...draft,
      id: Date.now(),
      priority: Number(draft.priority) || priorityForRole(draft.title),
      requiredSkills: skills,
      minimumYears: draft.minimumYears === '' ? null : Number(draft.minimumYears),
      createdAt: new Date().toISOString(),
      sourceType: 'manual',
    };
    update('jobs', [job, ...jobs]);
    setDraft(emptyJob());
    setIsAdding(false);
    setDescriptionText('');
    setAnalysis(null);
    notify('Manually entered opportunity saved.');
  };

  const analyzeDescription = () => {
    setAnalysis(analyzeJobDescription(descriptionText, profileSkillNames));
    notify('Description checked locally; nothing was sent to a service.');
  };

  const startFromAnalysis = () => {
    setDraft({ ...emptyJob(), description: descriptionText, requiredSkills: analysis?.matchedSkills || [] });
    setIsAdding(true);
  };

  const updateJob = (jobId, changes) => onUpdateJob
    ? onUpdateJob(jobId, changes)
    : update('jobs', jobs.map((job) => job.id === jobId ? { ...job, ...changes } : job));
  const removeJob = (jobId) => update('jobs', jobs.filter((job) => job.id !== jobId));
  const profileSkillNames = [
    ...(data.profile.skills || '').split(/[,;\n]/),
    ...(Array.isArray(data.skills) ? data.skills : [])
      .filter((skill) => skill && skill.current !== null && skill.current !== undefined)
      .map((skill) => skill.name),
  ].map((skill) => String(skill || '').toLowerCase()).filter(Boolean);

  return (
    <>
      <div className="section-title job-title-row">
        <div>
          <p className="eyebrow">ONE GLOBAL OPPORTUNITY BOARD</p>
          <h1>Job discovery</h1>
          <p className="section-description">All locations remain open. Add a listing you verified, or search outside the app. There is no live job feed.</p>
        </div>
        <button className="button button-primary" onClick={() => { setDraft(emptyJob()); setIsAdding((open) => !open); }}><Plus size={16} /> Add verified listing</button>
      </div>

      <section className="job-source-band">
        <div className="job-source-copy"><span className="job-globe"><Globe2 size={19} /></span><div><strong>External / manual research only</strong><span>These links open public job sites and search results in a new tab. They are not a live vacancy feed and should be treated as research starting points until a trusted free data source is integrated.</span></div></div>
        <div className="job-source-links">{externalSources.map((source) => <a key={source.label} href={source.href} target="_blank" rel="noreferrer">{source.label}<ExternalLink size={13} /></a>)}</div>
      </section>

      <section className="panel job-priority-panel">
        <div className="job-panel-head"><div><Target size={16} /><div><strong>Global role focus</strong><small>India and international roles, with remote, hybrid and on-site variants.</small></div></div></div>
        <div className="job-filter-grid">
          <div className="priority-chip-row">
            {['Business Analyst', 'Business / Data Analytics', 'Product Analyst', 'Associate Product Manager (entry-level)', 'Operations Analyst', 'Marketing Analyst', 'FinTech Analyst', 'Technology Business Analyst', 'Healthcare Business Analyst'].map((label) => <span key={label} className="priority-chip">{label}</span>)}
          </div>
        </div>
      </section>

      <section className="panel location-preferences">
        <div className="job-panel-head"><div><Globe2 size={16} /><div><strong>My saved location preferences</strong><small>Set countries, cities, and work modes. These guide ranking but never hide other locations.</small></div></div></div>
        <form className="location-preference-form" onSubmit={addLocationPreference}>
          <JobField label="Country" value={locationDraft.country} onChange={(value) => setLocationDraft((current) => ({ ...current, country: value }))} placeholder="Any country" />
          <JobField label="City" value={locationDraft.city} onChange={(value) => setLocationDraft((current) => ({ ...current, city: value }))} placeholder="Any city" />
          <JobField label="Work mode" value={locationDraft.mode} onChange={(value) => setLocationDraft((current) => ({ ...current, mode: value }))} options={['Any', ...workModes.slice(0, 3)]} />
          <JobField label="Preference" value={locationPriority} onChange={setLocationPriority} options={[['Highest', '1'], ['Medium', '2'], ['Flexible', '3']]} />
          <button className="button button-outline" type="submit"><Plus size={15} /> Add preference</button>
        </form>
        {locationPreferences.length > 0 && <div className="location-preference-list">{locationPreferences.map((item) => (
          <div className="location-preference-item" key={item.id}>
            <JobField label="Country" value={item.country || ''} onChange={(value) => updateLocationPreference(item.id, 'country', value)} placeholder={item.location || 'Any country'} />
            <JobField label="City" value={item.city || ''} onChange={(value) => updateLocationPreference(item.id, 'city', value)} placeholder="Any city" />
            <JobField label="Work mode" value={item.mode || 'Any'} onChange={(value) => updateLocationPreference(item.id, 'mode', value === 'Any' ? '' : value)} options={['Any', ...workModes.slice(0, 3)]} />
            <JobField label="Preference" value={String(item.priority || 1)} onChange={(value) => updateLocationPreference(item.id, 'priority', value)} options={[['Highest', '1'], ['Medium', '2'], ['Flexible', '3']]} />
            <button className="icon-button danger-button" type="button" onClick={() => removeLocationPreference(item.id)} aria-label="Remove location preference"><Trash2 size={15} /></button>
          </div>
        ))}</div>}
      </section>

      <details className="priority-guide">
        <summary><Target size={16} /><span>Target-role priorities</span><small>1 highest · all six families remain searchable</small></summary>
        <div className="priority-grid">{PRIORITY_FAMILIES.map((family) => <div className="priority-family" key={family.priority}><span>PRIORITY {family.priority}</span><strong>{family.label}</strong><p>{family.roles.join(' · ')}</p></div>)}</div>
      </details>

      <section className="panel job-filter-panel">
        <div className="job-panel-head"><div><SlidersHorizontal size={16} /><div><strong>Opportunity filters</strong><small>Location fields accept any country, city, region, or time zone.</small></div></div><button className="text-button" onClick={clearFilters}>Reset filters</button></div>
        <div className="job-filter-grid">
          <JobField label="Role or company" value={filters.role} onChange={(value) => setFilter('role', value)} placeholder="Any title or employer" />
          <JobField label="Priority family" value={filters.priority} onChange={(value) => setFilter('priority', value)} options={[["All priorities", ""], ...PRIORITY_FAMILIES.map((family) => [`${family.priority}. ${family.label}`, String(family.priority)])]} />
          <JobField label="Industry" value={filters.industry} onChange={(value) => setFilter('industry', value)} options={[["Any industry", ""], ...INDUSTRIES]} />
          <JobField label="Country" value={filters.country} onChange={(value) => setFilter('country', value)} placeholder="Any country" />
          <JobField label="Region / state" value={filters.region} onChange={(value) => setFilter('region', value)} placeholder="Any region" />
          <JobField label="City" value={filters.city} onChange={(value) => setFilter('city', value)} placeholder="Any city" />
          <JobField label="Time zone" value={filters.timeZone} onChange={(value) => setFilter('timeZone', value)} placeholder="e.g. UTC+5:30" />
          <JobField label="Work mode" value={filters.mode} onChange={(value) => setFilter('mode', value)} options={[["Remote, hybrid or on-site", ""], ...['Remote', 'Hybrid', 'On-site', 'Unknown']]} />
          <JobField label="Remote eligible in" value={filters.remoteCountry} onChange={(value) => setFilter('remoteCountry', value)} placeholder="Any country / verify" />
          <JobField label="Experience" value={filters.experience} onChange={(value) => setFilter('experience', value)} options={[["Any experience", ""], ...EXPERIENCE_OPTIONS]} />
          <JobField label="Employment type" value={filters.employmentType} onChange={(value) => setFilter('employmentType', value)} options={[["Any type", ""], ...employmentTypes]} />
          <JobField label="Employer authorization wording" value={filters.authorization} onChange={(value) => setFilter('authorization', value)} options={[["Any / unverified", ""], ...authOptions]} />
          <JobField label="Visa sponsorship" value={filters.sponsorship} onChange={(value) => setFilter('sponsorship', value)} options={[["Any / unverified", ""], ...sponsorshipOptions]} />
          <JobField label="Verified salary currency" value={filters.currency} onChange={(value) => setFilter('currency', value)} placeholder="Exact code: INR, USD..." />
          <JobField label="Minimum salary (same currency)" value={filters.minimumSalary} onChange={(value) => setFilter('minimumSalary', value)} type="number" min="0" />
          <JobField label="Maximum salary (same currency)" value={filters.maximumSalary} onChange={(value) => setFilter('maximumSalary', value)} type="number" min="0" />
          <JobField label="Verified deadline on/before" value={filters.deadlineBefore} onChange={(value) => setFilter('deadlineBefore', value)} type="date" />
          <label className="job-check-field"><input type="checkbox" checked={filters.verifiedSalaryOnly} onChange={(event) => setFilter('verifiedSalaryOnly', event.target.checked)} /><span>Show verified salary listings only</span></label>
        </div>
      </section>

      {isAdding && <form className="panel job-entry-panel" onSubmit={saveJob}>
        <div className="job-panel-head"><div><BriefcaseBusiness size={17} /><div><strong>Add a role you checked at its source</strong><small>Unknown facts stay unknown. No listing is fetched or verified by this app.</small></div></div><button type="button" className="icon-button" aria-label="Close form" onClick={() => setIsAdding(false)}>×</button></div>
        <div className="job-entry-grid">
          <JobField label="Job title" value={draft.title} onChange={(value) => setDraftField('title', value)} required placeholder="Exact title from posting" />
          <JobField label="Employer" value={draft.company} onChange={(value) => setDraftField('company', value)} required placeholder="Employer name" />
          <JobField label="Priority family" value={String(draft.priority || priorityForRole(draft.title))} onChange={(value) => setDraftField('priority', value)} options={PRIORITY_FAMILIES.map((family) => [`${family.priority}. ${family.label}`, String(family.priority)])} />
          <JobField label="Industry" value={draft.industry} onChange={(value) => setDraftField('industry', value)} options={[["Choose if stated", ""], ...INDUSTRIES]} />
          <JobField label="Country (exact listing location)" value={draft.country} onChange={(value) => setDraftField('country', value)} placeholder="Not stated if unknown" />
          <JobField label="Region / state" value={draft.region} onChange={(value) => setDraftField('region', value)} placeholder="Not stated if unknown" />
          <JobField label="City" value={draft.city} onChange={(value) => setDraftField('city', value)} placeholder="Not stated if unknown" />
          <JobField label="Time-zone expectation" value={draft.timeZone} onChange={(value) => setDraftField('timeZone', value)} placeholder="Exact wording or not stated" />
          <JobField label="Work mode" value={draft.mode} onChange={(value) => setDraftField('mode', value)} options={workModes} />
          <JobField label="Remote eligible countries" value={draft.remoteEligibleCountries} onChange={(value) => setDraftField('remoteEligibleCountries', value)} placeholder="List only if source says so" />
          <JobField label="Relocation requirement" value={draft.relocationRequirement} onChange={(value) => setDraftField('relocationRequirement', value)} options={['Unknown', 'Required', 'Not required', 'Optional - verify']} />
          <JobField label="Experience level" value={draft.experienceLevel} onChange={(value) => setDraftField('experienceLevel', value)} options={EXPERIENCE_OPTIONS} />
          <JobField label="Minimum years (if stated)" value={draft.minimumYears} onChange={(value) => setDraftField('minimumYears', value)} type="number" min="0" step="1" />
          <JobField label="Employment type" value={draft.employmentType} onChange={(value) => setDraftField('employmentType', value)} options={employmentTypes} />
          <JobField label="Work authorization wording" value={draft.workAuthorizationRequirement} onChange={(value) => setDraftField('workAuthorizationRequirement', value)} options={authOptions} />
          <JobField label="Visa sponsorship wording" value={draft.visaSponsorship} onChange={(value) => setDraftField('visaSponsorship', value)} options={sponsorshipOptions} />
          <JobField label="Language requirement" value={draft.languageRequirement} onChange={(value) => setDraftField('languageRequirement', value)} placeholder="Exact listing text or not stated" />
          <JobField label="Career growth signal" value={draft.growthSignal} onChange={(value) => setDraftField('growthSignal', value)} options={['Unknown', 'Strong', 'Some', 'Limited']} />
          <JobField label="Salary currency (original)" value={draft.currency} onChange={(value) => setDraftField('currency', value.toUpperCase())} placeholder="Exact ISO code, e.g. INR or USD" />
          <JobField label="Salary minimum" value={draft.salaryMinimum} onChange={(value) => setDraftField('salaryMinimum', value)} type="number" min="0" />
          <JobField label="Salary maximum" value={draft.salaryMaximum} onChange={(value) => setDraftField('salaryMaximum', value)} type="number" min="0" />
          <JobField label="Salary source URL" value={draft.salarySource} onChange={(value) => setDraftField('salarySource', value)} placeholder="Link where range and currency appear" />
          <JobField label="Application deadline" value={draft.deadline} onChange={(value) => setDraftField('deadline', value)} type="date" />
          <JobField label="Deadline source URL" value={draft.deadlineSource} onChange={(value) => setDraftField('deadlineSource', value)} placeholder="Link showing the date" />
          <JobField label="Original job posting URL" value={draft.jobUrl} onChange={(value) => setDraftField('jobUrl', value)} placeholder="https://..." />
          <JobField label="Required skills (listing wording)" value={draft.requiredSkills.join(', ')} onChange={(value) => setDraftField('requiredSkills', value)} placeholder="Comma-separated; do not infer" />
          <label className="job-check-field"><input type="checkbox" checked={draft.salaryVerified} onChange={(event) => setDraftField('salaryVerified', event.target.checked)} /><span>Salary range and currency verified at source</span></label>
          <label className="job-check-field"><input type="checkbox" checked={draft.deadlineVerified} onChange={(event) => setDraftField('deadlineVerified', event.target.checked)} /><span>Deadline verified at source</span></label>
          <label className="job-check-field"><input type="checkbox" checked={draft.sourceVerified} onChange={(event) => setDraftField('sourceVerified', event.target.checked)} /><span>I reviewed this posting at its source</span></label>
          <label className="job-field job-description-field"><span>Job description (paste text for local analysis)</span><textarea rows={7} value={draft.description} onChange={(event) => setDraftField('description', event.target.value)} placeholder="Paste the original description. Analysis stays in this browser." /></label>
        </div>
        <div className="job-form-actions"><span>Salary is shown only when you mark both source and currency verified. No conversion is performed.</span><button className="button button-primary" type="submit"><Plus size={16} /> Save role</button></div>
      </form>}

      <section className="panel jd-analyzer">
        <div className="job-panel-head"><div><Search size={17} /><div><strong>Job-description analyser</strong><small>Local keyword/evidence scan only; it does not use AI or confirm employer claims.</small></div></div></div>
        <textarea className="jd-input" value={descriptionText} onChange={(event) => setDescriptionText(event.target.value)} rows={6} placeholder="Paste a job description. We’ll show exact requirement clues found in the text and what it does not specify." />
        <div className="analyzer-actions"><span>Text is analyzed in your browser and is not uploaded.</span><button className="button button-outline" disabled={!descriptionText.trim()} onClick={analyzeDescription}><Search size={15} /> Analyze description</button></div>
        {analysis && <div className="analysis-results">
          <div className="analysis-result-head"><CircleAlert size={17} /><div><strong>Evidence found in pasted text</strong><small>Absence from this scan does not mean a requirement does not exist; verify the full posting.</small></div><button className="button button-quiet" onClick={startFromAnalysis}><Plus size={15} /> Save as listing</button></div>
          <div className="analysis-grid">
            <Evidence title="Experience clues" items={analysis.experienceEvidence} empty="No years-of-experience phrase found." value={analysis.minimumYears === null ? '' : `Minimum stated years detected: ${analysis.minimumYears}; check context.`} />
            <Evidence title="Education clues" items={analysis.educationEvidence} empty="No education-equivalency wording found." />
            <Evidence title="Work authorization" items={analysis.authorizationEvidence} empty="Not specified in scanned text." />
            <Evidence title="Visa sponsorship" items={analysis.sponsorshipEvidence} empty="Not specified in scanned text." />
            <Evidence title="Location / work mode" items={analysis.remoteEvidence} empty="Not specified in scanned text." />
            <Evidence title="Language requirements" items={analysis.languageEvidence} empty="No supported language phrase found; verify manually." />
            <Evidence title="Salary in original currency" items={analysis.salaryEvidence} empty="No explicit currency/range pattern found; do not infer or convert." />
            <Evidence title="Application deadline" items={analysis.deadlineEvidence} empty="No explicit deadline date found." />
          </div>
          <div className="skill-evidence">
            <strong>Skills compared with your profile</strong>
            <div className="skill-match-columns">
              <div><b>Matched</b>{analysis.matchedProfileSkills.length ? analysis.matchedProfileSkills.map((skill) => <span className="recorded" key={skill}>{skill}</span>) : <small>No detected skills currently match the skills you listed.</small>}</div>
              <div><b>Missing from profile</b>{analysis.missingSkills.length ? analysis.missingSkills.map((skill) => <span key={skill}>{skill}</span>) : <small>No detected skill gaps. This local keyword scan is not a complete assessment.</small>}</div>
            </div>
            <p>“Missing” means the skill was not found in your profile text; it is not a judgment of your ability.</p>
          </div>
        </div>}
      </section>

      <section className="job-results-section">
        <div className="job-results-heading"><div><p className="eyebrow">USER-VERIFIED OPPORTUNITIES ONLY</p><h2>{scoredJobs.length} saved {scoredJobs.length === 1 ? 'role' : 'roles'}</h2></div><span>Ranked with transparent planning signals · not an eligibility decision</span></div>
        {scoredJobs.length ? <div className="job-result-list">{scoredJobs.map(({ job, fit }) => {
          const tracked = findJobApplication(job, applications);
          return <article className="job-result" key={job.id}>
          <div className="job-card-top"><div className="job-company-mark">{(job.company || '?').slice(0, 1).toUpperCase()}</div><div className="job-heading-copy"><div className="job-title-line"><h3>{job.title}</h3><span className="priority-badge">P{fit.priority}</span>{fit.stretch && <span className="stretch-badge">STRETCH ROLE</span>}</div><strong>{job.company}</strong><div className="job-location-line"><span>{[job.city, job.region, job.country].filter(Boolean).join(', ') || 'Location not stated'}</span><span>{job.mode || 'Work mode not stated'}</span><span>{job.employmentType || 'Employment type not stated'}</span></div></div><div className="job-fit-score"><strong>{fit.score}</strong><span>FIT SIGNAL</span></div></div>
          <div className="job-facts-row"><span><b>Priority {fit.priority}</b> · {PRIORITY_FAMILIES[fit.priority - 1]?.label || 'Other relevant role'}</span><span>Experience: {job.experienceLevel || 'Unknown'}</span><span>Auth: {job.workAuthorizationRequirement || 'Not stated'}</span><span>Visa: {job.visaSponsorship || 'Not stated'}</span><span>Deadline: {job.deadline && job.deadlineVerified ? job.deadline : 'Unverified / not stated'}</span></div>
          <div className="job-card-actions"><label className="job-stage-control">Status <select value={job.stage || 'Saved'} onChange={(event) => updateJob(job.id, { stage: event.target.value })}>{['Saved', 'Reviewing', 'Applied', 'Interviewing', 'Offer', 'Closed'].map((stage) => <option key={stage}>{stage}</option>)}</select></label><button className="button button-outline track-job-button" disabled={Boolean(tracked)} onClick={() => onTrackApplication(job)}>{tracked ? 'In tracker' : 'Track application'}</button><button className="text-button" onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}>{expandedJob === job.id ? 'Hide details' : 'Eligibility & score details'}</button><button className="text-button" onClick={() => onTailorResume(job)}><FileText size={14} /> Tailor resume</button><button className="text-button" onClick={() => onCreateLetter(job)}><Plus size={14} /> Draft cover letter</button><button className="icon-button danger-button" onClick={() => removeJob(job.id)} aria-label={`Remove ${job.title}`}><Trash2 size={15} /></button></div>
          {expandedJob === job.id && <div className="job-expanded">
            <div className="job-detail-grid"><Fact label="Region" value={job.region} /><Fact label="City" value={job.city} /><Fact label="Time zone" value={job.timeZone || 'Not stated'} /><Fact label="Relocation" value={job.relocationRequirement || 'Unknown'} /><Fact label="Employer authorization wording" value={job.workAuthorizationRequirement || 'Not stated'} /><Fact label="Visa sponsorship wording" value={job.visaSponsorship || 'Not stated'} /><Fact label="Language" value={job.languageRequirement || 'Not stated'} /><Fact label="Remote eligible countries" value={job.remoteEligibleCountries || 'Not stated; verify'} /><Fact label="Salary" value={job.salaryVerified && job.currency ? `${job.salaryMinimum || '—'}–${job.salaryMaximum || '—'} ${job.currency}` : 'Not verified; hidden'} /><Fact label="Source reviewed" value={job.sourceVerified ? 'Marked reviewed by you' : 'Not yet verified'} /></div>
            {job.salaryVerified && safeUrl(job.salarySource) && <a className="source-evidence-link" href={safeUrl(job.salarySource)} target="_blank" rel="noreferrer">Salary source<ExternalLink size={12} /></a>}
            {job.deadlineVerified && safeUrl(job.deadlineSource) && <a className="source-evidence-link" href={safeUrl(job.deadlineSource)} target="_blank" rel="noreferrer">Deadline source<ExternalLink size={12} /></a>}
            {safeUrl(job.jobUrl) && <a className="source-evidence-link" href={safeUrl(job.jobUrl)} target="_blank" rel="noreferrer">Open original posting<ExternalLink size={12} /></a>}
            <div className="fit-breakdown"><strong>How this planning score was formed</strong><div>{Object.entries(fit.factors).map(([label, value]) => <span key={label}>{label}<b>{value}</b></span>)}</div><small>Unknown authorization is not treated as eligible. Self-reported skills are not independently validated.</small></div>
            {fit.stretch && <div className="stretch-note"><strong>Experience may make this a stretch role.</strong><span>Consider stepping stones such as Product Analyst, Product Operations Associate, or an explicitly entry-level Associate Product Manager posting.</span></div>}
            {isInternational(job) ? <div className="international-checklist"><div><Globe2 size={16} /><strong>International role checklist · review each item yourself</strong></div><div className="checklist-grid">{CHECKLIST_ITEMS.map(([key, label]) => <label key={key}><span>{label}</span><select value={job.eligibilityChecklist?.[key] || 'unknown'} onChange={(event) => updateJob(job.id, { eligibilityChecklist: { ...emptyChecklist(), ...job.eligibilityChecklist, [key]: event.target.value } })}>{checklistStates.map(([value, stateLabel]) => <option key={value} value={value}>{stateLabel}</option>)}</select></label>)}</div><small>No citizenship, visa, work rights, education equivalency, language ability, or time-zone fit is assumed by this app.</small></div> : !job.country ? <p className="missing-country-note"><CircleAlert size={14} /> Country not recorded. Confirm the exact role location before evaluating international eligibility.</p> : <p className="domestic-note"><BadgeCheck size={14} /> Confirm country-specific authorization requirements from the employer; none are assumed.</p>}
            {job.description && <details className="source-description"><summary>Original description text saved by you</summary><p>{job.description}</p></details>}
          </div>}
        </article>;
        })}</div> : <div className="empty-jobs"><Globe2 size={25} /><h3>{jobs.length ? 'No saved roles match these filters.' : 'No listings are being presented as current.'}</h3><p>{jobs.length ? 'Adjust filters or clear them to see your saved opportunities.' : 'Search external job boards, verify a posting and its details, then add it here. The app does not invent openings or fetch live jobs.'}</p>{!jobs.length && <button className="button button-outline" onClick={() => setIsAdding(true)}><Plus size={15} /> Add a role you verified</button>}</div>}
      </section>
    </>
  );
}

function Evidence({ title, items, empty, value }) {
  return <div className="evidence-item"><strong>{title}</strong>{value && <span className="evidence-value">{value}</span>}{items.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>“{item}”</li>)}</ul> : <p>{empty}</p>}</div>;
}

function Fact({ label, value }) {
  return <div className="job-fact"><span>{label}</span><strong>{value || 'Not stated'}</strong></div>;
}