export const methodologyNuances = [
  {
    lookFor: 'How the construct is defined',
    example:
      'Climate vulnerability refers to exposure, sensitivity and adaptive capacity to climate-change impacts.',
    whyItMatters: 'Shows whether the dataset actually matches the concept.',
  },
  {
    lookFor: 'What the indices contain',
    example:
      'ND-GAIN vulnerability covers food, water, health, ecosystem services, human habitat and infrastructure. ND-GAIN readiness/resilience covers economic, governance and social readiness.',
    whyItMatters: 'Composite indices must be unpacked before use.',
  },
  {
    lookFor: 'Whether the variable was adjusted',
    example:
      'They use a GDP-adjusted vulnerability index because vulnerability is correlated with GDP per capita.',
    whyItMatters: 'The variable in the analysis may not be the raw dataset variable.',
  },
] as const;
