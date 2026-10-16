import React, { useEffect, useState } from 'react';
import { BadgeCheck, CircleAlert, Download, HardDrive, ShieldCheck, Upload } from 'lucide-react';

function isStandalone() {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'unknown';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Unknown' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function DataStorage({ data, storageReady, onExportJson, onExportCsv, onImport }) {
  const [persisted, setPersisted] = useState('checking');
  const standalone = isStandalone();
  let savedBytes = NaN;
  try {
    savedBytes = new Blob([JSON.stringify(data)]).size;
  } catch {
    savedBytes = NaN;
  }

  useEffect(() => {
    let active = true;
    if (!navigator.storage?.persisted) {
      setPersisted('unsupported');
      return undefined;
    }
    navigator.storage.persisted().then((value) => active && setPersisted(value ? 'yes' : 'no')).catch(() => active && setPersisted('unsupported'));
    return () => { active = false; };
  }, []);

  const requestPersist = async () => {
    if (!navigator.storage?.persist) {
      setPersisted('unsupported');
      return;
    }
    try {
      setPersisted((await navigator.storage.persist()) ? 'yes' : 'denied');
    } catch {
      setPersisted('unsupported');
    }
  };

  const daysSinceBackup = data.lastBackupAt ? Math.floor((Date.now() - new Date(data.lastBackupAt).getTime()) / 86400000) : null;

  return (
    <>
      <div className="section-title">
        <div>
          <p className="eyebrow">WHERE YOUR DATA LIVES</p>
          <h1>Data and storage</h1>
          <p className="section-description">Career Studio has no account and no server. Everything you enter is saved inside this browser on this device.</p>
        </div>
      </div>

      <section className="panel storage-status">
        <div className="storage-status-grid">
          <div><span>Saving in this browser</span><strong className={storageReady ? 'ok' : 'bad'}>{storageReady ? 'Working' : 'Not available'}</strong></div>
          <div><span>Size of your saved data</span><strong>{formatBytes(savedBytes)}</strong></div>
          <div><span>Opened as</span><strong>{standalone ? 'Home Screen app' : 'Safari tab / browser'}</strong></div>
          <div><span>Last backup file</span><strong className={daysSinceBackup === null || daysSinceBackup > 7 ? 'bad' : 'ok'}>{formatDateTime(data.lastBackupAt)}</strong></div>
          <div><span>Protected from automatic clean-up</span><strong>{{ checking: 'Checking...', yes: 'Yes', no: 'Not yet', denied: 'Browser said no', unsupported: 'Not supported here' }[persisted]}</strong></div>
        </div>
        <div className="storage-buttons">
          <button type="button" className="button button-primary" onClick={onExportJson}><Download size={15} /> Back up everything (JSON)</button>
          <button type="button" className="button button-outline" onClick={onExportCsv}><Download size={15} /> Export jobs CSV</button>
          <button type="button" className="button button-outline" onClick={onImport}><Upload size={15} /> Restore from backup</button>
          {persisted !== 'yes' && persisted !== 'unsupported' && <button type="button" className="button button-outline" onClick={requestPersist}><ShieldCheck size={15} /> Ask browser to keep my data</button>}
        </div>
        {(daysSinceBackup === null || daysSinceBackup > 7) && <p className="job-form-error"><CircleAlert size={15} /> {daysSinceBackup === null ? 'You have not made a backup yet.' : `Your last backup was ${daysSinceBackup} days ago.`} Tap "Back up everything" and save the file in the Files app or iCloud Drive.</p>}
      </section>

      <section className="panel storage-explainer">
        <h3><HardDrive size={18} /> How storage works</h3>
        <ul>
          <li><b>Stays on this device and this browser.</b> Your profile, jobs and drafts are saved in this browser's local storage for this exact web address. They are not uploaded, not synced to iCloud, and not visible to anyone else.</li>
          <li><b>Safari tab and Home Screen app are separate.</b> On iPad, the Home Screen version and a normal Safari tab usually keep separate storage. Data typed in one may not appear in the other. Pick one (the Home Screen app is recommended) and use backup and restore to move data between them.</li>
          <li><b>Other devices do not see it.</b> A different iPad, phone or computer starts empty. Use a backup file to move your data.</li>
          <li><b>Clearing browser data deletes it.</b> Settings &gt; Apps &gt; Safari &gt; Clear History and Website Data, or removing this site under Advanced &gt; Website Data, permanently deletes your Career Studio data. Deleting the Home Screen app removes its data too.</li>
          <li><b>Private Browsing does not keep it.</b> Data entered in a Private tab is lost when the tab closes.</li>
          <li><b>Safari may clean up unused sites.</b> Safari can remove data for a website you have not opened for a while (around 7 days of Safari use). Home Screen web apps are generally exempt. The "Ask browser to keep my data" button requests extra protection, but the browser decides.</li>
          <li><b>Backups are your safety net.</b> "Back up everything" saves a JSON file you can keep in Files or iCloud Drive. "Restore from backup" merges that file back in and keeps your existing records.</li>
        </ul>
        <p className="privacy-note"><BadgeCheck size={15} /> No paid services, accounts, API keys or trackers are used. Nothing is submitted or sent on your behalf.</p>
      </section>
    </>
  );
}
