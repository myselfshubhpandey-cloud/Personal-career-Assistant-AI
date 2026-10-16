import React, { useState } from 'react';
import { BadgeCheck, Check, ChevronDown, ChevronUp, CircleAlert, Plus, Trash2 } from 'lucide-react';
import { emptyFact, FACT_SECTIONS, primaryText, unconfirmedCount } from './profile-facts.js';

function TextField({ label, value, onChange, placeholder = '', multiline = false, type = 'text', rows = 3 }) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline
        ? <textarea rows={rows} value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        : <input type={type} value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function FactCard({ section, fact, onChange, onRemove }) {
  const [open, setOpen] = useState(!primaryText(section.key, fact));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const title = primaryText(section.key, fact) || `New ${section.singular}`;
  const missingRequired = !primaryText(section.key, fact);
  return (
    <article className={`fact-card ${fact.confirmed ? 'is-confirmed' : 'is-unconfirmed'}`}>
      <div className="fact-card-head">
        <button type="button" className="fact-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span><strong>{title}</strong><small>{fact.confirmed ? 'Confirmed: used in drafts' : 'Not confirmed: left out of drafts'}{fact.fromOldProfile ? ' · moved from your old profile' : ''}</small></span>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      {open && (
        <div className="fact-fields">
          {section.fields.map((field) => field.options ? (
            <label className="field" key={field.key}>
              <span>{field.label}</span>
              <select value={fact[field.key] || field.options[0]} onChange={(event) => onChange({ [field.key]: event.target.value, confirmed: false })}>
                {field.options.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          ) : (
            <div className={field.multiline ? 'field-span' : ''} key={field.key}>
              <TextField label={field.label} value={fact[field.key]} placeholder={field.placeholder} multiline={field.multiline} onChange={(value) => onChange({ [field.key]: value, confirmed: false })} />
            </div>
          ))}
        </div>
      )}
      <div className="fact-actions">
        <label className={`confirm-check ${missingRequired ? 'disabled' : ''}`}>
          <input type="checkbox" checked={fact.confirmed === true} disabled={missingRequired} onChange={(event) => onChange({ confirmed: event.target.checked })} />
          <span>I confirm this is accurate</span>
        </label>
        {confirmDelete
          ? <span className="delete-confirm"><span>Delete this entry?</span><button type="button" className="button button-outline" onClick={() => setConfirmDelete(false)}>Keep</button><button type="button" className="button danger-solid" onClick={onRemove}>Delete</button></span>
          : <button type="button" className="icon-button danger-button" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${title}`}><Trash2 size={16} /></button>}
      </div>
      {!fact.confirmed && !missingRequired && open && <p className="fact-hint">Editing a field un-ticks the confirmation, so you always re-check a changed fact before it is used.</p>}
    </article>
  );
}

export default function ProfileEditor({ data, update, getInitials }) {
  const profile = data.profile;
  const facts = data.facts;
  const setProfile = (field) => (value) => update('profile', {
    ...profile,
    [field]: value,
    ...(field === 'headline' ? { summaryConfirmed: false } : {}),
  });
  const setList = (key, list) => update('facts', { ...facts, [key]: list });
  const addFact = (key) => setList(key, [...(facts[key] || []), emptyFact(key)]);
  const changeFact = (key, id, changes) => setList(key, (facts[key] || []).map((fact) => fact.id === id ? { ...fact, ...changes } : fact));
  const removeFact = (key, id) => setList(key, (facts[key] || []).filter((fact) => fact.id !== id));
  const pending = unconfirmedCount(facts);
  const confirmedTotal = FACT_SECTIONS.reduce((sum, section) => sum + (facts[section.key] || []).filter((fact) => fact.confirmed).length, 0);

  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">THE FOUNDATION</p>
          <h1>Career profile</h1>
          <p className="section-description">Enter and correct your own facts. Only entries you tick as confirmed are used in resume and cover-letter drafts. Nothing is filled in for you.</p>
        </div>
      </div>

      <div className="profile-status-row">
        <span className="profile-status good"><BadgeCheck size={16} /> {confirmedTotal} confirmed {confirmedTotal === 1 ? 'fact' : 'facts'}</span>
        {pending > 0 && <span className="profile-status warn"><CircleAlert size={16} /> {pending} waiting for your confirmation</span>}
      </div>

      <section className="panel form-panel">
        <div className="form-heading"><span className="form-avatar">{getInitials(profile.name)}</span><div><h3>Basic details</h3><p>Used at the top of your drafts. Leave blank anything you do not want to share.</p></div></div>
        <div className="form-grid">
          <TextField label="Name for professional documents" value={profile.name} onChange={setProfile('name')} placeholder="As on your official records" />
          <TextField label="Career focus" value={profile.role} onChange={setProfile('role')} placeholder="e.g. Business Analyst, Product Analyst" />
          <TextField label="Email (optional)" type="email" value={profile.email} onChange={setProfile('email')} />
          <TextField label="Phone (optional)" type="tel" value={profile.phone} onChange={setProfile('phone')} />
          <TextField label="City (optional)" value={profile.city} onChange={setProfile('city')} />
          <TextField label="LinkedIn URL (optional)" type="url" value={profile.linkedin} onChange={setProfile('linkedin')} placeholder="https://www.linkedin.com/in/..." />
          <div className="field-span"><TextField label="Professional summary (2 to 3 lines, facts only)" value={profile.headline} onChange={setProfile('headline')} multiline rows={3} placeholder="e.g. MBA student in Operations and Marketing learning data analytics..." /></div>
          <label className={`confirm-check field-span ${profile.headline?.trim() ? '' : 'disabled'}`}>
            <input type="checkbox" checked={profile.summaryConfirmed === true} disabled={!profile.headline?.trim()} onChange={(event) => update('profile', { ...profile, summaryConfirmed: event.target.checked })} />
            <span>I confirm this summary is accurate</span>
          </label>
        </div>
        <div className="inline-saved"><Check size={14} /> Changes save automatically in this browser.</div>
      </section>

      {FACT_SECTIONS.map((section) => {
        const list = Array.isArray(facts[section.key]) ? facts[section.key] : [];
        return (
          <section className="panel fact-section" key={section.key}>
            <div className="fact-section-head">
              <div><h3>{section.title}</h3><small>{list.filter((fact) => fact.confirmed).length} of {list.length} confirmed</small></div>
              <button type="button" className="button button-outline" onClick={() => addFact(section.key)}><Plus size={15} /> Add {section.singular}</button>
            </div>
            {list.length
              ? list.map((fact) => <FactCard key={fact.id} section={section} fact={fact} onChange={(changes) => changeFact(section.key, fact.id, changes)} onRemove={() => removeFact(section.key, fact.id)} />)
              : <p className="empty-note">No {section.title.toLowerCase()} added yet. Drafts will show a placeholder here until you add and confirm one.</p>}
          </section>
        );
      })}
    </>
  );
}
