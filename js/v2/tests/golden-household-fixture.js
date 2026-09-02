import { createModelDocument } from '../storage/schema.js';
import { dollarsToCents } from '../model/money.js';
import { FEDERAL_TAX_2026, PRICE_INDEX, BRS_RULES, projectFederalTaxTable } from '../data/official-2026.js';
import { MILITARY_PAY_2026, OFFICER_BAS } from '../data/military-2026.js';
import { PEDIATRIC_COMPENSATION_BASELINE } from '../data/physician-baselines.js';

const d=dollarsToCents;
export function goldenHouseholdFixture(){
  const model=createModelDocument({
    household:{simulationStartYear:2026,simulationEndYear:2038,filingStatus:'single'},
    people:[{id:'jag',isReference:true,birthDate:'2004-04-15'},{id:'physician',ageOffsetFromReference:-1}],
    accounts:[
      {id:'cash',ownerId:'household',type:'generalCash',openingBalanceCents:d(100000),annualReturn:.01,liquidity:'liquid'},
      {id:'reserve',ownerId:'household',type:'emergencyReserve',openingBalanceCents:d(5000),annualReturn:.02,liquidity:'liquid',protected:true},
      {id:'taxable',ownerId:'household',type:'taxableInvestment',openingBalanceCents:0,annualReturn:.06,liquidity:'liquid'},
      {id:'tsp',ownerId:'jag',type:'retirementInvestment',openingBalanceCents:0,annualReturn:.06,liquidity:'restricted',protected:true},
      {id:'physician401k',ownerId:'physician',type:'retirementInvestment',openingBalanceCents:0,annualReturn:.06,liquidity:'restricted',protected:true}
    ],
    liabilities:[{id:'education-loan',ownerId:'jag',type:'educationDebt',originalPrincipalCents:d(120000),openingBalanceCents:d(120000),annualRate:.055,scheduledPayments:Array.from({length:13},(_,i)=>({year:2026+i,amountCents:d(i<3?3000:12000)}))}],
    careers:[
      {id:'law-school-work',personId:'jag',careerType:'genericEmployment',role:'Education / part-time work',startDate:'2026-01-01',endDate:'2029-06-30',compensationRule:{annualCents:d(32000),baseYear:2026,annualGrowth:.02}},
      {id:'jag-career',personId:'jag',careerType:'military',role:'Air Force JAG',startDate:'2029-07-01',endDate:'2039-01-01',compensationRule:{locationKey:'UNSET',withDependents:false,bahFallback:{monthlyCents:d(2100),baseYear:2026,annualGrowth:.025,provenanceIds:['planning.bahFallback']},payGrowth:.03,allowanceGrowth:.025}},
      {id:'pgy1',personId:'physician',careerType:'physicianResidency',role:'PGY1',startDate:'2028-07-01',endDate:'2029-06-30'},
      {id:'pgy2',personId:'physician',careerType:'physicianResidency',role:'PGY2',startDate:'2029-07-01',endDate:'2030-06-30'},
      {id:'pgy3',personId:'physician',careerType:'physicianResidency',role:'PGY3',startDate:'2030-07-01',endDate:'2031-06-30'},
      {id:'attending',personId:'physician',careerType:'physicianAttending',role:'Attending pediatrician',startDate:'2031-07-01',endDate:'2039-01-01',compensationRule:{case:'baseline',baseYear:2031,annualGrowth:.025}}
    ],
    serviceHistories:[{id:'air-force',personId:'jag',periods:[{startDate:'2029-07-01'}],payGradeHistory:[{effectiveDate:'2029-07-01',grade:'O-2',expected:true},{effectiveDate:'2030-01-01',grade:'O-3',expected:true}],metadata:{initialServiceCommitmentYears:4}}],
    retirementPolicies:{'jag-career':{accountId:'tsp',traditionalRate:.05,rothRate:0},pgy1:{accountId:'physician401k',employeeRate:.04,employerMatchRate:.02,taxTreatment:'traditional'},pgy2:{accountId:'physician401k',employeeRate:.04,employerMatchRate:.02,taxTreatment:'traditional'},pgy3:{accountId:'physician401k',employeeRate:.04,employerMatchRate:.02,taxTreatment:'traditional'},attending:{accountId:'physician401k',employeeRate:.08,employerMatchRate:.04,taxTreatment:'traditional'}},
    spendingSchedules:[
      {id:'housing',ownerId:'jag',category:'housing',classification:'essential',amountCents:d(18000),valueBasis:'real',baseYear:2025,startYear:2026,endYear:2038},
      {id:'utilities',ownerId:'jag',category:'utilities',classification:'essential',amountCents:d(3600),valueBasis:'real',baseYear:2025,startYear:2026,endYear:2038},
      {id:'food',ownerId:'physician',category:'food',classification:'essential',amountCents:d(7200),valueBasis:'real',baseYear:2025,startYear:2026,endYear:2038},
      {id:'transport',ownerId:'jag',category:'transportation',classification:'essential',amountCents:d(6000),valueBasis:'real',baseYear:2025,startYear:2026,endYear:2038},
      {id:'insurance',ownerId:'physician',category:'insurance',classification:'essential',amountCents:d(4800),valueBasis:'real',baseYear:2025,startYear:2026,endYear:2038},
      {id:'travel',ownerId:'household',category:'travel',classification:'discretionary',amountCents:d(4000),valueBasis:'real',baseYear:2025,startYear:2026,endYear:2038},
      {id:'lifestyle',ownerId:'household',category:'lifestyle',classification:'discretionary',amountCents:d(5000),valueBasis:'real',baseYear:2025,startYear:2026,endYear:2038},
      {id:'move',ownerId:'household',category:'other',classification:'essential',amountCents:d(8000),valueBasis:'real',baseYear:2025,startYear:2029,endYear:2029,oneTime:true}
    ],
    spendingAdjustments:[{id:'combined-housing',category:'housing',operation:'increase',amountCents:d(6000),startYear:2033,endYear:2038},{id:'attending-travel',category:'travel',operation:'increase',amountCents:d(6000),startYear:2032,endYear:2038}],
    plannedEvents:[{id:'combine',type:'household.combine',date:'2033-01-01',target:'household'},{id:'marry-file-joint',type:'tax.filingStatus.change',date:'2034-01-01',target:'household',filingStatus:'marriedFilingJointly'}],
    policies:{reserveMonths:6,taxableInvestmentAnnualCents:d(15000),allocationPolicyId:'stabilityFirst'}
  });
  const taxTables={};for(let y=2026;y<=2038;y++)taxTables[y]=projectFederalTaxTable(FEDERAL_TAX_2026,y,.025);
  const data={militaryPay:MILITARY_PAY_2026,officerBas:OFFICER_BAS,bah:{official:{}},physician:PEDIATRIC_COMPENSATION_BASELINE,brsRules:BRS_RULES,priceIndex:PRICE_INDEX};
  return {model,data,taxTables};
}
