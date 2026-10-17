import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileText,
  HardDrive,
  Image as ImageIcon,
  Lightbulb,
  Linkedin,
  Mail,
  MessageSquareText,
  Plus,
  Route,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import JobDiscovery from './JobDiscovery';
import { applicationStageForJob, applicationStageToJob, countJobsByStatus, JOB_STATUSES, jobNextActions, normalizeJobStage, upsertJobApplication } from './job-planning.js';
import { downloadJobsCsv } from './job-export.js';
import ProfileEditor from './ProfileEditor.jsx';
import ResumeBuilder from './ResumeBuilder.jsx';
import DataStorage from './DataStorage.jsx';
import { buildCoverLetterDraft, confirmedSkillNames, normalizeFacts } from './profile-facts.js';
import { copyText, downloadBlob } from './browser-actions.js';
import { mergeImportedData } from './data-transfer.js';
import {
  COMBINED_LEARNING_PLAN,
  mergeLearningPlan,
  mergeSkillAssessments,
  removeLegacyRoadmapSamples,
} from './learning-plan.js';

const STORAGE_KEY = 'career-studio-v1';

const initialData = {
  profile: {
    name: '',
    role: '',
    city: '',
    email: '',
    headline: '',
    skills: '',
    education: '',
    expectedGraduation: '',
    selfReportedLevel: '',
    phone: '',
    linkedin: '',
    summaryConfirmed: false,
  },
  facts: normalizeFacts(undefined, {}),
  lastBackupAt: '',
  resume: {
    summary: '',
    experience: '',
    targetJobId: '',
  },
  applications: [
    { id: 1, company: 'Linear', role: 'Product Designer', stage: 'Interviewing', date: '2026-10-08', isDemo: true },
    { id: 2, company: 'Notion', role: 'Senior Product Designer', stage: 'Applied', date: '2026-10-05', isDemo: true },
    { id: 3, company: 'Figma', role: 'Product Designer, Growth', stage: 'Researching', date: '2026-10-02', isDemo: true },
  ],
  jobs: [],
  locationPreferences: [],
  learningPlan: COMBINED_LEARNING_PLAN,
  letters: [],
  research: [],
  posts: [],
  imagePrompts: [],
  prep: {
    checks: [false, false, false, false],
  },
  skills: mergeSkillAssessments([]),
  roadmap: COMBINED_LEARNING_PLAN,
};

const navigation = [
  { label: 'Overview', icon: Sparkles },
  { label: 'Career profile', icon: UserRound },
  { label: 'Resume builder', icon: FileText },
  { label: 'Cover letters', icon: Mail },
  { label: 'Job discovery', icon: BriefcaseBusiness },
  { label: 'Applications', icon: BriefcaseBusiness },
  { label: 'Company research', icon: Building2 },
  { label: 'LinkedIn drafts', icon: Linkedin },
  { label: 'LinkedIn image prompts', icon: ImageIcon },
  { label: 'Interview prep', icon: MessageSquareText },
  { label: 'Skill gaps', icon: Target },
  { label: 'Career roadmap', icon: Route },
  { label: 'Prompt builder', icon: Lightbulb },
  { label: 'Data & storage', icon: HardDrive },
];

function loadData() {
  let saved;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return { data: initialData, error: `Browser storage could not be read: ${error.message}` };
  }
  if (!saved) return { data: initialData, error: '' };

  let parsed;
  try {
    parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Saved workspace data must be a JSON object.');
    }
  } catch (error) {
    return { data: initialData, error: `Saved browser data could not be read safely: ${error.message}` };
  }

  try {
    const profile = { ...initialData.profile, ...(parsed.profile && typeof parsed.profile === 'object' && !Array.isArray(parsed.profile) ? parsed.profile : {}) };
    const resume = { ...initialData.resume, ...(parsed.resume && typeof parsed.resume === 'object' && !Array.isArray(parsed.resume) ? parsed.resume : {}) };
    const prep = { ...initialData.prep, ...(parsed.prep && typeof parsed.prep === 'object' && !Array.isArray(parsed.prep) ? parsed.prep : {}) };
    for (const [key, value] of Object.entries(initialData.profile)) {
      if (typeof profile[key] !== typeof value) profile[key] = value;
    }
    for (const [key, value] of Object.entries(initialData.resume)) {
      if (typeof resume[key] !== 'string') resume[key] = value === undefined ? '' : String(resume[key] ?? value);
    }
    if (!Array.isArray(prep.checks)) prep.checks = initialData.prep.checks;
    return {
      data: {
        ...initialData,
        ...parsed,
        profile,
        resume,
        prep,
        facts: normalizeFacts(parsed.facts, profile),
        lastBackupAt: typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : '',
        applications: Array.isArray(parsed.applications)
          ? parsed.applications.map((application) => {
            if (!application || typeof application !== 'object') {
              return { id: `legacy-${String(application)}`, company: '', role: '', stage: 'Researching', date: '', legacyValue: application };
            }
            const sample = initialData.applications.find((item) => item.id === application.id && item.company === application.company && item.role === application.role);
            return sample ? { ...application, isDemo: true } : application;
          })
          : initialData.applications,
        jobs: Array.isArray(parsed.jobs)
          ? parsed.jobs.filter((job) => job && typeof job === 'object').map((job) => ({ ...job, stage: normalizeJobStage(job.stage) }))
          : initialData.jobs,
        locationPreferences: Array.isArray(parsed.locationPreferences) ? parsed.locationPreferences.filter((item) => item && typeof item === 'object') : initialData.locationPreferences,
        learningPlan: mergeLearningPlan(parsed.learningPlan),
        letters: Array.isArray(parsed.letters) ? parsed.letters.filter((letter) => letter && typeof letter === 'object') : initialData.letters,
        research: Array.isArray(parsed.research) ? parsed.research.filter((note) => note && typeof note === 'object') : initialData.research,
        posts: Array.isArray(parsed.posts) ? parsed.posts.filter((post) => post && typeof post === 'object') : initialData.posts,
        imagePrompts: Array.isArray(parsed.imagePrompts) ? parsed.imagePrompts.filter((prompt) => prompt && typeof prompt === 'object') : initialData.imagePrompts,
        skills: mergeSkillAssessments(Array.isArray(parsed.skills) ? parsed.skills : initialData.skills),
        roadmap: mergeLearningPlan(parsed.learningPlan, removeLegacyRoadmapSamples(parsed.roadmap)),
      },
      error: '',
    };
  } catch (error) {
    return { data: initialData, error: `Saved workspace data could not be migrated safely: ${error.message}` };
  }
}

function SectionTitle({ eyebrow, title, description, action }) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Field({ label, value, onChange, as = 'input', rows = 4, placeholder = '' }) {
  const common = { value, onChange: (event) => onChange(event.target.value), placeholder };
  return (
    <label className="field">
      <span>{label}</span>
      {as === 'textarea' ? <textarea rows={rows} {...common} /> : <input {...common} />}
    </label>
  );
}

function App() {
  const [loaded] = useState(loadData);
  const [data, setData] = useState(loaded.data);
  const [storageError, setStorageError] = useState(loaded.error);
  const [storageReady, setStorageReady] = useState(!loaded.error);
  const [activeView, setActiveView] = useState('Overview');
  const [toast, setToast] = useState('');
  const importInput = useRef(null);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      setStorageError(`Changes could not be saved in this browser: ${error.message}`);
      setStorageReady(false);
    }
  }, [data, storageReady]);

  const update = (key, value) => setData((current) => ({ ...current, [key]: value }));
  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const exportData = () => {
    try {
      const backedUpAt = new Date().toISOString();
      const file = new Blob([JSON.stringify({ ...data, lastBackupAt: backedUpAt }, null, 2)], { type: 'application/json' });
      downloadBlob(file, `career-studio-backup-${backedUpAt.slice(0, 10)}.json`);
      update('lastBackupAt', backedUpAt);
      notify('Backup file downloaded. On iPad, find it in Files > Downloads and move it to iCloud Drive.');
    } catch (error) {
      notify(`Your data could not be exported: ${error.message}`);
    }
  };

  const exportJobsCsv = () => {
    if (!data.jobs.length) {
      notify('No saved jobs yet. Add a job first, then export the CSV.');
      return;
    }
    try {
      downloadJobsCsv(data.jobs);
      notify(`Job tracker exported as CSV (${data.jobs.length} ${data.jobs.length === 1 ? 'job' : 'jobs'}).`);
    } catch (error) {
      notify(`The CSV could not be exported: ${error.message}`);
    }
  };

  const importData = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      const merged = mergeImportedData(data, imported);
      setData({
        ...merged,
        facts: normalizeFacts(merged.facts, merged.profile),
        jobs: (Array.isArray(merged.jobs) ? merged.jobs : []).map((job) => ({ ...job, stage: normalizeJobStage(job.stage) })),
      });
      setStorageError(storageReady ? '' : 'Browser storage is unavailable; the imported data is visible in this session but is not saved over the existing storage.');
      notify(storageReady ? 'Data imported and merged. Existing saved records were kept.' : 'Data imported for this session but could not be saved safely.');
    } catch (error) {
      setStorageError(`Import failed. Existing saved data was not changed: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };

  const createLetterFromRole = (job) => {
    const letterBody = buildCoverLetterDraft(data.profile, data.facts, job).text;
    const draft = {
      id: Date.now(),
      company: job.company || 'New company',
      role: job.title || 'Role title',
      body: letterBody,
      jobId: job.id,
      updated: 'Just now',
    };
    update('letters', [draft, ...data.letters]);
    setActiveView('Cover letters');
    notify(`Cover letter draft created for ${job.company || job.title || 'the role'}.`);
  };

  const tailorResumeFromRole = (job) => {
    update('resume', { ...data.resume, targetJobId: String(job.id) });
    setActiveView('Resume builder');
    notify(`Resume draft tailored for ${job.title || 'the selected job'} using your confirmed facts.`);
  };

  const trackJobApplication = (job) => {
    setData((current) => {
      const result = upsertJobApplication(job, current.applications);
      return {
        ...current,
        applications: result.applications,
        jobs: current.jobs.map((item) => item.id === job.id
          ? { ...item, linkedApplicationId: result.application.id }
          : item),
      };
    });
    notify('Opportunity is linked to your application tracker.');
  };

  const updateJob = (jobId, changes) => {
    setData((current) => {
      const job = current.jobs.find((item) => item.id === jobId);
      const linkedApplication = current.applications.find((application) => (
        application.jobId === jobId || application.id === job?.linkedApplicationId
      ));
      return {
        ...current,
        jobs: current.jobs.map((item) => item.id === jobId
          ? { ...item, ...changes, ...(changes.stage && changes.stage !== item.stage ? { statusChangedAt: new Date().toISOString() } : {}) }
          : item),
        applications: changes.stage && linkedApplication
          ? current.applications.map((application) => application.id === linkedApplication.id
            ? { ...application, stage: applicationStageForJob(changes.stage) }
            : application)
          : current.applications,
      };
    });
  };

  const updateApplicationStage = (applicationId, stage) => {
    setData((current) => {
      const application = current.applications.find((item) => item.id === applicationId);
      const linkedJob = current.jobs.find((job) => (
        job.id === application?.jobId || job.linkedApplicationId === applicationId
      ));
      return {
        ...current,
        applications: current.applications.map((item) => item.id === applicationId ? { ...item, stage } : item),
        jobs: linkedJob
          ? current.jobs.map((job) => {
            if (job.id !== linkedJob.id) return job;
            const earlyStage = ['Saved', 'Interested', 'Preparing'].includes(normalizeJobStage(job.stage));
            if (stage === 'Researching' && earlyStage) return job;
            return { ...job, stage: applicationStageToJob(stage), statusChangedAt: new Date().toISOString() };
          })
          : current.jobs,
      };
    });
  };

  // Job matching uses confirmed profile skills only, the same facts drafts are allowed to use.
  const jobMatchingData = { ...data, profile: { ...data.profile, skills: confirmedSkillNames(data.facts).join(', ') } };

  const page = {
    Overview: <Overview data={data} onNavigate={setActiveView} />,
    'Career profile': <ProfileEditor data={data} update={update} getInitials={getInitials} />,
    'Resume builder': <ResumeBuilder data={data} update={update} notify={notify} onNavigate={setActiveView} />,
    'Cover letters': <CoverLetters data={data} update={update} notify={notify} onCreateFromJob={createLetterFromRole} />,
    'Job discovery': <JobDiscovery data={jobMatchingData} update={update} notify={notify} onCreateLetter={createLetterFromRole} onTailorResume={tailorResumeFromRole} onTrackApplication={trackJobApplication} onUpdateJob={updateJob} onExportCsv={exportJobsCsv} />,
    Applications: <Applications data={data} update={update} onUpdateStage={updateApplicationStage} />,
    'Company research': <Research data={data} update={update} />,
    'LinkedIn drafts': <LinkedInDrafts data={data} update={update} />,
    'LinkedIn image prompts': <LinkedInImagePrompts data={data} update={update} notify={notify} />,
    'Interview prep': <InterviewPrep data={data} update={update} />,
    'Skill gaps': <SkillGaps data={data} update={update} />,
    'Career roadmap': <Roadmap data={data} update={update} />,
    'Prompt builder': <PromptBuilder data={data} notify={notify} />,
    'Data & storage': <DataStorage data={data} storageReady={storageReady} onExportJson={exportData} onExportCsv={exportJobsCsv} onImport={() => importInput.current?.click()} />,
  }[activeView];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setActiveView('Overview'); }}>
          <span className="brand-mark"><Sparkles size={19} strokeWidth={1.9} /></span>
          <span>career<span className="brand-light">studio</span><small>YOUR NEXT CHAPTER, PLANNED</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Career workspace">
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link ${activeView === label ? 'active' : ''}`} onClick={() => setActiveView(label)}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {activeView === label && <span className="nav-current" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-mark"><BadgeCheck size={16} /><span>Your work stays yours</span></div>
          <p>Saved in this browser only.<br />No account or API connection.</p>
          <div className="side-user">
            <span className="avatar">{getInitials(data.profile.name)}</span>
            <span><strong>{data.profile.name || 'Your profile'}</strong><small>{data.profile.role || 'Career workspace'}</small></span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Career Studio</span><ChevronRight size={14} /><strong>{activeView}</strong></div>
          <div className="topbar-right"><span className="local-pill"><span /> Saved locally</span><span className="top-avatar">{getInitials(data.profile.name)}</span></div>
        </header>
        <div className="mobile-nav" aria-label="Career workspace">
          {navigation.map(({ label, icon: Icon }) => (
            <button key={label} className={activeView === label ? 'selected' : ''} onClick={() => setActiveView(label)} aria-label={label} title={label}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </div>
        <div className="data-tools">
          <button className="button button-outline" onClick={exportData}><Download size={15} /> Export my data</button>
          <button className="button button-outline" onClick={exportJobsCsv}><Download size={15} /> Export jobs CSV</button>
          <button className="button button-outline" onClick={() => importInput.current?.click()}><Upload size={15} /> Import my data</button>
          <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importData} />
        </div>
        {storageError && <div className="storage-warning" role="alert">{storageError} Saved data has not been overwritten.</div>}
        <div className="content-wrap" key={activeView}>{page}</div>
        <footer className="app-footer"><span>Career Studio</span><span>Private by design · Your changes save to this browser</span></footer>
      </main>
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'CS';
}

function Overview({ data, onNavigate }) {
  const applied = data.applications.filter((item) => item.stage === 'Applied').length;
  const interviewing = data.applications.filter((item) => item.stage === 'Interviewing').length;
  const roadmapDone = data.roadmap.filter((item) => item.status === 'Done').length;
  const prepDone = data.prep.checks.filter(Boolean).length;
  const nextMilestone = data.roadmap.find((item) => item.status !== 'Done');
  const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();
  return (
    <>
      <div className="welcome-row">
        <div><p className="eyebrow">{today}</p><h1>{greeting()}, {data.profile.name.split(' ')[0] || 'there'}.</h1><p className="section-description">A clear next step makes the whole search feel lighter.</p></div>
        <button className="button button-primary" onClick={() => onNavigate('Applications')}><Plus size={16} /> Add application</button>
      </div>
      <section className="hero-band">
        <div className="hero-copy"><span className="hero-kicker"><span className="hero-dot" /> YOUR CAREER, IN MOTION</span><h2>Make your next move<br />a little more <em>intentional.</em></h2><p>Keep the story, the strategy, and the small wins in one place.</p><button className="hero-link" onClick={() => onNavigate('Career roadmap')}>View your roadmap <ArrowUpRight size={16} /></button></div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><Sparkles size={30} /></div><span className="orbit-label label-one">STAY CURIOUS</span><span className="orbit-label label-two">KEEP GOING</span><span className="orbit-number">{Math.round((roadmapDone / Math.max(1, data.roadmap.length)) * 100)}<small>%</small></span></div>
      </section>
      <section className="stats-grid" aria-label="Career snapshot">
        <Stat icon={BriefcaseBusiness} label="Applications" value={data.applications.length} note={`${applied} recently applied`} tone="green" />
        <Stat icon={MessageSquareText} label="In conversation" value={interviewing} note="Keep your prep close" tone="coral" />
        <Stat icon={FileText} label="Drafts in progress" value={data.letters.length + data.posts.length} note="Letters and LinkedIn posts" tone="yellow" />
        <Stat icon={Route} label="Roadmap progress" value={`${roadmapDone}/${data.roadmap.length}`} note="Small steps add up" tone="blue" />
      </section>
      <JobDashboard jobs={data.jobs} onNavigate={onNavigate} />
      <div className="overview-grid">
        <section className="panel pipeline-panel">
          <div className="panel-heading"><div><p className="eyebrow">YOUR SEARCH</p><h3>Application pipeline</h3></div><button className="text-button" onClick={() => onNavigate('Applications')}>See all <ArrowUpRight size={15} /></button></div>
          <div className="pipeline-bars">{['Researching', 'Applied', 'Interviewing', 'Offer'].map((stage, index) => {
            const count = data.applications.filter((item) => item.stage === stage).length;
            return <div className="pipeline-step" key={stage}><div className="pipeline-label"><span>{stage}</span><strong>{count.toString().padStart(2, '0')}</strong></div><div className="pipeline-track"><span className={`pipeline-fill fill-${index}`} style={{ width: `${Math.min(100, count * 36)}%` }} /></div></div>;
          })}</div>
          <div className="panel-divider" />
          <div className="recent-list">{data.applications.slice(0, 3).map((item) => <div className="recent-row" key={item.id}><span className="company-stamp">{item.company.slice(0, 1)}</span><span className="recent-company"><strong>{item.company}</strong><small>{item.role}{item.isDemo && <span className="demo-badge">DEMO</span>}</small></span><StageBadge stage={item.stage} /><span className="recent-date">{formatShortDate(item.date)}</span></div>)}</div>
        </section>
        <section className="panel focus-panel">
          <div className="panel-heading"><div><p className="eyebrow">A GOOD NEXT STEP</p><h3>This week</h3></div><span className="week-marker">WEEK {isoWeek(new Date())}</span></div>
          {nextMilestone ? <button className="focus-action" onClick={() => onNavigate('Career roadmap')}><span className="focus-icon"><Target size={18} /></span><span><small>ROADMAP MILESTONE</small><strong>{nextMilestone.title}</strong><span>{nextMilestone.detail}</span></span><ChevronRight size={17} /></button> : <p className="empty-note">Your roadmap is clear for now. Add a milestone when a new goal takes shape.</p>}
          <div className="focus-footer"><div className="mini-progress"><span style={{ width: `${(prepDone / data.prep.checks.length) * 100}%` }} /></div><span>{prepDone} of {data.prep.checks.length} interview prep steps done</span><button className="icon-button" onClick={() => onNavigate('Interview prep')} aria-label="Open interview preparation"><ArrowUpRight size={16} /></button></div>
        </section>
      </div>
      <section className="quick-tools"><div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h3>Your toolkit</h3></div><div className="quick-tools-list">{[
        { title: 'Shape your story', label: 'Resume builder', icon: FileText, tint: 'quick-green' },
        { title: 'Research with intent', label: 'Company research', icon: Building2, tint: 'quick-yellow' },
        { title: 'Practice out loud', label: 'Interview prep', icon: MessageSquareText, tint: 'quick-coral' },
      ].map(({ title, label, icon: Icon, tint }) => <button className="quick-tool" key={label} onClick={() => onNavigate(label)}><span className={`quick-icon ${tint}`}><Icon size={18} /></span><span><strong>{title}</strong><small>{label}</small></span><ArrowUpRight size={15} /></button>)}</div></section>
    </>
  );
}

function isoWeek(date) {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function JobDashboard({ jobs, onNavigate }) {
  const savedJobs = Array.isArray(jobs) ? jobs.filter((job) => job && typeof job === 'object') : [];
  const counts = countJobsByStatus(savedJobs);
  const actions = jobNextActions(savedJobs).slice(0, 4);
  const recent = [...savedJobs]
    .sort((first, second) => String(second.createdAt || '').localeCompare(String(first.createdAt || '')))
    .slice(0, 4);
  return (
    <section className="panel job-dashboard" aria-label="Job tracker summary">
      <div className="panel-heading"><div><p className="eyebrow">MY JOB TRACKER</p><h3>{savedJobs.length} saved {savedJobs.length === 1 ? 'job' : 'jobs'}</h3></div><button className="text-button" onClick={() => onNavigate('Job discovery')}>Open tracker <ArrowUpRight size={15} /></button></div>
      <div className="job-status-strip">{JOB_STATUSES.map((status) => <div className="job-status-cell" key={status}><span>{status}</span><strong>{counts[status] || 0}</strong></div>)}</div>
      {savedJobs.length ? (
        <div className="job-dashboard-columns">
          <div>
            <h4>NEXT ACTIONS</h4>
            {actions.length ? actions.map((action) => <button className="next-action" key={`${action.jobId}-${action.priority}`} onClick={() => onNavigate('Job discovery')}><span className="focus-icon"><Target size={16} /></span><span><strong>{action.label}</strong><small>{action.reason}</small></span><ChevronRight size={16} /></button>)
              : <p className="empty-note">No urgent actions from your saved jobs. Add a new role or move one to Preparing.</p>}
          </div>
          <div>
            <h4>RECENTLY ADDED</h4>
            {recent.map((job) => <button className="recent-job" key={job.id} onClick={() => onNavigate('Job discovery')}><span className="company-stamp">{(job.company || '?').slice(0, 1).toUpperCase()}</span><span><strong>{job.title || 'Untitled role'}</strong><small>{[job.company, job.source].filter(Boolean).join(' · ') || 'No company recorded'}</small></span><span className="job-status-pill">{normalizeJobStage(job.stage)}</span></button>)}
          </div>
        </div>
      ) : (
        <div className="empty-jobs"><BriefcaseBusiness size={22} /><h3>No jobs saved yet</h3><p>Find a role on an official careers page or job board, check it is real, then add it in Job discovery.</p><button className="button button-outline" onClick={() => onNavigate('Job discovery')}><Plus size={15} /> Add your first job</button></div>
      )}
    </section>
  );
}

function Stat({ icon: Icon, label, value, note, tone }) {
  return <div className="stat-item"><span className={`stat-icon ${tone}`}><Icon size={17} /></span><span className="stat-label">{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function CoverLetters({ data, update, notify, onCreateFromJob }) {
  const [selectedId, setSelectedId] = useState(data.letters[0]?.id ?? null);
  const [jobChoice, setJobChoice] = useState('');
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const selected = data.letters.find((letter) => letter.id === selectedId);
  const change = (field, value) => update('letters', data.letters.map((letter) => letter.id === selectedId ? { ...letter, [field]: value, updated: 'Just now' } : letter));
  const addDraft = () => {
    const draft = { id: Date.now(), company: 'New company', role: 'Role title', body: '', updated: 'Just now' };
    update('letters', [draft, ...data.letters]);
    setSelectedId(draft.id);
  };
  const remove = (id) => { update('letters', data.letters.filter((letter) => letter.id !== id)); if (selectedId === id) setSelectedId(null); };
  return <><SectionTitle eyebrow="A HUMAN FIRST IMPRESSION" title="Cover letters" description="Drafts use only facts you confirmed in Career profile. Highlighted brackets show what you still need to write. Nothing is sent from here." action={<button className="button button-primary" onClick={addDraft}><Plus size={16} /> Blank draft</button>} /><form className="panel letter-from-job" onSubmit={(event) => { event.preventDefault(); const job = jobs.find((item) => String(item.id) === jobChoice); if (job) onCreateFromJob(job); }}><label className="field"><span>Start a draft from a saved job</span><select value={jobChoice} onChange={(event) => setJobChoice(event.target.value)}><option value="">{jobs.length ? 'Choose a saved job' : 'No saved jobs yet: add one in Job discovery'}</option>{jobs.map((job) => <option key={job.id} value={String(job.id)}>{[job.title, job.company].filter(Boolean).join(' at ') || 'Untitled job'}</option>)}</select></label><button className="button button-outline" type="submit" disabled={!jobChoice}><Plus size={15} /> Create draft</button></form><div className="split-workspace"><aside className="draft-list"><div className="list-heading"><span>YOUR DRAFTS</span><span>{data.letters.length}</span></div>{data.letters.map((letter) => <button className={`draft-item ${selectedId === letter.id ? 'selected' : ''}`} key={letter.id} onClick={() => setSelectedId(letter.id)}><span className="draft-company-icon">{letter.company.slice(0, 1)}</span><span><strong>{letter.company}</strong><small>{letter.role}</small><small className="draft-date">Edited {letter.updated}</small></span></button>)}{!data.letters.length && <p className="empty-note">No drafts yet. Start with one role you care about.</p>}</aside>{selected ? <section className="panel draft-editor"><div className="draft-meta"><Field label="Company" value={selected.company} onChange={(value) => change('company', value)} /><Field label="Role" value={selected.role} onChange={(value) => change('role', value)} /></div><Field label="Your letter" value={selected.body} onChange={(value) => change('body', value)} as="textarea" rows={17} placeholder="Start with what genuinely interests you about this team..." /><div className="editor-bottom"><span>{selected.body.length} characters · Saved locally{(selected.body.match(/\[[^\]]+\]/g) || []).length ? <b className="placeholder-count"> · {(selected.body.match(/\[[^\]]+\]/g) || []).length} [placeholders] still to fill</b> : ''}</span><button className="button button-quiet" onClick={() => copyText(selected.body, notify, 'Draft copied to clipboard.')}><Copy size={15} /> Copy draft</button><button className="icon-button danger-button" onClick={() => remove(selected.id)} aria-label="Delete draft"><Trash2 size={16} /></button></div></section> : <div className="empty-workspace"><Mail size={23} /><h3>Choose a draft to begin</h3><p>Each letter is a fresh chance to connect your experience to a role.</p><button className="button button-outline" onClick={addDraft}><Plus size={16} /> Create a draft</button></div>}</div></>;
}

function Applications({ data, update, onUpdateStage }) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const add = (event) => { event.preventDefault(); if (!company.trim() || !role.trim()) return; update('applications', [{ id: Date.now(), company: company.trim(), role: role.trim(), stage: 'Researching', date: new Date().toISOString().slice(0, 10) }, ...data.applications]); setCompany(''); setRole(''); };
  const setStage = (id, stage) => onUpdateStage
    ? onUpdateStage(id, stage)
    : update('applications', data.applications.map((item) => item.id === id ? { ...item, stage } : item));
  const remove = (id) => update('applications', data.applications.filter((item) => item.id !== id));
  return <><SectionTitle eyebrow="KEEP THE THREAD" title="Applications" description="Track where each opportunity stands. Status changes are saved on this device." /><form className="add-application" onSubmit={add}><div className="add-intro"><span className="add-icon"><Plus size={17} /></span><span><strong>Add an opportunity</strong><small>Start with the company and role.</small></span></div><input aria-label="Company" placeholder="Company" value={company} onChange={(event) => setCompany(event.target.value)} /><input aria-label="Role" placeholder="Role title" value={role} onChange={(event) => setRole(event.target.value)} /><button className="button button-primary" type="submit"><Plus size={16} /> Add</button></form><section className="panel table-panel"><div className="table-header"><div><p className="eyebrow">YOUR PIPELINE</p><h3>{data.applications.length} opportunities</h3></div><span className="subtle-label">Demo rows are labeled · newest first</span></div><div className="application-table"><div className="table-row table-labels"><span>COMPANY & ROLE</span><span>ADDED</span><span>STATUS</span><span /></div>{data.applications.map((item) => <div className="table-row" key={item.id}><span className="table-company"><span className="company-stamp">{item.company.slice(0, 1)}</span><span><strong>{item.company}</strong><small>{item.role}{item.isDemo && <span className="demo-badge">DEMO</span>}</small></span></span><span className="table-date">{formatShortDate(item.date)}</span><span><select className="stage-select" value={item.stage} onChange={(event) => setStage(item.id, event.target.value)} aria-label={`Status for ${item.company}`}>{['Researching', 'Applied', 'Interviewing', 'Offer', 'Closed'].map((stage) => <option key={stage}>{stage}</option>)}</select></span><button className="icon-button danger-button row-delete" onClick={() => remove(item.id)} aria-label={`Remove ${item.company}`}><Trash2 size={15} /></button></div>)}{!data.applications.length && <div className="empty-table">No opportunities tracked yet. Add one above when a role catches your eye.</div>}</div></section><p className="privacy-note"><BadgeCheck size={15} /> This is a private tracker, not a job-search integration. Applications are never submitted automatically.</p></>;
}

function Research({ data, update }) {
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const add = (event) => { event.preventDefault(); if (!company.trim() || !notes.trim()) return; update('research', [{ id: Date.now(), company: company.trim(), notes: notes.trim(), updated: 'Just now' }, ...data.research]); setCompany(''); setNotes(''); };
  return <><SectionTitle eyebrow="LOOK BEYOND THE JOB DESCRIPTION" title="Company research" description="Keep useful observations and interview questions together. Research is manual and saved locally." /><form className="panel research-form" onSubmit={add}><div className="research-form-heading"><span className="research-icon"><Building2 size={18} /></span><div><h3>Capture a signal</h3><p>A product detail, a question, a person to learn from.</p></div></div><div className="research-inputs"><Field label="Company" value={company} onChange={setCompany} placeholder="e.g. A team you're curious about" /><Field label="Notes" value={notes} onChange={setNotes} as="textarea" rows={3} placeholder="What did you notice? What would you like to understand?" /></div><div className="form-action-row"><span>Not connected to live company data.</span><button className="button button-primary" type="submit"><Plus size={16} /> Save note</button></div></form><div className="research-list">{data.research.map((item) => <article className="research-note" key={item.id}><div className="research-note-top"><span className="company-stamp">{item.company.slice(0, 1)}</span><div><h3>{item.company}</h3><small>Updated {item.updated}</small></div><button className="icon-button danger-button" onClick={() => update('research', data.research.filter((note) => note.id !== item.id))} aria-label={`Delete ${item.company} notes`}><Trash2 size={15} /></button></div><p className="preline">{item.notes}</p></article>)}{!data.research.length && <p className="empty-note">Your research notebook is ready for its first observation.</p>}</div></>;
}

function LinkedInDrafts({ data, update }) {
  const [content, setContent] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const add = (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    update('posts', [{ id: Date.now(), content: content.trim(), plannedDate, updated: 'Just now' }, ...data.posts]);
    setContent('');
    setPlannedDate('');
  };
  const orderedPosts = [...data.posts].sort((first, second) => (first.plannedDate || '').localeCompare(second.plannedDate || ''));
  return (
    <>
      <SectionTitle eyebrow="IDEAS, BEFORE THEY GO LIVE" title="LinkedIn drafts" description="Write and schedule draft ideas in a private calendar. Nothing is published by this app." />
      <form className="panel post-composer" onSubmit={add}>
        <div className="composer-top"><span className="top-avatar">{getInitials(data.profile.name)}</span><span><strong>{data.profile.name || 'Your draft workspace'}</strong><small>Only you can see this draft</small></span><span className="draft-badge">DRAFT</span></div>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={7} maxLength={3000} placeholder="What is one thing you learned, changed, or noticed in your work?" aria-label="LinkedIn post draft" />
        <div className="composer-bottom"><label className="post-date-field"><span>Planned date (optional)</span><input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} /></label><span>{content.length} / 3,000</span><span>Publish it yourself, if and when you choose.</span><button className="button button-primary" type="submit"><Plus size={16} /> Save draft</button></div>
      </form>
      <section className="saved-posts">
        <div className="list-heading"><span>DRAFT CALENDAR · NOT PUBLISHED</span><span>{data.posts.length}</span></div>
        {orderedPosts.map((post) => <article className="saved-post" key={post.id}>
          <div className="post-author"><span className="top-avatar">{getInitials(data.profile.name)}</span><span><strong>{data.profile.name || 'Your draft workspace'}</strong><small>{post.plannedDate ? `Planned for ${post.plannedDate}` : 'No date planned'} · Draft</small></span><button className="icon-button danger-button" onClick={() => update('posts', data.posts.filter((item) => item.id !== post.id))} aria-label="Delete post draft"><Trash2 size={15} /></button></div>
          <p className="preline">{post.content}</p><div className="post-endnote"><span>{post.content.length} characters</span><span>Not published</span></div>
        </article>)}
        {!data.posts.length && <p className="empty-note">No post ideas saved yet. Start with a small observation from your work.</p>}
      </section>
    </>
  );
}

function LinkedInImagePrompts({ data, update, notify }) {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('Clean editorial illustration');
  const [ratio, setRatio] = useState('4:5');
  const prompt = topic.trim()
    ? `Create a LinkedIn visual about: ${topic.trim()}. Visual direction: ${style}. Aspect ratio: ${ratio}. Use a clear focal point, accessible contrast, and a professional but approachable feel. Do not invent personal achievements, credentials, statistics, company logos, or text. Leave space for optional text to be added later by the user.`
    : '';
  const addPrompt = () => {
    if (!prompt) return;
    update('imagePrompts', [{ id: Date.now(), topic: topic.trim(), style, ratio, prompt, updated: 'Just now' }, ...data.imagePrompts]);
    setTopic('');
  };
  const editPrompt = (id, value) => update('imagePrompts', data.imagePrompts.map((item) => item.id === id ? { ...item, prompt: value, updated: 'Just now' } : item));
  const copyPrompt = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      notify('Image prompt copied. Paste it into an image tool you choose.');
    } catch (error) {
      notify(`Could not copy the prompt: ${error.message}. Select the text and copy it manually.`);
    }
  };
  return (
    <>
      <SectionTitle eyebrow="VISUAL IDEAS, YOUR CHOICE" title="LinkedIn image prompts" description="Create text prompts to use with an image tool you choose. No images are generated or published from this app." />
      <section className="panel image-prompt-builder">
        <Field label="What should the image communicate?" value={topic} onChange={setTopic} as="textarea" rows={3} placeholder="Describe your own topic, idea, or post theme." />
        <div className="image-prompt-fields">
          <Field label="Visual style" value={style} onChange={setStyle} placeholder="e.g. minimal geometric illustration" />
          <label className="field"><span>Aspect ratio</span><select value={ratio} onChange={(event) => setRatio(event.target.value)}><option>4:5</option><option>1:1</option><option>16:9</option></select></label>
        </div>
        {prompt && <div className="prompt-output"><p>{prompt}</p><button className="button button-outline" onClick={() => copyPrompt(prompt)}>Copy prompt</button><button className="button button-primary" onClick={addPrompt}><Plus size={15} /> Save prompt</button></div>}
      </section>
      <div className="saved-posts">
        <div className="list-heading"><span>SAVED IMAGE PROMPTS</span><span>{data.imagePrompts.length}</span></div>
        {data.imagePrompts.map((item) => <article className="saved-post image-prompt-card" key={item.id}>
          <div className="post-author"><span><strong>{item.topic || 'Image prompt'}</strong><small>{item.updated || 'Saved locally'}</small></span><button className="icon-button danger-button" onClick={() => update('imagePrompts', data.imagePrompts.filter((promptItem) => promptItem.id !== item.id))} aria-label="Delete image prompt"><Trash2 size={15} /></button></div>
          <textarea value={item.prompt || ''} rows={4} onChange={(event) => editPrompt(item.id, event.target.value)} aria-label={`Edit image prompt for ${item.topic || 'saved image'}`} />
          <button className="button button-outline" onClick={() => copyPrompt(item.prompt || '')}>Copy prompt</button>
        </article>)}
        {!data.imagePrompts.length && <p className="empty-note">Your image prompts stay on this device until you decide to copy them.</p>}
      </div>
    </>
  );
}

const interviewSteps = [
  { title: 'Revisit the role', detail: 'Pick out the problems this team is trying to solve.' },
  { title: 'Choose two stories', detail: 'Bring examples that show your decisions and their impact.' },
  { title: 'Practice your introduction', detail: 'Keep it human, specific, and under two minutes.' },
  { title: 'Write your questions', detail: 'Ask about the work, the people, and how success is measured.' },
];

function InterviewPrep({ data, update }) {
  const toggle = (index) => update('prep', { checks: data.prep.checks.map((done, itemIndex) => itemIndex === index ? !done : done) });
  const complete = data.prep.checks.filter(Boolean).length;
  return <><SectionTitle eyebrow="PREPARE WITH INTENTION" title="Interview prep" description="A light structure for thoughtful conversations. No scripts or auto-generated answers." /><div className="prep-layout"><section className="panel prep-checklist"><div className="prep-summary"><span className="prep-ring"><span>{complete}<small>/{interviewSteps.length}</small></span></span><div><p className="eyebrow">YOUR PREP, AT YOUR PACE</p><h3>{complete === interviewSteps.length ? 'You’re ready to show up.' : 'A little preparation goes a long way.'}</h3><p>Check things off as you go. Your progress saves in this browser.</p></div></div><div className="prep-steps">{interviewSteps.map((step, index) => <button className={`prep-step ${data.prep.checks[index] ? 'done' : ''}`} key={step.title} onClick={() => toggle(index)}><span className="check-circle">{data.prep.checks[index] && <Check size={14} />}</span><span><strong>{step.title}</strong><small>{step.detail}</small></span><ChevronRight size={16} /></button>)}</div></section><aside className="question-panel"><span className="question-mark">“</span><p className="eyebrow">A QUESTION TO PRACTICE</p><h3>Tell me about a time you changed your mind after learning something new.</h3><p>Try a real example. What did you notice, what shifted, and what happened next?</p><span className="question-tag">REFLECTION · COLLABORATION</span></aside></div></>;
}

function SkillGaps({ data, update }) {
  const [skillName, setSkillName] = useState('');
  const add = (event) => {
    event.preventDefault();
    const name = skillName.trim();
    if (!name) return;
    update('skills', [...data.skills, { id: Date.now(), name, current: null, target: null, category: 'My skills' }]);
    setSkillName('');
  };
  const changeLevel = (id, field, value) => update('skills', data.skills.map((skill) => (
    skill.id === id ? { ...skill, [field]: value ? Number(value) : null } : skill
  )));
  return (
    <>
      <SectionTitle eyebrow="GROW WITH PURPOSE" title="Skill-gap analysis" description="Compare your self-assessed skills with what your next role asks for. This is your reflection, not a formal assessment." />
      <div className="skill-intro"><span className="skill-target"><Target size={19} /></span><span><strong>Start with a role you want</strong><small>Use job descriptions and your own judgment to set a current level and target.</small></span><span className="manual-tag">MANUAL PLAN</span></div>
      <section className="panel skills-panel">
        <div className="skill-table-head"><span>SKILL</span><span>NOW</span><span>GOAL</span><span>GAP TO EXPLORE</span><span /></div>
        {data.skills.map((skill) => {
          const gap = skill.current !== null && skill.target !== null ? skill.target - skill.current : null;
          const gapText = gap === null ? 'Set your current level and goal' : gap <= 0 ? 'Maintain & deepen' : `${gap} level${gap > 1 ? 's' : ''} to explore`;
          return (
            <div className="skill-row" key={skill.id}>
              <strong>{skill.name}</strong>
              <div className="level-control">
                <select value={skill.current ?? ''} onChange={(event) => changeLevel(skill.id, 'current', event.target.value)} aria-label={`Current ${skill.name} level`}>
                  <option value="">Not assessed</option>
                  {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
                <span className="level-dots">{Array.from({ length: 5 }, (_, index) => <i className={skill.current !== null && index < skill.current ? 'filled' : ''} key={index} />)}</span>
              </div>
              <div className="level-control">
                <select value={skill.target ?? ''} onChange={(event) => changeLevel(skill.id, 'target', event.target.value)} aria-label={`Target ${skill.name} level`}>
                  <option value="">No target</option>
                  {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
                <span className="level-dots target-dots">{Array.from({ length: 5 }, (_, index) => <i className={skill.target !== null && index < skill.target ? 'filled' : ''} key={index} />)}</span>
              </div>
              <span className="gap-text">{gapText}</span>
              <button className="icon-button danger-button" onClick={() => update('skills', data.skills.filter((item) => item.id !== skill.id))} aria-label={`Remove ${skill.name}`}><Trash2 size={15} /></button>
            </div>
          );
        })}
        {!data.skills.length && <p className="empty-table">Add a skill that matters to a role you are considering.</p>}
      </section>
      <form className="add-skill" onSubmit={add}><input value={skillName} onChange={(event) => setSkillName(event.target.value)} placeholder="Add a skill to reflect on" aria-label="New skill" /><button className="button button-outline" type="submit"><Plus size={16} /> Add skill</button></form>
      <p className="privacy-note"><Lightbulb size={15} /> Levels are self-assessed prompts, not a formal score or hiring signal.</p>
    </>
  );
}

function Roadmap({ data, update }) {
  const [newSkill, setNewSkill] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newResource, setNewResource] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const milestones = Array.isArray(data.roadmap) ? data.roadmap : [];
  const skills = Array.isArray(data.skills) ? data.skills : [];
  const done = milestones.filter((item) => item.status === 'Done').length;
  const suggestions = skills.filter((skill) => (
    skill && skill.target !== null && (skill.current === null || skill.current < skill.target)
    && !milestones.some((item) => item.skill?.toLowerCase() === skill.name?.toLowerCase())
  ));
  const updateMilestone = (id, field, value) => update('roadmap', milestones.map((item) => (
    item.id === id ? {
      ...item,
      [field]: value,
      ...(field === 'status' ? { done: value === 'Done' } : {}),
      ...(field === 'notes' ? { detail: value } : {}),
    } : item
  )));
  const add = (event) => {
    event.preventDefault();
    if (!newSkill.trim()) return;
    const milestone = {
      id: Date.now(),
      group: 'My milestones',
      skill: newSkill.trim(),
      title: newSkill.trim(),
      detail: newNotes.trim(),
      targetDate: newDate,
      resourceUrl: newResource.trim(),
      resourceLabel: '',
      notes: newNotes.trim(),
      status: 'Not started',
      done: false,
    };
    update('roadmap', [...milestones, milestone]);
    setNewSkill('');
    setNewDate('');
    setNewResource('');
    setNewNotes('');
  };
  const addSuggestion = (skill) => {
    const milestone = {
      id: `suggested-skill-${skill.id}`,
      group: 'Suggested from skill-gap analysis',
      skill: skill.name,
      title: skill.name,
      detail: `Review the gap you identified for ${skill.name}.`,
      targetDate: '',
      resourceUrl: '',
      resourceLabel: '',
      notes: '',
      status: 'Not started',
      done: false,
    };
    update('roadmap', [...milestones, milestone]);
  };
  const safeResource = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  };
  return (
    <>
      <SectionTitle eyebrow="MOMENTUM, IN SMALL STEPS" title="Career roadmap" description="A shared foundation for Product Management, Business Analysis, Operations, and Consulting, with optional product and industry skills." />
      <div className="roadmap-progress">
        <div><span className="eyebrow">YOUR MOMENTUM</span><strong>{done} <small>of {milestones.length} milestones complete</small></strong></div>
        <div className="roadmap-bar"><span style={{ width: `${milestones.length ? (done / milestones.length) * 100 : 0}%` }} /></div>
        <span className="roadmap-percent">{milestones.length ? Math.round((done / milestones.length) * 100) : 0}%</span>
      </div>
      {suggestions.length > 0 && <section className="panel roadmap-suggestions">
        <h2>Suggested from your skill-gap analysis</h2>
        <p>Only skills with a target above your self-assessed current level appear here. Add a suggested item when you are ready; nothing is marked done automatically.</p>
        {suggestions.map((skill) => <div className="roadmap-suggestion" key={skill.id}><span>{skill.name}</span><button className="button button-outline" onClick={() => addSuggestion(skill)}><Plus size={15} /> Add to roadmap</button></div>)}
      </section>}
      <div className="roadmap-list">
        {milestones.map((item, index) => {
          const resource = safeResource(item.resourceUrl);
          return (
            <article className={`roadmap-item ${item.status === 'Done' ? 'completed' : ''}`} key={item.id}>
              <span className="milestone-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="roadmap-group-tag">{item.group || 'My milestones'}</span>
              <label className="roadmap-field"><span>Skill</span><input value={item.skill || ''} onChange={(event) => updateMilestone(item.id, 'skill', event.target.value)} /></label>
              <label className="roadmap-field"><span>Target date</span><input type="date" value={item.targetDate || ''} onChange={(event) => updateMilestone(item.id, 'targetDate', event.target.value)} /></label>
              <label className="roadmap-field"><span>Status</span><select value={item.status || (item.done ? 'Done' : 'Not started')} onChange={(event) => updateMilestone(item.id, 'status', event.target.value)}>{['Not started', 'In progress', 'Done'].map((status) => <option key={status}>{status}</option>)}</select></label>
              <label className="roadmap-field"><span>Free resource link</span><input type="url" value={item.resourceUrl || ''} onChange={(event) => updateMilestone(item.id, 'resourceUrl', event.target.value)} placeholder="https://..." /></label>
              <label className="roadmap-field roadmap-notes"><span>Notes</span><textarea value={item.notes || item.detail || ''} onChange={(event) => updateMilestone(item.id, 'notes', event.target.value)} rows={2} placeholder="Your notes or next small step" /></label>
              {resource && <a className="roadmap-resource-link" href={resource} target="_blank" rel="noreferrer">{item.resourceLabel || 'Open free resource'}<ArrowUpRight size={14} /></a>}
              <button className="icon-button danger-button roadmap-delete" onClick={() => update('roadmap', milestones.filter((entry) => entry.id !== item.id))} aria-label={`Remove ${item.skill}`}><Trash2 size={15} /></button>
            </article>
          );
        })}
        {!milestones.length && <p className="empty-note">No milestones yet. Add one when you are ready to set a learning goal.</p>}
      </div>
      <form className="roadmap-add" onSubmit={add}>
        <label className="roadmap-field"><span>Skill</span><input value={newSkill} onChange={(event) => setNewSkill(event.target.value)} placeholder="Add a skill" required /></label>
        <label className="roadmap-field"><span>Target date</span><input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} /></label>
        <label className="roadmap-field"><span>Free resource link</span><input type="url" value={newResource} onChange={(event) => setNewResource(event.target.value)} placeholder="https://..." /></label>
        <label className="roadmap-field roadmap-notes"><span>Notes</span><textarea value={newNotes} onChange={(event) => setNewNotes(event.target.value)} rows={2} placeholder="What would you like to learn?" /></label>
        <button className="button button-primary" type="submit">Add milestone <Plus size={16} /></button>
      </form>
    </>
  );
}

function PromptBuilder({ data, notify }) {
  const [target, setTarget] = useState(data.profile.role);
  const [company, setCompany] = useState('');
  const [focus, setFocus] = useState('');
  const prompt = `Act as a thoughtful career writing partner. Help me prepare for a ${target || '[target role]'} opportunity${company ? ` at ${company}` : ''}.\n\nMy background: ${data.profile.summaryConfirmed && data.profile.headline ? data.profile.headline : '[confirmed summary not added yet]'}\nConfirmed skills: ${confirmedSkillNames(data.facts).join(', ') || '[no confirmed skills yet]'}\n\nI want help with: ${focus || '[describe the task]'}\n\nAsk clarifying questions when context is missing. Use only the experience and facts I provide; do not invent metrics, credentials, company research, or outcomes. Keep the tone specific and human. Offer a draft for me to review, not a message to send.`;
  return <><SectionTitle eyebrow="A CLEARER ASK, BETTER DRAFTS" title="Prompt builder" description="Create a reusable prompt for an AI tool you choose. Nothing is sent from this page." /><div className="prompt-layout"><section className="panel prompt-controls"><div className="prompt-note"><Sparkles size={17} /><span>This builds text only. No AI service is connected.</span></div><Field label="Target role" value={target} onChange={setTarget} placeholder="e.g. Product designer" /><Field label="Company (optional)" value={company} onChange={setCompany} placeholder="e.g. A team you are exploring" /><Field label="What do you want help with?" value={focus} onChange={setFocus} as="textarea" rows={5} placeholder="e.g. Tailor my experience to this role without overstating my impact." /><div className="prompt-source"><span className="top-avatar">{getInitials(data.profile.name)}</span><span><strong>Using your career profile</strong><small>{data.profile.name} · {data.profile.role}</small></span><button className="text-button" onClick={() => notify('Edit your source details in Career profile.')}>Edit profile <ArrowUpRight size={14} /></button></div></section><section className="prompt-output"><div className="output-header"><div><span className="output-dot" /><span>YOUR PROMPT</span></div><button className="icon-button copy-icon" onClick={() => copyText(prompt, notify, 'Prompt copied to clipboard.')} aria-label="Copy prompt" title="Copy prompt"><Copy size={16} /></button></div><pre>{prompt}</pre><div className="output-footer"><span>Review details before using in another service.</span><span>{prompt.length} characters</span></div></section></div><p className="privacy-note"><BadgeCheck size={15} /> Prompt text is generated in your browser. It is not submitted to an AI provider.</p></>;
}

function StageBadge({ stage }) {
  return <span className={`stage-badge stage-${stage.toLowerCase()}`}><span />{stage}</span>;
}

function formatShortDate(value) {
  if (!value) return 'Today';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

export default App;