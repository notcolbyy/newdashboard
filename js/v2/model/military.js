import { createCompensationRecord } from './compensation.js';
import { serviceSnapshot } from './service.js';

function projected(value, fromYear, year, rate) { return Math.round(value * (1 + rate) ** (year - fromYear)); }

export function lookupMilitaryBasePay({ year, grade, creditableServiceYears, officialTable, annualProjectionRate = .03 }) {
  const sourceYear = officialTable.year;
  const values = officialTable.monthlyBasePayCents[grade];
  if (!values) throw new TypeError(`Unsupported pay grade: ${grade}`);
  let index = 0;
  officialTable.serviceYearBreakpoints.forEach((point, i) => { if (creditableServiceYears >= point) index = i; });
  const officialCents = values[index];
  const monthlyCents = year === sourceYear ? officialCents : projected(officialCents, sourceYear, year, annualProjectionRate);
  return { monthlyCents, annualCents: monthlyCents * 12, state: year === sourceYear ? 'official' : 'projected', provenanceIds: year === sourceYear ? [officialTable.provenanceId] : [officialTable.provenanceId, 'planning.militaryPayGrowth'] };
}

export function lookupOfficerBas({ year, basTable, annualProjectionRate = .025 }) {
  if (basTable[year]) return { ...basTable[year], annualCents: basTable[year].monthlyCents * 12 };
  const sourceYear = Math.max(...Object.keys(basTable).map(Number).filter(y => y <= year));
  if (!Number.isFinite(sourceYear)) throw new TypeError(`No BAS source year for ${year}.`);
  const monthlyCents = projected(basTable[sourceYear].monthlyCents, sourceYear, year, annualProjectionRate);
  return { monthlyCents, annualCents: monthlyCents * 12, state: 'projected', provenanceId: 'planning.basGrowth' };
}

export function lookupBah({ year, locationKey, grade, withDependents, official = {}, override, fallback }) {
  if (override?.monthlyCents != null) return { monthlyCents: override.monthlyCents, state: 'userEntered', provenanceIds: override.provenanceIds ?? [] };
  const key = `${year}:${locationKey}:${grade}:${withDependents ? 'with' : 'without'}`;
  if (official[key]) return { monthlyCents: official[key].monthlyCents, state: 'official', provenanceIds: [official[key].provenanceId] };
  if (!fallback?.monthlyCents) throw new TypeError(`BAH unavailable for ${key} and no fallback supplied.`);
  const baseYear = fallback.baseYear ?? year;
  return { monthlyCents: projected(fallback.monthlyCents, baseYear, year, fallback.annualGrowth ?? .025), state: year === baseYear ? 'estimated' : 'projected', provenanceIds: fallback.provenanceIds ?? ['planning.bahFallback'] };
}

export function militaryCompensationForPeriod({ stage, year, periodFraction, serviceHistory, payTable, basTable, bahData = {} }) {
  const date = `${year}-07-01`, snapshot = serviceSnapshot(serviceHistory, date);
  const base = lookupMilitaryBasePay({ year, grade: snapshot.payGrade, creditableServiceYears: snapshot.creditableServiceYears, officialTable: payTable, annualProjectionRate: stage.compensationRule?.payGrowth ?? .03 });
  const bas = lookupOfficerBas({ year, basTable, annualProjectionRate: stage.compensationRule?.allowanceGrowth ?? .025 });
  const bah = lookupBah({ year, locationKey: stage.compensationRule?.locationKey, grade: snapshot.payGrade, withDependents: stage.compensationRule?.withDependents ?? false, official: bahData.official, override: stage.compensationRule?.bahOverride, fallback: stage.compensationRule?.bahFallback });
  const taxableCents = Math.round(base.annualCents * periodFraction), nontaxableCents = Math.round((bas.annualCents + bah.monthlyCents * 12) * periodFraction);
  return createCompensationRecord({ id: `${stage.id}:${year}`, personId: stage.personId, type: 'military', period: String(year), taxableCents, nontaxableCents, payrollWagesCents: taxableCents, retirementEligibleCents: taxableCents, provenanceIds: [...base.provenanceIds, bas.provenanceId, ...bah.provenanceIds], metadata: { role: stage.role, grade: snapshot.payGrade, serviceYears: snapshot.creditableServiceYears, basePayCents: taxableCents, basCents: Math.round(bas.annualCents * periodFraction), bahCents: Math.round(bah.monthlyCents * 12 * periodFraction), bahState: bah.state, payState: base.state } });
}

