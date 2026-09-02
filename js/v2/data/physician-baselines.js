import { dollarsToCents } from '../model/money.js';

// Editable planning defaults, not promises or universal compensation figures.
export const PEDIATRIC_COMPENSATION_BASELINE = Object.freeze({
  baseYear: 2026,
  provenanceId: 'planning.pediatrics.2026',
  residencyAnnualCents: {
    PGY1: dollarsToCents(68000),
    PGY2: dollarsToCents(71000),
    PGY3: dollarsToCents(74000)
  },
  attendingCasesCents: {
    lower: dollarsToCents(190000),
    baseline: dollarsToCents(230000),
    higher: dollarsToCents(280000)
  },
  annualGrowth: .025
});

