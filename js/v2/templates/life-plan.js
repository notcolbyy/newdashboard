import {createPlanningTemplate,materializePlanningDates} from './planning-template.js';
import {configureAccountBalance,configureMilitaryBahFallback} from '../ui/model-editor-actions.js';

import {parseMoneyInput,markUserEntered} from '../ui/editor-state.js';

export function createLifePlan(){
  const m=createPlanningTemplate(),meta=m.extensions.production.template;
  meta.name='Life Plan';meta.createdFrom='life-plan-v2.1.3';meta.horizonAge=95;meta.currentYear=2026;meta.currentChapter='Current high-school junior → UT Knoxville → law school → Air Force JAG';
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

const planningRecord=(id,title,value,unit,notes)=>({id,classification:'planningDefault',value,unit,source:{title,url:`model://planning/${id}`},sourceType:'ConfigurablePlanningDefault',effectiveDate:'2026-01-01',retrievedDate:null,confidence:'medium',editable:true,yearKeyed:false,locationKeyed:false,notes});

export function prepareLifePlanForExploration(m){
  const meta=m.extensions.production.template,reference=m.people.find(person=>person.isReference);
  if(reference?.birthYear==null&&reference?.birthDate==null)throw new TypeError('Enter your birth year to build the timeline.');
  meta.createdFrom='life-plan-v2.1.4';
  meta.exploration={
    active:true,
    currentFinancesStatus:'notAdded',
    debtStatus:'notAdded',
    assumptionsReviewRequired:true,
    note:'Exploratory results use editable planning assumptions until personal values are added.'
  };
  m.household.filingStatus='single';
  m.people[1].enabled=true;m.people[1].ageOffsetFromReference=0;m.people[1].inputState='planningAssumption';
  if(!m.accounts.some(account=>account.id==='partner-retirement'))m.accounts.push({id:'partner-retirement',name:'Partner workplace retirement',ownerId:'partner',type:'retirementInvestment',openingBalanceCents:0,inputState:'planningAssumption',classification:'planningDefault',annualReturn:.06,protected:true,provenanceIds:['planning.lifePlanOpeningBalances']});
  m.retirementPolicies['planning-pediatrician']={accountId:'partner-retirement',employeeRate:.1,employerMatchRate:.04,taxTreatment:'traditional'};
  for(const account of m.accounts){account.openingBalanceCents=0;account.inputState='planningAssumption';account.classification='planningDefault';account.provenanceIds=['planning.lifePlanOpeningBalances'];}
  const career=m.careers.find(row=>row.id==='planning-jag');
  career.compensationRule.bahFallback={monthlyCents:240000,baseYear:2026,annualGrowth:m.assumptions.futureInflationRate??.025,provenanceIds:['planning.lifePlanBah']};
  if(!career.provenanceIds.includes('planning.lifePlanBah'))career.provenanceIds.push('planning.lifePlanBah');
  m.provenance['planning.lifePlanFiling']=planningRecord('planning.lifePlanFiling','Life Plan initial filing-status assumption','single','filing status','Used only as a starting planning assumption; update when the applicable tax status is known.');
  m.provenance['planning.lifePlanOpeningBalances']=planningRecord('planning.lifePlanOpeningBalances','Life Plan opening-balance placeholder',0,'cents','Current balances have not been added. Zero is used only to make the exploratory projection numerically complete and is not a user confirmation.');
  m.provenance['planning.lifePlanBah']=planningRecord('planning.lifePlanBah','Life Plan military housing-allowance estimate',240000,'monthly cents','Editable generic planning estimate, not a duty-station quote or official BAH determination.');
  m.provenance['planning.lifePlanPartner']=planningRecord('planning.lifePlanPartner','Life Plan partner-path assumption',true,'boolean','Includes the same-age pediatrics path for exploration; it is editable and not a personal identity assertion.');
  m.provenance['planning.lifePlanDutyHome']=planningRecord('planning.lifePlanDutyHome','Life Plan duty-home illustration',42000000,'2025-dollar cents','Editable generic primary-home intent used to demonstrate feasibility and a later PCS keep-or-sell decision; not a property quote or recurring purchase rule.');
  const owners=[{ownerId:'reference',share:.5},{ownerId:'partner',share:.5}];m.goals[0].ownerIds=owners.map(owner=>owner.ownerId);m.goals[0].home.ownership=owners;
  materializePlanningDates(m);
  const refYear=reference.birthYear??Number(reference.birthDate.slice(0,4));
  m.plannedEvents=m.plannedEvents.filter(event=>event.id!=='life-combination');
  m.plannedEvents.push({id:'life-combination',type:'household.combine',date:`${refYear+29}-07-01`,target:'household',title:'Planned household combination',provenanceIds:['planning.template','planning.lifePlanPartner']});
  const desiredYear=refYear+29;m.propertyIntents=[{id:'life-plan-duty-home-intent',propertyId:'life-plan-duty-home',name:'Planning duty-station home',desiredYear,earliestAcceptableYear:desiredYear,latestAcceptableYear:desiredYear+5,enabled:true,propertyRole:'primaryResidence',locationKey:'UNSET',ownership:owners,expectedPriceCents:42000000,downPaymentCents:8400000,financedAmountCents:33600000,buyerClosingCostsCents:840000,initialSetupCostsCents:300000,initialPropertyReserveCents:1800000,propertyReserveMonths:6,mortgageId:'life-plan-duty-home-mortgage',mortgageRate:.06,mortgageTermMonths:360,estimatedAnnualDebtServiceCents:2400000,minimumPostPurchaseFreeCashFlowCents:0,fundingPolicy:{sources:['generalCash'],allowTaxableInvestments:false},operations:{baseYear:desiredYear,monthlyRentCents:300000,rentGrowthRate:.025,vacancyRate:.05,propertyTaxCents:600000,insuranceCents:210000,hoaCents:0,maintenanceRate:.01,capexRate:.005,managementRate:.08,primaryMaintenanceCents:350000},provenanceIds:['planning.lifePlanDutyHome']}];
  m.plannedEvents.push({id:'life-plan-pcs-decision',type:'property.convertToRentalIntent',propertyId:'life-plan-duty-home',date:`${refYear+35}-07-01`,title:'Planned PCS keep-or-sell review',preferenceSensitive:true,provenanceIds:['planning.lifePlanDutyHome']});
  m.goals[0].fundingPolicy.permittedPropertySaleIds=['life-plan-duty-home'];
  return m;
}
export function refreshLifePlanFinanceStatus(m){const exploration=m.extensions?.production?.template?.exploration;if(exploration)exploration.currentFinancesStatus=m.accounts.every(account=>account.inputState==='entered')?'added':m.accounts.some(account=>account.inputState==='entered')?'partiallyAdded':'notAdded';return exploration?.currentFinancesStatus??null;}
export function applyLifePlanInput(m,key,value){
  const meta=m.extensions.production.template;
  if(key==='birthYear'){
    const year=value===''?null:Number(value);if(year!==null&&(!Number.isInteger(year)||year<1900||year>new Date().getFullYear()))throw new TypeError('Enter a valid birth year.');
    m.people[0].birthDate=null;m.people[0].birthYear=year;m.people[0].inputState=year?'entered':'intentionallyUnset';
    m.household.simulationStartYear=year?(meta.currentYear??2026):null;m.household.simulationEndYear=year?year+95:null;
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
