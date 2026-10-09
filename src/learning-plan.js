export const CORE_SKILLS = [
  { id: 'excel', name: 'Excel / spreadsheets', category: 'Shared foundation' },
  { id: 'sql', name: 'SQL', category: 'Shared foundation' },
  { id: 'business-metrics', name: 'Business metrics', category: 'Shared foundation' },
  { id: 'dashboards', name: 'Dashboards and reporting', category: 'Shared foundation' },
  { id: 'communication', name: 'Business communication', category: 'Shared foundation' },
  { id: 'problem-solving', name: 'Structured problem-solving', category: 'Shared foundation' },
  { id: 'product-management', name: 'Product management', category: 'Optional product and industry skills' },
  { id: 'requirements-analysis', name: 'Requirements analysis', category: 'Optional product and industry skills' },
  { id: 'industry-research', name: 'Industry research', category: 'Optional product and industry skills' },
  { id: 'consulting-cases', name: 'Consulting case practice', category: 'Optional product and industry skills' },
];

export const COMBINED_LEARNING_PLAN = [
  {
    id: 'learn-spreadsheets',
    group: 'Shared foundation',
    skill: 'Excel / spreadsheets',
    title: 'Build reliable spreadsheet analysis habits',
    detail: 'Practice cleaning tables, formulas, lookups, pivot tables, and checking totals before sharing results.',
    resourceLabel: 'GCFGlobal Excel tutorials (free)',
    resourceUrl: 'https://edu.gcfglobal.org/en/excel/',
    targetDate: '',
    status: 'Not started',
    notes: '',
    done: false,
  },
  {
    id: 'learn-sql',
    group: 'Shared foundation',
    skill: 'SQL',
    title: 'Query and explain business data',
    detail: 'Practice SELECT, filtering, joins, grouping, and validating the question a query answers.',
    resourceLabel: 'SQLBolt lessons (free)',
    resourceUrl: 'https://sqlbolt.com/',
    targetDate: '',
    status: 'Not started',
    notes: '',
    done: false,
  },
  {
    id: 'learn-metrics',
    group: 'Shared foundation',
    skill: 'Business metrics',
    title: 'Define useful business metrics',
    detail: 'Connect a business question to a measure, a denominator, a time period, and a caveat.',
    resourceLabel: 'Khan Academy statistics (free)',
    resourceUrl: 'https://www.khanacademy.org/math/statistics-probability',
    targetDate: '',
    status: 'Not started',
    notes: '',
    done: false,
  },
  {
    id: 'learn-dashboards',
    group: 'Shared foundation',
    skill: 'Dashboards and reporting',
    title: 'Build a useful dashboard in Power BI or Tableau',
    detail: 'Choose a few decision-relevant measures, label them clearly, and explain what changed using either tool.',
    resourceLabel: 'Microsoft Learn: Power BI (free training)',
    resourceUrl: 'https://learn.microsoft.com/training/powerplatform/power-bi/',
    targetDate: '',
    status: 'Not started',
    notes: '',
    done: false,
  },
  {
    id: 'learn-communication',
    group: 'Shared foundation',
    skill: 'Business communication',
    title: 'Communicate findings with evidence',
    detail: 'Write a concise question, evidence, conclusion, limitation, and recommended next check.',
    resourceLabel: 'Purdue OWL professional writing (free)',
    resourceUrl: 'https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/index.html',
    targetDate: '',
    status: 'Not started',
    notes: '',
    done: false,
  },
  {
    id: 'learn-structured-problem-solving',
    group: 'Shared foundation',
    skill: 'Structured problem-solving',
    title: 'Practice structured problem-solving',
    detail: 'Frame the problem, separate facts from assumptions, test causes, and document the next action.',
    resourceLabel: 'OpenLearn: problem solving (free)',
    resourceUrl: 'https://www.open.edu/openlearn/money-business/leadership-management/problem-solving/content-section-0',
    targetDate: '',
    status: 'Not started',
    notes: '',
    done: false,
  },
  {
    id: 'learn-product',
    group: 'Optional product and industry skills',
    skill: 'Product management',
    title: 'Explore product management fundamentals',
    detail: 'If you are targeting product roles, practice discovery, prioritization, roadmaps, and product success measures.',
    resourceLabel: 'Atlassian product management guide (free)',
    resourceUrl: 'https://www.atlassian.com/agile/product-management',
    targetDate: '',
    status: 'Not started',
    notes: '',
    done: false,
  },
  {
    id: 'learn-operations',
    group: 'Optional product and industry skills',
    skill: 'Requirements analysis',
    title: 'Explore business analysis techniques',
    detail: 'If relevant to your target roles, practice clarifying needs, documenting requirements, and checking acceptance criteria.',
    resourceLabel: 'IIBA business analysis resources',
    resourceUrl: 'https://www.iiba.org/business-analysis-blogs/',
    targetDate: '',
    status: 'Not started',
    notes: '',
    done: false,
  },
  {
    id: 'learn-marketing',
    group: 'Optional product and industry skills',
    skill: 'Industry research',
    title: 'Build knowledge in an industry you choose',
    detail: 'Select a target sector, learn its language, and verify the context with reliable public sources.',
    resourceLabel: 'U.S. Bureau of Labor Statistics industry data',
    resourceUrl: 'https://www.bls.gov/iag/',
    targetDate: '',
    status: 'Not started',
    notes: '',
    done: false,
  },
  {
    id: 'learn-finance-healthcare',
    group: 'Optional product and industry skills',
    skill: 'Consulting case practice',
    title: 'Practice structured consulting cases',
    detail: 'If consulting is a target, practice clarifying the question, structuring an approach, and explaining evidence.',
    resourceLabel: 'Case interview practice overview',
    resourceUrl: 'https://www.caseinterview.com/',
    targetDate: '',
    status: 'Not started',
    notes: '',
    done: false,
  },
];

const legacyRoadmapTitles = new Set([
  'Refresh portfolio case study',
  'Schedule two design conversations',
  'Practice analytics story',
]);

export function mergeLearningPlan(savedPlan, legacyRoadmap = []) {
  const saved = [...(Array.isArray(savedPlan) ? savedPlan : []), ...(Array.isArray(legacyRoadmap) ? legacyRoadmap : [])]
    .filter((item) => item && typeof item === 'object');
  const savedById = new Map(saved.filter((item) => item.id !== undefined).map((item) => [item.id, item]));
  const defaults = COMBINED_LEARNING_PLAN.map((item) => {
    const savedItem = savedById.get(item.id);
    const status = ['Not started', 'In progress', 'Done'].includes(savedItem?.status)
      ? savedItem.status
      : savedItem?.done ? 'Done' : 'Not started';
    return { ...item, ...savedItem, id: item.id, status, done: status === 'Done' };
  });
  const defaultIds = new Set(COMBINED_LEARNING_PLAN.map((item) => item.id));
  const custom = new Map();
  saved.filter((item) => !defaultIds.has(item.id)).forEach((item, index) => {
    const id = item.id ?? `custom-${index}`;
    const status = ['Not started', 'In progress', 'Done'].includes(item.status)
      ? item.status
      : item.done ? 'Done' : 'Not started';
    custom.set(id, {
      ...item,
      id,
      group: item.group || 'My milestones',
      skill: item.skill || item.title || '',
      title: item.title || item.skill || 'My learning milestone',
      detail: item.detail || item.notes || '',
      targetDate: item.targetDate || '',
      resourceLabel: item.resourceLabel || '',
      resourceUrl: item.resourceUrl || '',
      notes: item.notes || item.detail || '',
      status,
      done: status === 'Done',
    });
  });
  return [...defaults, ...custom.values()];
}

export function mergeSkillAssessments(savedSkills) {
  const saved = Array.isArray(savedSkills) ? savedSkills.filter((item) => item && typeof item === 'object') : [];
  const used = new Set();
  const defaults = CORE_SKILLS.map((skill) => {
    const existing = saved.find((item) => item.id === `core-${skill.id}` || item.name?.toLowerCase() === skill.name.toLowerCase());
    if (existing) used.add(existing);
    return {
      ...skill,
      id: `core-${skill.id}`,
      current: Number.isInteger(existing?.current) && existing.current >= 1 && existing.current <= 5 ? existing.current : null,
      target: Number.isInteger(existing?.target) && existing.target >= 1 && existing.target <= 5 ? existing.target : null,
    };
  });
  return [...defaults, ...saved.filter((item) => !used.has(item) && !CORE_SKILLS.some((skill) => item.name?.toLowerCase() === skill.name.toLowerCase()))];
}

export function removeLegacyRoadmapSamples(roadmap) {
  if (!Array.isArray(roadmap)) return [];
  return roadmap.filter((item) => item && typeof item === 'object' && !legacyRoadmapTitles.has(item.title));
}