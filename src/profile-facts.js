// Structured, user-entered career facts. Drafts only ever use entries the
// user has marked as confirmed; anything missing becomes a visible placeholder.

export const SKILL_LEVELS = ['Learning', 'Comfortable', 'Confident'];

export const FACT_SECTIONS = [
  {
    key: 'education',
    title: 'Education',
    singular: 'education entry',
    fields: [
      { key: 'qualification', label: 'Degree or qualification', placeholder: 'e.g. MBA, Operations and Marketing', required: true },
      { key: 'institution', label: 'Institution', placeholder: 'College or university name' },
      { key: 'dates', label: 'Dates', placeholder: 'e.g. 2025 to 2027 (expected)' },
      { key: 'details', label: 'Details (optional)', placeholder: 'Specialisation, relevant coursework, grade only if official', multiline: true },
    ],
  },
  {
    key: 'experience',
    title: 'Work experience and internships',
    singular: 'experience entry',
    fields: [
      { key: 'role', label: 'Role title', placeholder: 'Exact title you held', required: true },
      { key: 'organisation', label: 'Organisation', placeholder: 'Company or organisation' },
      { key: 'dates', label: 'Dates', placeholder: 'e.g. Feb 2025 to Aug 2025' },
      { key: 'details', label: 'What you did (one line per point)', placeholder: 'Only work you actually did. Add numbers only if you can prove them.', multiline: true },
    ],
  },
  {
    key: 'skills',
    title: 'Skills',
    singular: 'skill',
    fields: [
      { key: 'name', label: 'Skill', placeholder: 'e.g. Excel, SQL, stakeholder communication', required: true },
      { key: 'level', label: 'Honest level', options: SKILL_LEVELS },
      { key: 'evidence', label: 'Where you used it (optional)', placeholder: 'Course, project or job where you used it' },
    ],
  },
  {
    key: 'projects',
    title: 'Projects',
    singular: 'project',
    fields: [
      { key: 'name', label: 'Project name', placeholder: 'Project name', required: true },
      { key: 'role', label: 'Your role', placeholder: 'What you personally did' },
      { key: 'dates', label: 'Dates', placeholder: 'e.g. Aug 2026' },
      { key: 'link', label: 'Link (optional)', placeholder: 'https://...' },
      { key: 'details', label: 'Description', placeholder: 'Problem, what you built or analysed, honest result', multiline: true },
    ],
  },
  {
    key: 'achievements',
    title: 'Achievements, certificates and publications',
    singular: 'achievement',
    fields: [
      { key: 'title', label: 'Achievement', placeholder: 'e.g. Paper published, certificate earned', required: true },
      { key: 'issuer', label: 'Issuer or event', placeholder: 'Who awarded or published it' },
      { key: 'dates', label: 'Date', placeholder: 'e.g. 2025' },
      { key: 'details', label: 'Details (optional)', placeholder: 'Short factual note', multiline: true },
    ],
  },
];

export const EMPTY_FACTS = Object.fromEntries(FACT_SECTIONS.map((section) => [section.key, []]));

function sectionFor(key) {
  return FACT_SECTIONS.find((section) => section.key === key);
}

export function emptyFact(sectionKey, id = `${sectionKey}-${Date.now()}`) {
  const section = sectionFor(sectionKey);
  const fact = { id, confirmed: false };
  for (const field of section?.fields || []) fact[field.key] = field.options ? field.options[0] : '';
  return fact;
}

function cleanText(value) {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

export function primaryText(sectionKey, fact) {
  const field = sectionFor(sectionKey)?.fields.find((item) => item.required);
  return cleanText(fact?.[field?.key]).trim();
}

// Accepts whatever was saved before (or nothing) and returns a safe facts object.
// When there are no structured facts yet, older free-text profile fields are
// carried over as UNCONFIRMED entries so the user can review them.
export function normalizeFacts(saved, legacyProfile = {}) {
  const facts = {};
  const hasSaved = saved && typeof saved === 'object' && !Array.isArray(saved);
  for (const section of FACT_SECTIONS) {
    const list = hasSaved && Array.isArray(saved[section.key]) ? saved[section.key] : [];
    facts[section.key] = list
      .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item, index) => {
        const fact = { ...item, id: item.id ?? `${section.key}-restored-${index}`, confirmed: item.confirmed === true };
        for (const field of section.fields) {
          fact[field.key] = field.options && !field.options.includes(item[field.key]) ? field.options[0] : cleanText(item[field.key]);
        }
        return fact;
      });
  }
  if (!hasSaved && legacyProfile && typeof legacyProfile === 'object') {
    const education = cleanText(legacyProfile.education).trim();
    if (education) {
      facts.education.push({
        ...emptyFact('education', 'education-from-old-profile'),
        qualification: education,
        dates: cleanText(legacyProfile.expectedGraduation).trim() ? `Expected ${cleanText(legacyProfile.expectedGraduation).trim()}` : '',
        fromOldProfile: true,
      });
    }
    cleanText(legacyProfile.skills).split(/[,;\n]/).map((skill) => skill.trim()).filter(Boolean)
      .forEach((name, index) => facts.skills.push({ ...emptyFact('skills', `skill-from-old-profile-${index}`), name, fromOldProfile: true }));
  }
  return facts;
}

export function confirmedFacts(facts, sectionKey) {
  const list = facts && Array.isArray(facts[sectionKey]) ? facts[sectionKey] : [];
  return list.filter((fact) => fact && fact.confirmed === true && primaryText(sectionKey, fact));
}

export function unconfirmedCount(facts) {
  return FACT_SECTIONS.reduce((total, section) => total + (Array.isArray(facts?.[section.key])
    ? facts[section.key].filter((fact) => fact && !fact.confirmed && primaryText(section.key, fact)).length
    : 0), 0);
}

export function confirmedSkillNames(facts) {
  return confirmedFacts(facts, 'skills').map((skill) => skill.name.trim());
}

function normalize(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function skillMatches(a, b) {
  const first = normalize(a);
  const second = normalize(b);
  return Boolean(first && second) && (first === second || first.includes(second) || second.includes(first));
}

export function compareJobSkills(job, facts) {
  const required = (Array.isArray(job?.requiredSkills) ? job.requiredSkills : cleanText(job?.requiredSkills).split(/[,;\n]/))
    .map((skill) => cleanText(skill).trim()).filter(Boolean);
  const confirmed = confirmedFacts(facts, 'skills');
  const matched = confirmed.filter((skill) => required.some((need) => skillMatches(need, skill.name)));
  const missing = required.filter((need) => !confirmed.some((skill) => skillMatches(need, skill.name)));
  return { required, matched, missing };
}

const join = (parts, separator = ', ') => parts.map((part) => cleanText(part).trim()).filter(Boolean).join(separator);

function bulletLines(text) {
  return cleanText(text).split('\n').map((line) => line.replace(/^[\s\-*•]+/, '').trim()).filter(Boolean).map((line) => `  - ${line}`);
}

export function placeholderList(text) {
  return [...new Set(cleanText(text).match(/\[[^\]]+\]/g) || [])];
}

export function buildResumeDraft(profile = {}, facts = EMPTY_FACTS, targetJob = null) {
  const realName = cleanText(profile.name).trim();
  const contact = join([profile.email, profile.phone, profile.city, profile.linkedin], ' | ') || '[Add email and city in Career profile]';
  const lines = [realName ? realName.toUpperCase() : '[Add your name in Career profile]', contact, ''];
  if (targetJob && (targetJob.title || targetJob.company)) {
    lines.push(`Target role: ${join([targetJob.title, targetJob.company], ' at ')}`, '');
  }

  lines.push('PROFESSIONAL SUMMARY');
  lines.push(profile.summaryConfirmed && cleanText(profile.headline).trim()
    ? cleanText(profile.headline).trim()
    : '[Write a 2 to 3 line summary in Career profile and tick "I confirm this summary is accurate"]');
  lines.push('');

  lines.push('EDUCATION');
  const education = confirmedFacts(facts, 'education');
  if (education.length) {
    for (const item of education) {
      lines.push(join([item.qualification, item.institution, item.dates], ' | '));
      lines.push(...bulletLines(item.details));
    }
  } else lines.push('[Add and confirm your education in Career profile]');
  lines.push('');

  const experience = confirmedFacts(facts, 'experience');
  lines.push('EXPERIENCE');
  if (experience.length) {
    for (const item of experience) {
      lines.push(join([item.role, item.organisation, item.dates], ' | '));
      const points = bulletLines(item.details);
      lines.push(...(points.length ? points : ['  - [Add what you did in this role]']));
    }
  } else lines.push('[Add and confirm work experience or internships, or remove this section if you have none]');
  lines.push('');

  lines.push('PROJECTS');
  const projects = confirmedFacts(facts, 'projects');
  if (projects.length) {
    for (const item of projects) {
      lines.push(join([item.name, item.role, item.dates], ' | '));
      lines.push(...bulletLines(item.details));
      if (cleanText(item.link).trim()) lines.push(`  Link: ${cleanText(item.link).trim()}`);
    }
  } else lines.push('[Add and confirm at least one project in Career profile]');
  lines.push('');

  lines.push('SKILLS');
  let skills = confirmedFacts(facts, 'skills');
  if (targetJob) {
    const { matched } = compareJobSkills(targetJob, facts);
    const matchedIds = new Set(matched.map((skill) => skill.id));
    skills = [...matched, ...skills.filter((skill) => !matchedIds.has(skill.id))];
  }
  lines.push(skills.length
    ? skills.map((skill) => (skill.level && skill.level !== 'Confident' ? `${skill.name.trim()} (${skill.level.toLowerCase()})` : skill.name.trim())).join(', ')
    : '[Add and confirm your skills in Career profile]');
  lines.push('');

  const achievements = confirmedFacts(facts, 'achievements');
  if (achievements.length) {
    lines.push('ACHIEVEMENTS AND CERTIFICATIONS');
    for (const item of achievements) {
      lines.push(`- ${join([item.title, item.issuer, item.dates], ' | ')}`);
      lines.push(...bulletLines(item.details).map((line) => `  ${line}`));
    }
  }

  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text, placeholders: placeholderList(text), omittedUnconfirmed: unconfirmedCount(facts) };
}

export function buildCoverLetterDraft(profile = {}, facts = EMPTY_FACTS, job = {}) {
  const title = cleanText(job?.title).trim() || '[job title]';
  const company = cleanText(job?.company).trim() || '[company name]';
  const name = cleanText(profile.name).trim() || '[Your name]';
  const paragraphs = ['Dear Hiring Manager,'];

  paragraphs.push(`I am applying for the ${title} role at ${company}. [Add one specific reason this role or company interests you, based on your own research.]`);

  const education = confirmedFacts(facts, 'education')[0];
  const experience = confirmedFacts(facts, 'experience')[0];
  const background = [];
  if (education) background.push(`My education includes ${join([education.qualification, education.institution], ' at ')}${education.dates ? ` (${education.dates.trim()})` : ''}.`);
  if (experience) background.push(`I worked as ${experience.role.trim()}${experience.organisation ? ` at ${experience.organisation.trim()}` : ''}${experience.dates ? ` (${experience.dates.trim()})` : ''}. [Add one result or responsibility from that role that relates to this job.]`);
  paragraphs.push(background.length ? background.join(' ') : '[Add your confirmed education or experience in Career profile so it can appear here.]');

  const { required, matched, missing } = compareJobSkills(job, facts);
  if (matched.length) {
    paragraphs.push(`Skills from this posting that I can speak to: ${matched.map((skill) => (skill.level && skill.level !== 'Confident' ? `${skill.name.trim()} (${skill.level.toLowerCase()})` : skill.name.trim())).join(', ')}.${missing.length ? ` [Optional: say honestly how you are building ${missing.slice(0, 3).join(', ')}.]` : ''}`);
  } else if (required.length) {
    paragraphs.push(`[None of the skills saved for this job match your confirmed skills yet. Mention a confirmed skill that is relevant, or say honestly how you are building ${required.slice(0, 3).join(', ')}.]`);
  } else {
    paragraphs.push('[Add required skills to this job, then mention one or two confirmed skills that match.]');
  }

  const project = confirmedFacts(facts, 'projects')[0];
  paragraphs.push(project
    ? `One project that shows how I work: ${project.name.trim()}${cleanText(project.details).trim() ? `. ${cleanText(project.details).trim().split('\n')[0].replace(/\.$/, '')}.` : '. [Add one line on what you did and the result.]'}`
    : '[Optional: add a confirmed project in Career profile to mention here.]');

  paragraphs.push(`Thank you for considering my application. I would welcome the chance to discuss how I can contribute to ${company}.`);
  paragraphs.push(`Sincerely,\n${name}`);

  const text = paragraphs.join('\n\n');
  return { text, placeholders: placeholderList(text) };
}
