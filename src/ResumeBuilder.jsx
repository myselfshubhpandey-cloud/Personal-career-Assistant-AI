import React from 'react';
import { ArrowDownToLine, CircleAlert, Copy, UserRound } from 'lucide-react';
import { buildResumeDraft, compareJobSkills } from './profile-facts.js';
import { copyText, downloadText } from './browser-actions.js';

export function DraftText({ text }) {
  const parts = String(text || '').split(/(\[[^\]]+\])/g);
  return <pre className="draft-text">{parts.map((part, index) => (/^\[[^\]]+\]$/.test(part) ? <mark key={index}>{part}</mark> : part))}</pre>;
}

export default function ResumeBuilder({ data, update, notify, onNavigate }) {
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const targetJob = jobs.find((job) => String(job.id) === String(data.resume.targetJobId)) || null;
  const draft = buildResumeDraft(data.profile, data.facts, targetJob);
  const comparison = targetJob ? compareJobSkills(targetJob, data.facts) : null;
  const fileName = `${(data.profile.name || 'resume').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-resume-draft.txt`;
  const legacyText = [data.resume.summary, data.resume.experience].some((value) => String(value || '').trim());

  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">YOUR STORY, CLEARLY TOLD</p>
          <h1>Resume builder</h1>
          <p className="section-description">This draft is built only from facts you entered and confirmed in Career profile. Highlighted brackets are placeholders for facts that are missing.</p>
        </div>
      </div>
      <div className="editor-layout">
        <section className="panel editor-fields">
          <label className="field">
            <span>Tailor for a saved job (optional)</span>
            <select value={targetJob ? String(targetJob.id) : ''} onChange={(event) => update('resume', { ...data.resume, targetJobId: event.target.value })}>
              <option value="">General resume</option>
              {jobs.map((job) => <option key={job.id} value={String(job.id)}>{[job.title, job.company].filter(Boolean).join(' at ') || 'Untitled job'}</option>)}
            </select>
          </label>
          {comparison && (
            <div className="skill-compare">
              <strong>Skills for this job</strong>
              <p><b>Confirmed match:</b> {comparison.matched.length ? comparison.matched.map((skill) => skill.name).join(', ') : 'none yet'}</p>
              <p><b>Not in your confirmed skills:</b> {comparison.missing.length ? comparison.missing.join(', ') : comparison.required.length ? 'none' : 'no required skills saved for this job'}</p>
              <small>Matching skills are listed first. Missing skills are never added to your resume.</small>
            </div>
          )}
          <div className="placeholder-box">
            <strong>{draft.placeholders.length ? `${draft.placeholders.length} ${draft.placeholders.length === 1 ? 'gap' : 'gaps'} to fill` : 'No placeholders left'}</strong>
            {draft.placeholders.length > 0 && <ul>{draft.placeholders.map((item) => <li key={item}>{item.slice(1, -1)}</li>)}</ul>}
            {draft.omittedUnconfirmed > 0 && <p className="fact-hint"><CircleAlert size={14} /> {draft.omittedUnconfirmed} unconfirmed {draft.omittedUnconfirmed === 1 ? 'entry was' : 'entries were'} left out. Confirm them in Career profile to include them.</p>}
            <button type="button" className="button button-outline" onClick={() => onNavigate('Career profile')}><UserRound size={15} /> Edit my facts</button>
          </div>
          <div className="draft-buttons">
            <button type="button" className="button button-primary" onClick={() => copyText(draft.text, notify, 'Resume draft copied. Paste it into Pages, Word or Google Docs to format it.')}><Copy size={15} /> Copy draft</button>
            <button type="button" className="button button-outline" onClick={() => downloadText(draft.text, fileName, notify, 'Resume draft saved as a text file.')}><ArrowDownToLine size={15} /> Download .txt</button>
          </div>
          {legacyText && (
            <details className="legacy-draft">
              <summary>Older manual resume notes (kept, not used in the draft)</summary>
              <label className="field"><span>Summary notes</span><textarea rows={4} value={data.resume.summary || ''} onChange={(event) => update('resume', { ...data.resume, summary: event.target.value })} /></label>
              <label className="field"><span>Experience notes</span><textarea rows={6} value={data.resume.experience || ''} onChange={(event) => update('resume', { ...data.resume, experience: event.target.value })} /></label>
              <small>Move anything accurate from here into Career profile and confirm it there.</small>
            </details>
          )}
        </section>
        <aside className="resume-preview">
          <div className="preview-toolbar"><span><span className="preview-dot" /> LIVE DRAFT</span><span>Confirmed facts only</span></div>
          <article className="resume-paper"><DraftText text={draft.text} /></article>
        </aside>
      </div>
    </>
  );
}
