# Career Studio

A private, local-first career workspace for planning a job search. It is built with React and Vite, works on iPad Safari and desktop browsers, and saves your workspace in that browser's local storage.

## What the app includes

- **Overview** — application pipeline, drafts, interview-prep status, and roadmap progress.
- **Career profile** — facts you enter yourself; the app starts blank rather than inventing a career history.
- **Resume builder** and **Cover letters** — editable drafts for you to review.
- **Job discovery** — manual listings, global location and work-mode preferences, local job-description skill comparison, and one-tap tracking. It does not use a live vacancy API.
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

## Data, privacy, and AI

Your profile, listings, drafts, and plans stay in the current browser's local storage. They are not sent to a server by this app. Use **Export my data** to save a JSON backup somewhere private. Import merges records; it does not replace the whole workspace. Browser storage is specific to the browser and device, so export a backup before changing devices or clearing site data.

There is no connected AI model, paid API, API key, backend, or live job/company search. The prompt builder prepares copyable text for an external AI service you choose. You decide whether to use that service, what information to share, and how to edit the resulting draft. Review every draft for accuracy before using it.

## Install on iPad

The production site is a Progressive Web App (PWA). Open it in Safari over HTTPS, let it load once while online, then use **Share → Add to Home Screen**. The installed app can reopen its cached interface while offline; external links and any AI service still require their own connection. Keep browser storage or an exported backup to preserve your data.

## GitHub Pages deployment

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds and deploys the `main` branch to Pages. Its Vite base path is configured for this repository's project-site URL. GitHub Pages must be enabled with **GitHub Actions** as its build/deployment source. After the workflow succeeds, the deployment job reports the live URL.

The app can also be built locally with `npm run build`; local builds use the root URL, while GitHub Actions builds use the repository subpath.
