import { stageFraction } from '../model/careers.js';
import { MILITARY_PAY_2026 } from '../data/military-2026.js';

// Enforce the inputs consumed by the existing military compensation path.
// No simulation, invented service, or allowance estimate is performed here.
export function militaryReadinessIssues(model,{data}={}){
  const issues=[],people=new Set((model.people??[]).filter(p=>p.enabled!==false).map(p=>p.id));
  const start=model.household?.simulationStartYear,end=model.household?.simulationEndYear;
  const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'));
  for(const career of (model.careers??[]).filter(c=>c.careerType==='military'&&people.has(c.personId))){
    const add=(code,field,message)=>issues.push({code,path:`careers.${career.id}.${field}`,entityId:career.id,setupSection:'careers',message});
    const timed=validDate(career.startDate)||Number.isInteger(career.startYear);
    if(!timed){add('MILITARY_CAREER_TIMING_REQUIRED','startDate','Enter the military career start date.');continue;}
    const years=[];
    if(Number.isInteger(start)&&Number.isInteger(end))for(let year=start;year<=end;year++)if(stageFraction(career,year)>0)years.push(year);
    if(Number.isInteger(start)&&Number.isInteger(end)&&!years.length)continue;
    const history=(model.serviceHistories??[]).find(h=>h.personId===career.personId);
    if(!history?.periods?.length||history.periods.some(p=>!validDate(p.startDate)||(p.endDate!=null&&!validDate(p.endDate))))add('MILITARY_SERVICE_TIMELINE_REQUIRED','serviceHistory','Complete the military service timeline required for this career.');
    const grades=history?.payGradeHistory??[],payTable=data?.militaryPay??MILITARY_PAY_2026;
    const gradeAt=year=>grades.filter(g=>validDate(g.effectiveDate)&&g.effectiveDate<=`${year}-07-01`).sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)).at(-1)?.grade;
    if(!grades.length||years.some(year=>!payTable.monthlyBasePayCents?.[gradeAt(year)]))add('MILITARY_PAY_GRADE_REQUIRED','serviceHistory.payGradeHistory','Complete the supported military pay-grade timeline for the projection period.');
    const rule=career.compensationRule??{},override=rule.bahOverride?.monthlyCents,fallback=rule.bahFallback?.monthlyCents;
    const explicit=Number.isSafeInteger(override)&&override>=0;
    const planned=Number.isSafeInteger(fallback)&&fallback>0;
    const official=years.length>0&&years.every(year=>{const key=`${year}:${rule.locationKey}:${gradeAt(year)}:${rule.withDependents?'with':'without'}`,amount=data?.bah?.official?.[key]?.monthlyCents;return Number.isSafeInteger(amount)&&amount>=0;});
    if(!explicit&&!planned&&!official)add('MILITARY_HOUSING_ALLOWANCE_REQUIRED','compensationRule.bahFallback.monthlyCents','Enter a planning housing allowance or provide the inputs needed to resolve BAH for every projected military year.');
  }
  return issues;
}
