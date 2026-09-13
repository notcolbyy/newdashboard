import {createPlanningTemplate,materializePlanningDates} from './planning-template.js';
import {configureAccountBalance,configureMilitaryBahFallback} from '../ui/model-editor-actions.js';

import {parseMoneyInput,markUserEntered} from '../ui/editor-state.js';

export function createLifePlan(){
  const m=createPlanningTemplate(),meta=m.extensions.production.template;
  meta.name='Life Plan';meta.createdFrom='life-plan-v2.1.2';meta.horizonAge=95;
  m.people[1].enabled=false;
  m.accounts.find(a=>a.id==='retirement-investments').name='Retirement investments / planned TSP';
  m.retirementPolicies={'planning-jag':{accountId:'retirement-investments',traditionalRate:.08,rothRate:.02}};
  m.policies.taxableInvestmentAnnualCents=600000;
  m.spendingSchedules=[['housing',180000,'essential'],['utilities',30000,'essential'],['food',60000,'essential'],['transportation',40000,'essential'],['insurance',35000,'essential'],['travel',25000,'discretionary'],['lifestyle',50000,'discretionary'],['education',25000,'essential'],['other',10000,'essential']].map(([category,monthly,classification])=>({id:'spending-'+category,ownerId:'household',category,classification,amountCents:monthly*12,valueBasis:'real',baseYear:2025,startYear:2026,endYear:2200,classificationOrigin:'planningDefault',provenanceIds:['planning.template']}));
  meta.spendingNote='Editable comfortable-life budget: $4,550/month in 2025 dollars; education costs are a provisional $250/month, not a tuition quote. Review school funding and debt separately.';
  meta.propertyStrategy={role:'singleFamilyPrimary',buyWhenFeasible:true,pcsDecision:'evaluateKeepOrSell',requirePositiveRentalCashFlow:true,propertyReserveMonths:6,automaticPurchaseSchedule:false};
  meta.retirementNote='Military transition follows 24 planned service years. Automatic service-based pension benefits and retirement withdrawals are not implemented; no pension amount is included.';
  const goal=m.goals[0];goal.ownerIds=['reference'];goal.home.ownership=[{ownerId:'reference',share:1}];goal.home.propertyTaxRate=.018;goal.home.insuranceRate=.005;goal.home.initialHomeReserveCents=2000000;goal.home.moveSetupCostsCents=2000000;
  meta.homeCostNote='Editable planning defaults: 6% financing, 1.8% property tax, 0.5% insurance, 1% maintenance, 20% down, 2% closing, $20,000 setup and $20,000 home reserve. These are not property quotes.';
  meta.startingDebtChoice='unresolved';
  m.extensions.production.optionalIntents.expectedPropertyTransfer.basis='nominalAtTransfer';
  return m;
}
export function applyLifePlanInput(m,key,value){
  const meta=m.extensions.production.template;
  if(key==='birthYear'){
    const year=value===''?null:Number(value);if(year!==null&&(!Number.isInteger(year)||year<1900||year>new Date().getFullYear()))throw new TypeError('Enter a valid birth year.');
    m.people[0].birthDate=null;m.people[0].birthYear=year;m.people[0].inputState=year?'entered':'intentionallyUnset';
    m.household.simulationStartYear=year?Math.max(2026,year+18):null;m.household.simulationEndYear=year?year+95:null;
    for(const c of m.careers){c.startDate=null;c.endDate=null;}m.serviceHistories=[];
  }else if(key==='filingStatus')m.household.filingStatus=value||null;
  else if(key==='bah'){const career=m.careers.find(c=>c.id==='planning-jag');if(value==='')delete career.compensationRule.bahFallback;else {career.compensationRule.bahFallback??={baseYear:2026};configureMilitaryBahFallback(m,'planning-jag',parseMoneyInput(value));}}
  else if(key==='partner'){
    m.people[1].enabled=value==='yes';m.people[1].ageOffsetFromReference=value==='yes'?0:null;
    if(value==='yes'&&!m.accounts.some(a=>a.id==='partner-retirement'))m.accounts.push({id:'partner-retirement',name:'Partner workplace retirement',ownerId:'partner',type:'retirementInvestment',openingBalanceCents:null,annualReturn:.06,protected:true});
    if(value!=='yes'){m.accounts=m.accounts.filter(a=>a.id!=='partner-retirement');delete m.retirementPolicies['planning-pediatrician'];}
    else m.retirementPolicies['planning-pediatrician']={accountId:'partner-retirement',employeeRate:.1,employerMatchRate:.04,taxTreatment:'traditional'};
    const owners=value==='yes'?[{ownerId:'reference',share:.5},{ownerId:'partner',share:.5}]:[{ownerId:'reference',share:1}];m.goals[0].ownerIds=owners.map(o=>o.ownerId);m.goals[0].home.ownership=owners;
  }else if(key.startsWith('balance:')){const cents=parseMoneyInput(value);if(cents!==null&&cents<0)throw new TypeError('Enter a nonnegative balance; record debts separately.');configureAccountBalance(m,key.slice(8),cents);}
  else if(key==='zeroBalances')for(const a of m.accounts)if(a.openingBalanceCents===null)configureAccountBalance(m,a.id,0);
  else if(key==='debtChoice')meta.startingDebtChoice=value;
  if(!['zeroBalances'].includes(key))markUserEntered(m,{id:'lifePlan.'+key,path:key,value,unit:'setup input'});
  materializePlanningDates(m);
  const refYear=m.people[0].birthYear??(m.people[0].birthDate?Number(m.people[0].birthDate.slice(0,4)):null);
  m.plannedEvents=m.plannedEvents.filter(e=>e.id!=='life-combination');
  if(m.people[1].enabled&&Number.isInteger(refYear))m.plannedEvents.push({id:'life-combination',type:'household.combine',date:`${refYear+29}-07-01`,target:'household',title:'Planned household combination',provenanceIds:['planning.template']});
  if(Number.isInteger(refYear))for(const schedule of m.spendingSchedules){schedule.startYear=m.household.simulationStartYear;schedule.endYear=m.household.simulationEndYear;}
}
