import { createCompensationRecord } from './compensation.js';

export function physicianCompensationForPeriod({ stage, year, periodFraction, baseline }) {
  const rule = stage.compensationRule ?? {};
  let annualCents;
  if (stage.careerType === 'physicianResidency') annualCents = rule.annualCents ?? baseline.residencyAnnualCents[stage.role];
  else annualCents = rule.annualCents ?? baseline.attendingCasesCents[rule.case ?? 'baseline'];
  if (!Number.isSafeInteger(annualCents)) throw new TypeError(`Missing physician compensation for ${stage.id}.`);
  const baseYear = rule.baseYear ?? baseline.baseYear;
  const growth = rule.annualGrowth ?? baseline.annualGrowth;
  const projectedAnnual = Math.round(annualCents * (1 + growth) ** Math.max(0, year - baseYear));
  const taxableCents = Math.round(projectedAnnual * (rule.regionalAdjustment ?? 1) * periodFraction);
  return createCompensationRecord({ id: `${stage.id}:${year}`, personId: stage.personId, type: 'physician', period: String(year), taxableCents, payrollWagesCents: taxableCents, retirementEligibleCents: taxableCents, provenanceIds: stage.provenanceIds ?? [baseline.provenanceId], metadata: { role: stage.role, projected: year !== baseYear, periodFraction } });
}

