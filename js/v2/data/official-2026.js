import { createProvenanceRegistry } from './provenance.js';

export const PROVENANCE = createProvenanceRegistry([
  {id:'irs.tax.2026',classification:'official',source:{title:'IRS 2026 tax inflation adjustments',url:'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill'},sourceType:'IRS',effectiveDate:'2026-01-01',retrievedDate:'2026-09-01',confidence:'high',editable:false,yearKeyed:true,locationKeyed:false},
  {id:'ssa.oasdi.2026',classification:'official',source:{title:'SSA Contribution and Benefit Base',url:'https://www.ssa.gov/oact/cola/cbb.html'},sourceType:'SSA',effectiveDate:'2026-01-01',retrievedDate:'2026-09-01',confidence:'high',editable:false,yearKeyed:true,locationKeyed:false},
  {id:'dod.brs.rules.2026',classification:'official',source:{title:'DoD Blended Retirement System',url:'https://militarypay.defense.gov/pay/retirement/'},sourceType:'DepartmentOfDefense',effectiveDate:'2018-01-01',retrievedDate:'2026-09-01',confidence:'high',editable:false,yearKeyed:false,locationKeyed:false},
  {id:'tsp.brs.match.2017u3',classification:'official',source:{title:'TSP Bulletin 17-U-3',url:'https://www.tsp.gov/bulletins/17-u-3/'},sourceType:'TSP',effectiveDate:'2018-01-01',retrievedDate:'2026-09-01',confidence:'high',editable:false,yearKeyed:false,locationKeyed:false},
  {id:'bls.cpiu.2025base',classification:'official',source:{title:'BLS CPI-U',url:'https://www.bls.gov/cpi/'},sourceType:'BLS',effectiveDate:'2025-12-31',retrievedDate:'2026-09-01',confidence:'high',editable:false,yearKeyed:true,locationKeyed:false},
  {id:'model.futureInflation.baseline',classification:'projected',source:{title:'V2.0 Research Dossier planning baseline',url:'https://www.bls.gov/cpi/'},sourceType:'ConfigurablePlanningDefault',effectiveDate:'2026-01-01',retrievedDate:'2026-09-01',confidence:'medium',editable:true,yearKeyed:false,locationKeyed:false}
  ,{id:'dfas.officerPay.2026',classification:'official',source:{title:'DFAS 2026 Basic Pay – Officers',url:'https://www.dfas.mil/militarymembers/payentitlements/Pay-Tables/Basic-Pay/CO/'},sourceType:'DFAS',effectiveDate:'2026-01-01',retrievedDate:'2026-09-02',confidence:'high',editable:false,yearKeyed:true,locationKeyed:false}
  ,{id:'dfas.bas.2026',classification:'official',source:{title:'DFAS Basic Allowance for Subsistence',url:'https://www.dfas.mil/militarymembers/payentitlements/Pay-Tables/bas/'},sourceType:'DFAS',effectiveDate:'2026-01-01',retrievedDate:'2026-09-02',confidence:'high',editable:false,yearKeyed:true,locationKeyed:false}
  ,{id:'planning.bahFallback',classification:'estimated',source:{title:'User-editable BAH planning fallback',url:'model://planning/bah-fallback'},sourceType:'ConfigurablePlanningDefault',effectiveDate:'2026-01-01',retrievedDate:'2026-09-02',confidence:'low',editable:true,yearKeyed:false,locationKeyed:true}
  ,{id:'planning.pediatrics.2026',classification:'estimated',source:{title:'Editable pediatric compensation planning baseline',url:'model://planning/pediatrics'},sourceType:'ConfigurablePlanningDefault',effectiveDate:'2026-01-01',retrievedDate:'2026-09-02',confidence:'medium',editable:true,yearKeyed:true,locationKeyed:true}
  ,{id:'planning.militaryPayGrowth',classification:'projected',source:{title:'Editable military compensation growth assumption',url:'model://planning/military-pay-growth'},sourceType:'ConfigurablePlanningDefault',effectiveDate:'2027-01-01',retrievedDate:'2026-09-02',confidence:'low',editable:true,yearKeyed:true,locationKeyed:false}
  ,{id:'planning.basGrowth',classification:'projected',source:{title:'Editable BAS growth assumption',url:'model://planning/bas-growth'},sourceType:'ConfigurablePlanningDefault',effectiveDate:'2027-01-01',retrievedDate:'2026-09-02',confidence:'low',editable:true,yearKeyed:true,locationKeyed:false}
]);

export function projectFederalTaxTable(base,year,annualInflation=.025){
  if(year===base.year)return base;const factor=(1+annualInflation)**(year-base.year),scale=n=>Math.round(n*factor);
  return {...base,year,provenanceId:`${base.provenanceId}:projected:${year}`,state:'projected',standardDeduction:Object.fromEntries(Object.entries(base.standardDeduction).map(([k,v])=>[k,scale(v)])),brackets:Object.fromEntries(Object.entries(base.brackets).map(([k,rows])=>[k,rows.map(([lo,hi,rate])=>[scale(lo),hi===null?null:scale(hi),rate])])),payroll:{...base.payroll,socialSecurityWageBase:scale(base.payroll.socialSecurityWageBase),provenanceId:`${base.payroll.provenanceId}:projected:${year}`}};
}

const marriedJoint = [[0,24800,.10],[24800,100800,.12],[100800,211400,.22],[211400,403550,.24],[403550,512450,.32],[512450,768700,.35],[768700,null,.37]];
const single = [[0,12400,.10],[12400,50400,.12],[50400,105700,.22],[105700,201775,.24],[201775,256225,.32],[256225,640600,.35],[640600,null,.37]];
const head = [[0,17700,.10],[17700,67450,.12],[67450,105700,.22],[105700,201750,.24],[201750,256200,.32],[256200,640600,.35],[640600,null,.37]];

export const FEDERAL_TAX_2026 = Object.freeze({
  year: 2026,
  provenanceId: 'irs.tax.2026',
  standardDeduction: {single:16100, marriedFilingSeparately:16100, marriedFilingJointly:32200, headOfHousehold:24150},
  brackets: {single, marriedFilingSeparately:single, marriedFilingJointly:marriedJoint, headOfHousehold:head},
  payroll: {socialSecurityRate:.062, socialSecurityWageBase:184500, medicareRate:.0145, additionalMedicareRate:.009, additionalMedicareThreshold:{single:200000,marriedFilingSeparately:125000,marriedFilingJointly:250000,headOfHousehold:200000},provenanceId:'ssa.oasdi.2026'}
});

export const BRS_RULES = Object.freeze({
  automaticContributionRate:.01,
  automaticStartAfterServiceDays:60,
  automaticVestingServiceDays:730,
  matchingStartAfterServiceDays:731,
  matchingEndServiceYears:26,
  matchTiers:[[.01,1],[.02,1],[.03,1],[.04,.5],[.05,.5]],
  provenanceIds:['dod.brs.rules.2026','tsp.brs.match.2017u3']
});

// 2025 is normalized to 100. Earlier values are illustrative official-index ratios
// used by the kernel fixture; production ingestion will carry the complete BLS series.
export const PRICE_INDEX = Object.freeze({
  baseYear:2025,
  known:{2023:{value:94.47,state:'official',provenanceId:'bls.cpiu.2025base'},2024:{value:97.25,state:'official',provenanceId:'bls.cpiu.2025base'},2025:{value:100,state:'official',provenanceId:'bls.cpiu.2025base'}},
  futureAnnualInflation:.025,
  futureProvenanceId:'model.futureInflation.baseline'
});
