/** Curated true/false and yes/no items from your models, thesis notes, and literature review framing */
export interface CuratedFact {
  id: string;
  statement: string;
  correct: boolean;
  explanation: string;
  source: string;
  focus: 'ci' | 'all';
}

export const CURATED_FACTS: CuratedFact[] = [
  {
    id: 'ect-consumer',
    statement: 'Expectation-Confirmation Theory (ECT) was originally developed in consumer behaviour research.',
    correct: true,
    explanation: 'Richard Oliver developed ECT in marketing/consumer behaviour before Bhattacherjee adapted it to IS continuance.',
    source: 'ECT model',
    focus: 'ci',
  },
  {
    id: 'ecm-pu-direct-ci',
    statement: 'In ECM-IS, perceived usefulness can influence continuance intention directly, not only through satisfaction.',
    correct: true,
    explanation: 'Your ECM-IS notes and diagram include a direct path from PU to CI, bypassing satisfaction.',
    source: 'ECM-IS model',
    focus: 'ci',
  },
  {
    id: 'tam-post-adoption',
    statement: 'The original Technology Acceptance Model (TAM) primarily explains post-adoption continuance behaviour.',
    correct: false,
    explanation: 'TAM focuses on pre-adoption acceptance (PU, PEOU → behavioural intention), not post-adoption continuance.',
    source: 'TAM model',
    focus: 'ci',
  },
  {
    id: 'bhattacherjee-extends-oliver',
    statement: 'Bhattacherjee (2001) extended Oliver’s ECT to IS by adding perceived usefulness and reframing the outcome as continuance intention.',
    correct: true,
    explanation: 'ECM-IS bridges consumer ECT with IS post-adoption beliefs and continuance intention.',
    source: 'Bhattacherjee / ECM-IS',
    focus: 'ci',
  },
  {
    id: 'utaut2-voluntary',
    statement: 'UTAUT2 was developed mainly for voluntary, consumer technology contexts.',
    correct: true,
    explanation: 'UTAUT (2003) targeted organisational/mandatory settings; UTAUT2 (2012) adds hedonic motivation, price value, and habit for voluntary use.',
    source: 'UTAUT2 model',
    focus: 'all',
  },
  {
    id: 'utaut-mandatory',
    statement: 'The original UTAUT was validated primarily in organisational settings where use was often mandatory or semi-mandatory.',
    correct: true,
    explanation: 'Social influence and facilitating conditions behave differently under mandatory vs voluntary adoption.',
    source: 'UTAUT model',
    focus: 'all',
  },
  {
    id: 'tpc-ttf-chain',
    statement: 'In the Technology-to-Performance Chain, task–technology fit is a central link between task/technology inputs and utilization.',
    correct: true,
    explanation: 'Goodhue & Thompson (1995): task and technology characteristics → TTF → utilization → performance impact.',
    source: 'TPC model',
    focus: 'ci',
  },
  {
    id: 'thesis2-utilization-equals-ci',
    statement: 'In your integrated thesis model (TPC + ECM-IS), utilization and continuance intention mean the same thing.',
    correct: false,
    explanation: 'Your thesis notes stress that utilization (actual behaviour) ≠ continuance intention (forward-looking intention).',
    source: 'My Thesis 2 model',
    focus: 'ci',
  },
  {
    id: 'toe-individual-level',
    statement: 'The TOE framework primarily explains individual users’ continuance intention.',
    correct: false,
    explanation: 'TOE is organisational-level (technology, organisation, environment contexts); your study is individual-level ECM/TPC.',
    source: 'TOE model notes',
    focus: 'ci',
  },
  {
    id: 'davis-tam-tra',
    statement: 'Fred Davis built TAM on Fishbein and Ajzen’s Theory of Reasoned Action.',
    correct: true,
    explanation: 'TAM adapts TRA to system acceptance, emphasising perceived usefulness and ease of use.',
    source: 'TAM / Davis academic profile',
    focus: 'all',
  },
  {
    id: 'issm-delone',
    statement: 'The Information Systems Success Model (ISSM) was developed by DeLone and McLean.',
    correct: true,
    explanation: 'ISSM (1992, updated 2003) links system, information, and service quality to use, satisfaction, and net benefits.',
    source: 'ISSM model',
    focus: 'ci',
  },
  {
    id: 'ect-sat-to-ci',
    statement: 'In ECT, satisfaction is an antecedent of continuance intention (repurchase/continuance).',
    correct: true,
    explanation: 'The ECT flow runs from expectations and performance → confirmation → satisfaction → continuance intention.',
    source: 'ECT model',
    focus: 'ci',
  },
  {
    id: 'venkatesh-utaut-consolidation',
    statement: 'UTAUT consolidated several competing acceptance models into a unified view.',
    correct: true,
    explanation: 'Venkatesh et al. (2003) integrated TAM, TPB, MPCU, and others into performance expectancy, effort expectancy, social influence, and facilitating conditions.',
    source: 'UTAUT model',
    focus: 'all',
  },
  {
    id: 'rq-ttf-ci',
    statement: 'Your current research question links task–technology fit to continuance intention in an Agritech / SSA context.',
    correct: true,
    explanation: 'RQ v3: relationship between task technology fit and continuance intention to use Agritech IS in Sub-Saharan Africa.',
    source: 'Research questions',
    focus: 'ci',
  },
  {
    id: 'primary-field-is',
    statement: 'Information Systems is one of your primary disciplinary homes for this PhD.',
    correct: true,
    explanation: 'Your fields data marks IS as primary — home for TAM, ECM, TPC, and continuance intention theories.',
    source: 'Fields',
    focus: 'ci',
  },
];
