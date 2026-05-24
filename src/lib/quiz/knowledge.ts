import modelsData from '../../data/models.json';
import constructsData from '../../data/constructs.json';
import academicsData from '../../data/academics.json';
import literatureData from '../../data/literature.json';
import researchQuestionsData from '../../data/research-questions.json';
import fieldsData from '../../data/fields.json';

export interface QuizModel {
  id: string;
  name: string;
  abbreviation: string;
  year: number | null;
  authors: string[];
  description: string;
  notes: string;
  constructs: string[];
  constructAbbreviations: Record<string, string>;
  relationships: { from: string; to: string }[];
}

export interface QuizConstruct {
  id: string;
  name: string;
  abbreviation: string;
  definition: string;
  sourcePaper: string;
  relatedModels: string[];
  notes: string;
}

export interface QuizAcademic {
  id: string;
  name: string;
  modelIds: string[];
  constructs: string[];
  bio: string;
}

export interface QuizLiteratureEntry {
  id: string;
  citation: string;
  keyConstructs: string[];
  findings: string;
  summary: string;
}

export interface QuizKnowledge {
  models: QuizModel[];
  constructs: QuizConstruct[];
  academics: QuizAcademic[];
  literature: QuizLiteratureEntry[];
  currentResearchQuestion: string;
  primaryFieldName: string;
}

/** Core continuance / post-adoption models for your PhD */
export const CI_MODEL_IDS = new Set([
  'ect',
  'ecm-is',
  'my-thesis-model',
  'my-thesis-2',
  'tpc',
  'issm',
]);

/** Often compared with continuance models in your literature */
export const ADOPTION_COMPARE_IDS = new Set(['tam', 'tam2', 'tra', 'tpb', 'utaut', 'utaut2']);

function normalizeModel(raw: (typeof modelsData)[number]): QuizModel {
  return {
    id: raw.id,
    name: raw.name,
    abbreviation: raw.abbreviation,
    year: raw.year ?? null,
    authors: raw.authors ?? [],
    description: raw.description ?? '',
    notes: raw.notes ?? '',
    constructs: raw.constructs ?? [],
    constructAbbreviations: raw.constructAbbreviations ?? {},
    relationships: raw.relationships ?? [],
  };
}

function normalizeConstruct(raw: (typeof constructsData)[number]): QuizConstruct {
  return {
    id: raw.id,
    name: raw.name,
    abbreviation: raw.abbreviation ?? '',
    definition: raw.definition ?? '',
    sourcePaper: raw.sourcePaper ?? '',
    relatedModels: raw.relatedModels ?? [],
    notes: raw.notes ?? '',
  };
}

function normalizeAcademic(raw: (typeof academicsData)[number]): QuizAcademic {
  const modelIds =
    raw.keyContributions?.map((c) => c.modelId).filter((id): id is string => Boolean(id)) ?? [];
  return {
    id: raw.id,
    name: raw.name,
    modelIds,
    constructs: raw.constructs ?? [],
    bio: raw.bio ?? '',
  };
}

let cached: QuizKnowledge | null = null;

export function getQuizKnowledge(): QuizKnowledge {
  if (cached) return cached;

  const models = (modelsData as (typeof modelsData)[number][]).map(normalizeModel);
  const constructs = (constructsData as (typeof constructsData)[number][]).map(normalizeConstruct);
  const academics = (academicsData as (typeof academicsData)[number][])
    .map(normalizeAcademic)
    .filter((a) => a.modelIds.length > 0 || a.constructs.length > 0);

  const literature = (literatureData as QuizLiteratureEntry[]).map((e) => ({
    id: e.id,
    citation: e.citation,
    keyConstructs: e.keyConstructs ?? [],
    findings: e.findings ?? '',
    summary: e.summary ?? '',
  }));

  const rqList = researchQuestionsData as {
    status: string;
    question: string;
  }[];
  const currentRq = rqList.find((r) => r.status === 'current')?.question ?? rqList[0]?.question ?? '';

  const fields = fieldsData as { id: string; name: string; category?: string }[];
  const primaryField =
    fields.find((f) => f.category === 'primary')?.name ?? fields[0]?.name ?? 'Information Systems';

  cached = {
    models,
    constructs,
    academics,
    literature,
    currentResearchQuestion: currentRq,
    primaryFieldName: primaryField,
  };
  return cached;
}

export function modelsForFocus(focus: QuizFocus, knowledge: QuizKnowledge): QuizModel[] {
  if (focus === 'all') {
    return knowledge.models.filter((m) => m.authors.length > 0 || m.constructs.length > 0);
  }
  return knowledge.models.filter(
    (m) =>
      CI_MODEL_IDS.has(m.id) ||
      ADOPTION_COMPARE_IDS.has(m.id) ||
      m.constructs.some((c) => /continuance/i.test(c))
  );
}

export function constructInFocus(
  c: QuizConstruct,
  focus: QuizFocus,
  models: QuizModel[]
): boolean {
  if (focus === 'all') return true;
  const modelAbbrevs = new Set(models.map((m) => m.abbreviation));
  const modelNames = new Set(models.map((m) => m.name));
  if (c.relatedModels.some((rm) => modelAbbrevs.has(rm) || modelNames.has(rm))) return true;
  if (/continuance|confirmation|satisfaction|task-technology fit/i.test(c.name)) return true;
  return false;
}

export function modelHasContinuance(model: QuizModel): boolean {
  return model.constructs.some(
    (c) => /continuance/i.test(c) || model.constructAbbreviations[c] === 'CI'
  );
}

export function abbrevForConstruct(model: QuizModel, constructName: string): string {
  return model.constructAbbreviations[constructName] ?? constructName;
}

export function resolveRelationshipLabel(model: QuizModel, abbrev: string): string {
  for (const [name, ab] of Object.entries(model.constructAbbreviations)) {
    if (ab === abbrev) return name;
  }
  return abbrev;
}
