import { daysBetween, serviceYearsOnDate } from './calendar.js';

export function serviceSnapshot(history,date){
  const periods=history.periods??[];
  const creditableDays=periods.reduce((sum,p)=>sum+daysBetween(p.startDate,p.endDate&&p.endDate<date?p.endDate:date),0);
  const grade=[...(history.payGradeHistory??[])].filter(g=>g.effectiveDate<=date).sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)).at(-1)?.grade??null;
  return {creditableDays,creditableServiceYears:creditableDays/365.2425,payGrade:grade};
}

export function brsServiceContribution({basicPayCents,memberContributionRate,serviceStartDate,payDate,rules}){
  const days=daysBetween(serviceStartDate,payDate);
  const memberCents=Math.round(basicPayCents*memberContributionRate);
  const automaticCents=days>=rules.automaticStartAfterServiceDays?Math.round(basicPayCents*rules.automaticContributionRate):0;
  let matchRate=0;
  if(days>=rules.matchingStartAfterServiceDays&&serviceYearsOnDate(serviceStartDate,payDate)<=rules.matchingEndServiceYears){
    // 100% of the first 3% contributed, then 50% of the next 2%.
    matchRate=Math.min(memberContributionRate,.03)+Math.max(0,Math.min(memberContributionRate-.03,.02))*.5;
  }
  return {memberCents,automaticCents,matchingCents:Math.round(basicPayCents*matchRate),automaticVested:days>=rules.automaticVestingServiceDays,serviceDays:days,provenanceIds:rules.provenanceIds};
}
