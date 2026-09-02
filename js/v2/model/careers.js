import { createCompensationRecord } from './compensation.js';
import { militaryCompensationForPeriod } from './military.js';
import { physicianCompensationForPeriod } from './physician.js';

const YEAR_START = year => new Date(Date.UTC(year, 0, 1));
const YEAR_END = year => new Date(Date.UTC(year + 1, 0, 1));
export function stageFraction(stage, year) {
  const start = new Date(`${stage.startDate ?? `${stage.startYear}-01-01`}T00:00:00Z`), end = new Date(`${stage.endDate ?? `${(stage.endYear ?? 9999) + 1}-01-01`}T00:00:00Z`);
  const activeStart = Math.max(start.getTime(), YEAR_START(year).getTime()), activeEnd = Math.min(end.getTime(), YEAR_END(year).getTime());
  return Math.max(0, activeEnd - activeStart) / (YEAR_END(year) - YEAR_START(year));
}
export function activeCareerStages(stages, year) { return stages.filter(s => stageFraction(s, year) > 0); }
export function produceCompensationRecords({ stages, year, serviceHistories = [], data }) {
  return activeCareerStages(stages, year).map(stage => {
    const periodFraction = stageFraction(stage, year);
    if (stage.careerType === 'military') return militaryCompensationForPeriod({ stage, year, periodFraction, serviceHistory: serviceHistories.find(h => h.personId === stage.personId), payTable: data.militaryPay, basTable: data.officerBas, bahData: data.bah });
    if (stage.careerType === 'physicianResidency' || stage.careerType === 'physicianAttending') return physicianCompensationForPeriod({ stage, year, periodFraction, baseline: data.physician });
    const rule = stage.compensationRule ?? {}, annual = Math.round((rule.annualCents ?? 0) * (1 + (rule.annualGrowth ?? 0)) ** Math.max(0, year - (rule.baseYear ?? year)) * periodFraction);
    return createCompensationRecord({ id: `${stage.id}:${year}`, personId: stage.personId, type: stage.careerType === 'pension' ? 'pension' : 'employment', period: String(year), taxableCents: rule.taxable === false ? 0 : annual, nontaxableCents: rule.taxable === false ? annual : 0, payrollWagesCents: stage.careerType === 'pension' ? 0 : annual, retirementEligibleCents: stage.careerType === 'pension' ? 0 : annual, provenanceIds: stage.provenanceIds ?? [], metadata: { role: stage.role, periodFraction } });
  });
}

