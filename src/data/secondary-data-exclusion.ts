export const exclusionRules = [
  {
    code: 'EX1 Passing mention',
    excludeWhen: 'Fintech, DPI or inclusion is mentioned only incidentally',
    example: 'A broad economic strategy with one sentence on digital finance.',
  },
  {
    code: 'EX2 Promotional material',
    excludeWhen: 'The text is market-facing rather than policy-facing',
    example: 'Vendor brochure for a payment switch or product page.',
  },
  {
    code: 'EX3 No clear author',
    excludeWhen: 'The document lacks institutional authorship or authority',
    example: 'Anonymous web article or unstable page.',
  },
  {
    code: 'EX4 No governance/infrastructure content',
    excludeWhen:
      'No discussion of identity, payments, interoperability, data sharing or responsibility',
    example: 'Generic innovation roundup.',
  },
  {
    code: 'EX5 Duplicate / EX6 superseded',
    excludeWhen: 'Document is duplicated or replaced without adding conceptual value',
    example: 'Keep latest edition; log older version as superseded.',
  },
] as const;
