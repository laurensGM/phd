export type RigourRow = {
  critical: string;
  criteria: string;
  strategies: string[];
  techniques: string[];
};

export const interviewRigour: RigourRow[] = [
  {
    critical: 'Credibility',
    criteria: 'Truth value',
    strategies: ['Field notes/memo', 'Tape recorder', 'Thematic log', 'Auditing transcript'],
    techniques: [
      'Purposeful/theoretical',
      'Negative/deviant case',
      'Constant comparison',
      'Member checking',
      'Triangulation',
      'Audit trial',
    ],
  },
  {
    critical: 'Transferability',
    criteria: 'Applicability',
    strategies: ['Data display', 'Simultaneous', 'Field notes/memo'],
    techniques: ['Purposeful/theoretical', 'Thick description'],
  },
  {
    critical: 'Dependability',
    criteria: 'Consistency',
    strategies: [
      'Tape recorder',
      'Thematic log',
      'Auditing transcript',
      "Researcher's story",
      'Reflexivity',
    ],
    techniques: ['Negative/deviant case', 'Member checking', 'Triangulation', 'Audit trial'],
  },
  {
    critical: 'Confirmability',
    criteria: 'Neutrality',
    strategies: ['Field notes/memo'],
    techniques: ['Audit trial'],
  },
];
