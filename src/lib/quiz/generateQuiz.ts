import {
  getQuizKnowledge,
  modelsForFocus,
  constructInFocus,
  modelHasContinuance,
  abbrevForConstruct,
  resolveRelationshipLabel,
  type QuizModel,
  type QuizConstruct,
  type QuizAcademic,
} from './knowledge';
import { CURATED_FACTS } from './quizFacts';
import type {
  QuizQuestion,
  QuizOptions,
  QuizResult,
  MultipleChoiceQuestion,
  TrueFalseQuestion,
  YesNoQuestion,
  MatchQuestion,
} from './types';

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pick<T>(arr: T[], rand: () => number): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rand() * arr.length)];
}

function pickMany<T>(arr: T[], n: number, rand: () => number): T[] {
  return shuffle(arr, rand).slice(0, Math.min(n, arr.length));
}

function uniqueId(prefix: string, rand: () => number): string {
  return `${prefix}-${Math.floor(rand() * 1e9)}`;
}

function optionId(label: string, rand: () => number): string {
  return `opt-${label.slice(0, 12).replace(/\W/g, '')}-${Math.floor(rand() * 1e6)}`;
}

function buildMcq(
  prompt: string,
  correctLabel: string,
  wrongLabels: string[],
  explanation: string,
  source: string,
  rand: () => number
): MultipleChoiceQuestion | null {
  const labels = shuffle(
    [correctLabel, ...wrongLabels.filter((w) => w && w !== correctLabel)],
    rand
  ).slice(0, 4);
  if (!labels.includes(correctLabel)) labels[0] = correctLabel;
  const options = labels.map((label) => ({ id: optionId(label, rand), label }));
  const correctOptionId = options.find((o) => o.label === correctLabel)?.id ?? options[0].id;
  return {
    id: uniqueId('mc', rand),
    type: 'multiple_choice',
    prompt,
    options,
    correctOptionId,
    explanation,
    source,
  };
}

function genAuthorQuestions(models: QuizModel[], rand: () => number): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const model of models) {
    if (model.authors.length === 0) continue;
    const correct = model.authors.join(' & ');
    const others = models
      .filter((m) => m.id !== model.id && m.authors.length > 0)
      .map((m) => m.authors.join(' & '));
    const q = buildMcq(
      `Who is a main author associated with ${model.name} (${model.abbreviation})?`,
      correct,
      pickMany(others, 3, rand),
      `${model.name} is linked to ${correct}${model.year ? ` (${model.year})` : ''}.`,
      `${model.name} model`,
      rand
    );
    if (q) out.push(q);
  }
  return out;
}

function genConstructInModel(models: QuizModel[], rand: () => number): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const model of models) {
    if (model.constructs.length < 3) continue;
    const correct = pick(model.constructs, rand);
    if (!correct) continue;
    const wrong = model.constructs.filter((c) => c !== correct);
    const distractors = models
      .filter((m) => m.id !== model.id)
      .flatMap((m) => m.constructs)
      .filter((c) => !model.constructs.includes(c));
    const q = buildMcq(
      `Which construct belongs to ${model.name}?`,
      correct,
      [...pickMany(wrong, 1, rand), ...pickMany(distractors, 2, rand)],
      `"${correct}" is listed in your ${model.name} model page.`,
      `${model.name} constructs`,
      rand
    );
    if (q) out.push(q);
  }
  return out;
}

function genConstructNotInModel(models: QuizModel[], rand: () => number): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const model of models) {
    if (model.constructs.length < 2) continue;
    const foreign = models
      .filter((m) => m.id !== model.id)
      .flatMap((m) => m.constructs)
      .filter((c) => !model.constructs.includes(c));
    const correct = pick(foreign, rand);
    if (!correct) continue;
    const q = buildMcq(
      `Which construct is NOT part of ${model.name}?`,
      correct,
      pickMany(model.constructs, 3, rand),
      `"${correct}" is not in the ${model.name} construct list.`,
      `${model.name} constructs`,
      rand
    );
    if (q) out.push(q);
  }
  return out;
}

function genYearQuestions(models: QuizModel[], rand: () => number): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  const withYear = models.filter((m) => m.year != null);
  for (const model of withYear) {
    const correct = String(model.year);
    const years = withYear
      .filter((m) => m.id !== model.id && m.year != null)
      .map((m) => String(m.year));
    const q = buildMcq(
      `Approximately when was ${model.name} (${model.abbreviation}) first published or proposed (per your model library)?`,
      correct,
      pickMany(years, 3, rand),
      `Your records show ${model.year} for ${model.name}.`,
      `${model.name} model`,
      rand
    );
    if (q) out.push(q);
  }
  return out;
}

function genAbbreviationQuestions(models: QuizModel[], rand: () => number): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const model of models) {
    const entries = Object.entries(model.constructAbbreviations);
    if (entries.length < 2) continue;
    const [name, abbr] = pick(entries, rand) ?? [];
    if (!name || !abbr) continue;
    const otherAbbrs = entries.filter(([n]) => n !== name).map(([, a]) => a);
    const q = buildMcq(
      `In ${model.name}, what is the abbreviation for "${name}"?`,
      abbr,
      pickMany(otherAbbrs, 3, rand),
      `${name} → ${abbr} in ${model.abbreviation}.`,
      `${model.name} abbreviations`,
      rand
    );
    if (q) out.push(q);
  }
  return out;
}

function genRelationshipQuestions(models: QuizModel[], rand: () => number): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const model of models) {
    if (model.relationships.length === 0) continue;
    const rel = pick(model.relationships, rand);
    if (!rel) continue;
    const fromLabel = resolveRelationshipLabel(model, rel.from);
    const toLabel = resolveRelationshipLabel(model, rel.to);
    const correct = toLabel;
    const otherTos = model.relationships
      .filter((r) => r.from === rel.from && r.to !== rel.to)
      .map((r) => resolveRelationshipLabel(model, r.to));
    const distractors = model.constructs
      .map((c) => resolveRelationshipLabel(model, abbrevForConstruct(model, c)))
      .filter((c) => c !== correct && !otherTos.includes(c));
    const q = buildMcq(
      `In ${model.name}, ${fromLabel} (${rel.from}) influences which construct?`,
      correct,
      [...otherTos, ...pickMany(distractors, 3, rand)],
      `Your ${model.name} diagram shows ${rel.from} → ${rel.to} (${fromLabel} → ${toLabel}).`,
      `${model.name} relationships`,
      rand
    );
    if (q) out.push(q);
  }
  return out;
}

function genPostAdoptionModel(models: QuizModel[], rand: () => number): QuizQuestion[] {
  const continuance = models.filter(modelHasContinuance);
  const adoptionOnly = models.filter((m) => !modelHasContinuance(m) && m.id === 'tam');
  if (continuance.length === 0 || adoptionOnly.length === 0) return [];
  const correct = pick(continuance, rand)?.name;
  if (!correct) return [];
  const q = buildMcq(
    'Which model in your library is primarily used to explain post-adoption continuance intention?',
    correct,
    pickMany(
      [...adoptionOnly, ...models.filter((m) => m.id === 'utaut')].map((m) => m.name),
      3,
      rand
    ),
    'ECM-IS and ECT focus on continuance after initial adoption; TAM focuses on initial acceptance.',
    'Models comparison',
    rand
  );
  return q ? [q] : [];
}

function genConstructRelatedModel(
  constructs: QuizConstruct[],
  models: QuizModel[],
  rand: () => number
): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  const withModels = constructs.filter((c) => c.relatedModels.length > 0);
  for (const c of withModels) {
    const correctAbbr = c.relatedModels[0];
    const correctModel = models.find(
      (m) => m.abbreviation === correctAbbr || m.name === correctAbbr
    );
    const correct = correctModel?.name ?? correctAbbr;
    const wrong = models
      .filter((m) => m.abbreviation !== correctAbbr && m.name !== correctAbbr)
      .map((m) => m.name);
    const q = buildMcq(
      `"${c.name}" is a key construct in which model (per your construct library)?`,
      correct,
      pickMany(wrong, 3, rand),
      c.sourcePaper
        ? `Source: ${c.sourcePaper}`
        : `Related models: ${c.relatedModels.join(', ')}`,
      `Construct: ${c.name}`,
      rand
    );
    if (q) out.push(q);
  }
  return out;
}

function genLiteratureQuestions(
  literature: ReturnType<typeof getQuizKnowledge>['literature'],
  rand: () => number
): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const entry of literature) {
    if (entry.keyConstructs.length === 0) continue;
    const correct = entry.keyConstructs[0];
    const allConstructs = literature.flatMap((e) => e.keyConstructs);
    const q = buildMcq(
      `According to your literature notes, which construct is central to: ${entry.citation.split('.')[0]}?`,
      correct,
      pickMany(
        allConstructs.filter((k) => k !== correct),
        3,
        rand
      ),
      entry.summary || entry.findings,
      'Literature library',
      rand
    );
    if (q) out.push(q);
  }
  return out;
}

function genResearchQuestion(knowledge: ReturnType<typeof getQuizKnowledge>, rand: () => number): QuizQuestion[] {
  const rq = knowledge.currentResearchQuestion;
  if (!rq) return [];
  const q = buildMcq(
    'Which outcome variable does your current research question emphasise?',
    'Continuance intention',
    ['Behavioural intention only', 'Net benefits', 'Relative advantage'],
    `Current RQ: ${rq}`,
    'Research questions',
    rand
  );
  return q ? [q] : [];
}

function genCuratedTrueFalse(focus: QuizOptions['focus'], rand: () => number): QuizQuestion[] {
  const facts = CURATED_FACTS.filter((f) => focus === 'all' || f.focus === 'ci' || f.focus === 'all');
  return facts.map((fact) => {
    const useYesNo = rand() > 0.55;
    if (useYesNo) {
      const q: YesNoQuestion = {
        id: uniqueId('yn', rand),
        type: 'yes_no',
        prompt: fact.statement.replace(/\.$/, '') + '?',
        correct: fact.correct,
        explanation: fact.explanation,
        source: fact.source,
      };
      return q;
    }
    const q: TrueFalseQuestion = {
      id: uniqueId('tf', rand),
      type: 'true_false',
      prompt: fact.statement,
      correct: fact.correct,
      explanation: fact.explanation,
      source: fact.source,
    };
    return q;
  });
}

function genContinuanceYesNo(models: QuizModel[], rand: () => number): QuizQuestion[] {
  return models
    .filter((m) => m.constructs.length > 0)
    .map((model) => {
      const has = modelHasContinuance(model);
      const q: YesNoQuestion = {
        id: uniqueId('yn-ci', rand),
        type: 'yes_no',
        prompt: `Does ${model.name} include continuance intention (or an equivalent continuance outcome)?`,
        correct: has,
        explanation: has
          ? `${model.name} lists a continuance-related construct.`
          : `${model.name} focuses on adoption/intention constructs, not continuance intention.`,
        source: `${model.name} constructs`,
      };
      return q;
    });
}

function genScholarModelMatch(academics: QuizAcademic[], models: QuizModel[], rand: () => number): QuizQuestion[] {
  const eligible = academics
    .map((a) => {
      const m = a.modelIds.map((id) => models.find((x) => x.id === id)).find(Boolean);
      if (!m) return null;
      return {
        left: a.name,
        right: `${m.name} (${m.abbreviation})`,
      };
    })
    .filter((p): p is { left: string; right: string } => Boolean(p));

  const batch = pickMany(eligible, 4, rand);
  if (batch.length < 3) return [];

  const distractors = pickMany(
    models
      .map((m) => `${m.name} (${m.abbreviation})`)
      .filter((label) => !batch.some((p) => p.right === label)),
    2,
    rand
  );

  const match: MatchQuestion = {
    id: uniqueId('match-scholar', rand),
    type: 'match',
    prompt: 'Match each scholar to the model they are best known for in your academic library.',
    pairs: batch,
    rightOptions: shuffle([...batch.map((p) => p.right), ...distractors], rand),
    explanation: 'Drawn from your Academics pages and linked model contributions.',
    source: 'Academics library',
  };
  return [match];
}

function genConstructAbbrevMatch(models: QuizModel[], rand: () => number): QuizQuestion[] {
  const out: MatchQuestion[] = [];
  const candidates = models.filter((m) => Object.keys(m.constructAbbreviations).length >= 4);
  for (const model of candidates) {
    const entries = shuffle(Object.entries(model.constructAbbreviations), rand).slice(0, 4);
    const pairs = entries.map(([name, abbr]) => ({ left: name, right: abbr }));
    const allAbbrs = models.flatMap((m) => Object.values(m.constructAbbreviations));
    const distractors = pickMany(
      allAbbrs.filter((a) => !pairs.some((p) => p.right === a)),
      2,
      rand
    );
    out.push({
      id: uniqueId('match-abbr', rand),
      type: 'match',
      prompt: `Match each construct to its abbreviation in ${model.name}.`,
      pairs,
      rightOptions: shuffle([...pairs.map((p) => p.right), ...distractors], rand),
      explanation: `Review construct abbreviations on the ${model.name} model page.`,
      source: `${model.name} abbreviations`,
    });
  }
  return out;
}

function genModelConstructMatch(models: QuizModel[], rand: () => number): QuizQuestion[] {
  const out: MatchQuestion[] = [];
  const pool = models.filter((m) => m.constructs.length >= 3 && m.authors.length > 0);
  const chosen = pickMany(pool, 4, rand);
  if (chosen.length < 3) return out;
  const pairs = chosen.map((m) => {
    const c = pick(m.constructs, rand) ?? m.constructs[0];
    return { left: c, right: m.abbreviation };
  });
  const rightOptions = shuffle(
    [
      ...pairs.map((p) => p.right),
      ...pickMany(
        models.map((m) => m.abbreviation).filter((a) => !pairs.some((p) => p.right === a)),
        2,
        rand
      ),
    ],
    rand
  );
  out.push({
    id: uniqueId('match-model', rand),
    type: 'match',
    prompt: 'Match each construct to the model abbreviation it belongs to (in your library).',
    pairs,
    rightOptions,
    explanation: 'Each construct appears on exactly one primary model card in your thesis-focused set.',
    source: 'Models & constructs',
  });
  return out;
}

function dedupeQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    const key = `${q.type}:${q.prompt.slice(0, 80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function generateQuiz(options: QuizOptions): QuizResult {
  const seed = options.seed ?? Math.floor(Math.random() * 1e9);
  const rand = mulberry32(seed);
  const knowledge = getQuizKnowledge();
  const models = modelsForFocus(options.focus, knowledge);
  const constructs = knowledge.constructs.filter((c) => constructInFocus(c, options.focus, models));

  const pool: QuizQuestion[] = dedupeQuestions([
    ...genAuthorQuestions(models, rand),
    ...genConstructInModel(models, rand),
    ...genConstructNotInModel(models, rand),
    ...genYearQuestions(models, rand),
    ...genAbbreviationQuestions(models, rand),
    ...genRelationshipQuestions(models, rand),
    ...genPostAdoptionModel(models, rand),
    ...genConstructRelatedModel(constructs, knowledge.models, rand),
    ...genLiteratureQuestions(knowledge.literature, rand),
    ...genResearchQuestion(knowledge, rand),
    ...genCuratedTrueFalse(options.focus, rand),
    ...genContinuanceYesNo(models, rand),
    ...genScholarModelMatch(knowledge.academics, models, rand),
    ...genConstructAbbrevMatch(models, rand),
    ...genModelConstructMatch(models, rand),
  ]);

  const questions = shuffle(pool, rand).slice(0, Math.min(options.count, pool.length));
  return { questions, seed };
}

export function isAnswerCorrect(question: QuizQuestion, answer: unknown): boolean {
  switch (question.type) {
    case 'multiple_choice':
      return answer === question.correctOptionId;
    case 'true_false':
    case 'yes_no':
      return answer === question.correct;
    case 'match': {
      if (!answer || typeof answer !== 'object') return false;
      const map = answer as Record<string, string>;
      return question.pairs.every((p) => map[p.left] === p.right);
    }
    default:
      return false;
  }
}
