# Career Studio

A private, local-first career workspace for planning a job search. It is built with React and Vite, works on iPad Safari and desktop browsers, and saves your workspace in that browser's local storage.

## What the app includes

- **Overview** — job counts by status, next actions from your saved jobs, recently added jobs, application pipeline, drafts, interview-prep status, and roadmap progress.
- **Career profile** — basic details plus separate lists for education, work experience, skills (with an honest level: Learning, Comfortable or Confident), projects and achievements. Each entry has an **"I confirm this is accurate"** tick. Editing a confirmed entry removes the tick so you re-check it. Deleting asks first. The app starts blank and never fills anything in for you.
- **Resume builder** — builds a plain-text resume only from confirmed facts. Missing facts appear as highlighted **[placeholders]** with a checklist of gaps. You can tailor it to a saved job (matching confirmed skills are listed first; missing skills are shown to you but never added). Copy it or download a .txt.
- **Cover letters** — start a draft from any saved job. It uses only confirmed facts and leaves [placeholders] for anything you must write yourself, such as why you want that company. The editor shows how many placeholders are left.
- **Data & storage** — shows whether saving works, how much data is stored, when you last made a backup, and whether the browser has agreed to protect the data. Explains exactly what happens if browser data is cleared.
- **Job discovery (job tracker)** — add jobs you checked yourself with title, company, location, job posting URL, **official application URL** (the employer page where you apply), source, last-checked date, description and private notes. Tap **Edit job** on any saved job to change any field. Track each job as **Saved, Interested, Preparing, Applied, Interview, Rejected or Offer**. Search by title, company, skills, source or notes, filter by status, open details to edit notes, and compare a pasted job description with your skills. It does not use a live vacancy API.
- **CSV export** — **Export jobs CSV** downloads your job tracker as a spreadsheet file that opens in Numbers, Excel or Google Sheets. Unverified salaries are left out, and cells are protected so pasted text cannot run as a spreadsheet formula.
- **Applications** — a status tracker for opportunities you choose to save.
- **Company research** — notes for research you conduct.
- **LinkedIn drafts**, a **LinkedIn content calendar**, and **LinkedIn image prompts** — drafts and planned dates only; nothing is published automatically.
- **Interview prep** and **Skill gaps** — self-directed preparation and self-assessment.
- **Career roadmap** — editable shared learning milestones for Product Management, Business Analysis, Operations, and Consulting, with optional role/industry skills and suggestions from your skill-gap analysis. Nothing is marked done for you.
- **Prompt builder** — creates text prompts for you to copy into an AI tool you choose.
- **Import my data** and **Export my data** — JSON backup and additive import. Import keeps existing saved records rather than deleting them.

Any starter application records are visibly labelled **Demo**. Replace them with your own records when you are ready. The app never submits applications, publishes posts, assumes work authorization, or invents qualifications, salaries, or sponsorship details.

## Run in Codespaces or locally

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 5173
```

Open port **5173** in the VS Code Ports tab. To run the tests and production build:

```sh
npm test
npm run build
npm run preview
```

### Open the Codespaces app on an iPad

You do not install or run Node.js directly on the iPad. Run the development server in Codespaces, then use the iPad's Safari as the screen:

1. Open this repository in GitHub Codespaces.
2. In the Codespaces terminal, run `npm ci` and then `npm run dev -- --host 0.0.0.0 --port 5173`.
3. In VS Code, open the **Ports** panel and find port **5173**. If prompted, set its visibility to **Public** so your iPad can reach the forwarded address. Only share that address with people you trust.
4. Copy the forwarded address and open it in Safari on the iPad. Keep the Codespace running while using this development version.

To run it from your own computer on the same Wi-Fi instead, run the same development command on that computer and open `http://<computer-LAN-address>:5173` in iPad Safari. The computer's firewall must allow local connections to port 5173. The development server still runs on the computer, not on the iPad.

### Use it as an iPad home-screen app

After GitHub Pages has been enabled and its deployment workflow has succeeded, open the HTTPS Pages address in Safari. Tap **Share → Add to Home Screen**. That installed copy can reopen the cached app shell offline after it has first loaded online. It does not need Codespaces to stay running. Your saved data belongs to that exact Safari site address and stays on that iPad; use **Export my data** before clearing Safari website data or moving to another device.

## How next actions are chosen

The dashboard only looks at jobs you saved. It suggests, in this order: a verified deadline within 7 days, jobs at Interview stage, jobs at Preparing stage, jobs marked Applied 14 or more days ago (follow-up), and jobs whose original posting you have not yet marked as reviewed. Nothing is fetched or invented.

## Honest limitations

- **No live job search.** There is no free, reliable job feed that can be used without scraping or breaking job-site terms, so jobs are added manually. The external links only open job sites in Safari for your own research.
- **Data lives in one browser on one device.** Nothing is uploaded or synced. On iPad, the Home Screen app and a Safari tab usually have **separate** storage, so data typed in one may not appear in the other.
- **Clearing browser data deletes it permanently.** Settings > Apps > Safari > Clear History and Website Data, removing the site under Website Data, deleting the Home Screen app, or using Private Browsing all lose the data. Only a backup file can bring it back.
- **Safari may clear storage for sites you have not opened in a while** (around 7 days of Safari use). Home Screen web apps are generally exempt. The Data & storage page can ask the browser for extra protection, but the browser decides.
- **Drafts are plain text.** Copy them into Pages, Word or Google Docs to format and save as PDF.
- **Matching is keyword-based.** Skill matching compares words in the job description with skills you entered. It is a planning aid, not an assessment of your ability.
- **Status migration.** Older saved stages are converted automatically: Reviewing becomes Interested and Interviewing becomes Interview. An older "Closed" value is kept as it is so its meaning is not guessed.

## Data, privacy, and AI

Your profile, listings, drafts, and plans stay in the current browser's local storage. They are not sent to a server by this app. Use **Export my data** to save a JSON backup somewhere private. Import merges records; it does not replace the whole workspace. Browser storage is specific to the browser and device, so export a backup before changing devices or clearing site data.

There is no connected AI model, paid API, API key, backend, or live job/company search. The prompt builder prepares copyable text for an external AI service you choose. You decide whether to use that service, what information to share, and how to edit the resulting draft. Review every draft for accuracy before using it.

## iPad-only setup (no laptop)

Development, tests and builds run in GitHub (Codespaces or Claude Code), never on the iPad. To publish the app so Safari can open it without Codespaces running:

1. In Safari, open your repository on github.com and tap **Settings** (top bar; on a narrow screen tap the **···** menu first).
2. In the left menu tap **Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**. Pages is free for public repositories like this one, so no paid plan is needed. (Your repository already has Pages turned on, so you may only need to confirm this setting.)
4. Tap the **Actions** tab, open **Deploy Career Studio to GitHub Pages**, and wait for the green tick.
5. Open the address shown in the deploy step (it looks like `https://<username>.github.io/Personal-career-Assistant-AI/`).
6. Tap **Share → Add to Home Screen**.

Note: on a free plan, GitHub Pages sites are public. Your saved data is still private because it stays in your browser, but anyone with the link can open the empty app.

## GitHub Pages deployment

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds and deploys the `main` branch to Pages. Its Vite base path is configured for this repository's project-site URL. GitHub Pages must be enabled with **GitHub Actions** as its build/deployment source. After the workflow succeeds, the deployment job reports the live URL.

The app can also be built locally with `npm run build`; local builds use the root URL, while GitHub Actions builds use the repository subpath.
