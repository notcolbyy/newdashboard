import { daysBetween, serviceYearsOnDate } from './calendar.js';

function annualEligibilityFraction(serviceStartDate,year,startAfterDays){
  const yearStart=new Date(Date.UTC(year,0,1)),yearEnd=new Date(Date.UTC(year+1,0,1)),serviceStart=new Date(`${serviceStartDate}T00:00:00Z`),eligibleStart=new Date(serviceStart.getTime()+startAfterDays*86400000),activeStart=new Date(Math.max(yearStart,serviceStart)),eligibleActiveStart=new Date(Math.max(activeStart,eligibleStart)),activeDays=Math.max(0,(yearEnd-activeStart)/86400000),eligibleDays=Math.max(0,(yearEnd-eligibleActiveStart)/86400000);return activeDays?Math.min(1,eligibleDays/activeDays):0;
}

export function retirementContributionsForYear({ records, stages, year, serviceHistories, policies, brsRules }) {
  const entries=[];
  for(const record of records){
    const stage=stages.find(s=>record.id.startsWith(`${s.id}:`)), policy=policies?.[stage?.id]; if(!policy)continue;
    if(stage.careerType==='military'){
      const history=serviceHistories.find(h=>h.personId===record.personId), traditionalRate=policy.traditionalRate??0, rothRate=policy.rothRate??0, memberRate=traditionalRate+rothRate;
      const serviceStartDate=history.periods[0].startDate,automaticFraction=annualEligibilityFraction(serviceStartDate,year,brsRules.automaticStartAfterServiceDays),matchingFraction=serviceYearsOnDate(serviceStartDate,`${year}-12-31`)<=brsRules.matchingEndServiceYears?annualEligibilityFraction(serviceStartDate,year,brsRules.matchingStartAfterServiceDays):0,matchRate=Math.min(memberRate,.03)+Math.max(0,Math.min(memberRate-.03,.02))*.5;
      entries.push({personId:record.personId,accountId:policy.accountId,traditionalCents:Math.round(record.retirementEligibleCents*traditionalRate),rothCents:Math.round(record.retirementEligibleCents*rothRate),employerAutomaticCents:Math.round(record.retirementEligibleCents*brsRules.automaticContributionRate*automaticFraction),employerMatchCents:Math.round(record.retirementEligibleCents*matchRate*matchingFraction),vested:daysBetween(serviceStartDate,`${year}-12-31`)>=brsRules.automaticVestingServiceDays,provenanceIds:brsRules.provenanceIds,metadata:{automaticEligibilityFraction:automaticFraction,matchingEligibilityFraction:matchingFraction}});
    } else {
      const employeeRate=policy.employeeRate??0, employerRate=Math.min(employeeRate,policy.employerMatchRate??0);
      entries.push({personId:record.personId,accountId:policy.accountId,traditionalCents:policy.taxTreatment==='traditional'?Math.round(record.retirementEligibleCents*employeeRate):0,rothCents:policy.taxTreatment==='roth'?Math.round(record.retirementEligibleCents*employeeRate):0,employerAutomaticCents:0,employerMatchCents:Math.round(record.retirementEligibleCents*employerRate),vested:true,provenanceIds:policy.provenanceIds??[]});
    }
  }
  return entries;
}
