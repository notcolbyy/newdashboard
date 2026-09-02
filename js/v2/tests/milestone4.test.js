import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGoalRecord,validateGoalRecord,allocateGoalFunding,goalFundingProgress,appendGoalStatus,
  buildPriceIndex,goalTargetForYear,buildHomeFundingPlan,evaluateLongTermHome,
  compareHomeStrategies,rankGoalBlockers,homeGoalToPropertyIntent,simulateHomeGoal,
  simulateGenericGoals,createModelDocument,validateModelDocument,dollarsToCents,PRICE_INDEX
} from '../index.js';
import { goldenHomeGoalFixture,goldenGenericGoalFixture } from './golden-goal-fixture.js';

const d=dollarsToCents;
const homeSetup=(year=2040)=>{const fixture=goldenHomeGoalFixture(),goal=fixture.goals[0],cfg=fixture.goalSimulation,index=buildPriceIndex(PRICE_INDEX,2042),household={generalCashCents:d(900_000),dedicatedGoalCashCents:d(200_000),taxableInvestmentsCents:d(300_000),retirementInvestmentsCents:d(1_000_000),emergencyReserveActualCents:d(100_000),emergencyReserveRequiredCents:d(100_000),retainedPropertyReserves:[{propertyId:'retained-rental',actualCents:d(30_000),requiredCents:d(25_000)}],grossCashCompensationCents:cfg.grossCashCompensationByYear[year],afterTaxIncomeCents:cfg.afterTaxIncomeByYear[year],prePurchaseFreeCashFlowCents:cfg.prePurchaseFreeCashFlowByYear[year],currentAnnualHousingCostCents:cfg.currentAnnualHousingCostByYear[year],discretionaryCapacityCents:cfg.discretionaryCapacityByYear[year],requiredDebtObligationsPayable:true,protectedRetirementViable:true,nearTermProtectedObligationsFunded:true,existingPrimaryResidenceId:null};return{fixture,goal,cfg,index,household};};

test('goal records validate identity, priority, funding policy, and target basis',()=>{
  const valid=createGoalRecord({id:'goal',name:'Goal',type:'majorPurchase',priority:'optional',target:{amountCents:d(10_000),basis:'real',baseYear:2025},fundingPolicy:{permittedSources:['generalCash']}});assert.equal(valid.status,'planned');assert.equal(validateGoalRecord(valid).valid,true);
  assert.throws(()=>createGoalRecord({id:'bad',name:'Bad',type:'majorPurchase',priority:'urgent',target:{amountCents:d(1),basis:'real',baseYear:2025},fundingPolicy:{permittedSources:['generalCash']}}),/priority/);
  assert.throws(()=>createGoalRecord({id:'bad',name:'Bad',type:'majorPurchase',priority:'optional',target:{amountCents:d(1),basis:'mystery',baseYear:2025},fundingPolicy:{permittedSources:['generalCash']}}),/basis/);
  assert.throws(()=>createGoalRecord({id:'bad',name:'Bad',type:'majorPurchase',priority:'optional',target:{amountCents:d(1),basis:'nominal',baseYear:2025},fundingPolicy:{permittedSources:['retirement']}}),/protected/);
});

test('versioned model schema validates goal priorities and protected funding',()=>{
  const valid=createModelDocument({goals:[goldenHomeGoalFixture().goals[0]]});assert.equal(valid.modelVersion,'2.0.0-m4');assert.equal(validateModelDocument(valid).valid,true);
  const bad=structuredClone(valid);bad.goals[0].priority='unknown';bad.goals[0].fundingPolicy.permittedSources.push('retirement');const result=validateModelDocument(bad);assert.equal(result.valid,false);assert.ok(result.errors.some(e=>e.code==='GOAL_PRIORITY_INVALID'));assert.ok(result.errors.some(e=>e.code==='GOAL_RETIREMENT_PROTECTED'));
});

test('priority allocator funds obligations, reserves, and protected retirement before goals',()=>{
  const result=allocateGoalFunding({availableCashCents:d(30_000),preallocations:[{id:'hard',rank:0,requiredCents:d(5_000)},{id:'reserve',rank:1,requiredCents:d(10_000)},{id:'retirement',rank:2,requiredCents:d(5_000)}],goals:[{id:'home',name:'Home',enabled:true,priority:'important',remainingCents:d(8_000)},{id:'vehicle',name:'Vehicle',enabled:true,priority:'optional',remainingCents:d(8_000)}]});
  assert.equal(result.preallocations.reduce((s,p)=>s+p.allocatedCents,0),d(20_000));assert.equal(result.allocations.find(a=>a.goalId==='home').allocatedCents,d(8_000));assert.equal(result.allocations.find(a=>a.goalId==='vehicle').allocatedCents,d(2_000));assert.ok(result.conflicts.some(c=>c.goalId==='vehicle'));
});

test('same-priority proportional allocation is exact and deterministic',()=>{
  const goals=[{id:'a',name:'A',enabled:true,priority:'important',remainingCents:d(8_000)},{id:'b',name:'B',enabled:true,priority:'important',remainingCents:d(12_000)}],result=allocateGoalFunding({availableCashCents:d(10_000),goals});assert.deepEqual(result.allocations.map(a=>[a.goalId,a.allocatedCents]),[['a',d(4_000)],['b',d(6_000)]]);
});

test('same-priority explicit ordering overrides proportional funding',()=>{
  const goals=[{id:'a',name:'A',enabled:true,priority:'important',priorityOrder:2,samePriorityPolicy:'ordered',remainingCents:d(8_000)},{id:'b',name:'B',enabled:true,priority:'important',priorityOrder:1,samePriorityPolicy:'ordered',remainingCents:d(12_000)}],result=allocateGoalFunding({availableCashCents:d(10_000),goals});assert.equal(result.allocations.find(a=>a.goalId==='b').allocatedCents,d(10_000));assert.equal(result.allocations.find(a=>a.goalId==='a').allocatedCents,0);
});

test('goal funding progress separates requirement, dedicated funding, and source composition',()=>{
  const progress=goalFundingProgress({requiredCents:d(100_000),dedicatedCents:d(30_000),permittedSources:[{sourceId:'cash',type:'generalCash',availableCents:d(20_000)},{sourceId:'fund',type:'dedicatedGoalCash',availableCents:d(30_000)}]});assert.equal(progress.permittedFundingCents,d(50_000));assert.equal(progress.remainingShortfallCents,d(50_000));assert.equal(progress.percentFunded,.5);
});

test('funding plans use only permitted sources and protect retirement and reserves',()=>{
  const sources=[{sourceId:'cash',type:'generalCash',availableCents:d(20_000)},{sourceId:'brokerage',type:'taxableInvestments',availableCents:d(50_000)},{sourceId:'sale',type:'selectedPropertySaleProceeds',availableCents:d(40_000)},{sourceId:'retirement',type:'retirement',availableCents:d(1_000_000)}];
  const allowed=buildHomeFundingPlan({requiredCents:d(90_000),sources,permittedSourceTypes:['generalCash','selectedPropertySaleProceeds','taxableInvestments']});assert.equal(allowed.totalPlannedCents,d(90_000));assert.equal(allowed.composition.find(c=>c.type==='selectedPropertySaleProceeds').amountCents,d(40_000));assert.equal(allowed.composition.find(c=>c.type==='taxableInvestments').amountCents,d(30_000));assert.equal(allowed.retirementUsedCents,0);
  const prohibited=buildHomeFundingPlan({requiredCents:d(90_000),sources,permittedSourceTypes:['generalCash']});assert.equal(prohibited.shortfallCents,d(70_000));assert.equal(prohibited.composition.some(c=>c.type==='taxableInvestments'),false);
});

test('$1.5M 2025-dollar target inflates to a larger future nominal amount',()=>{
  const {goal,index}=homeSetup(),target=goalTargetForYear(goal,2040,index);assert.equal(target.realAmountCents,d(1_500_000));assert.ok(target.nominalAmountCents>d(1_500_000));assert.equal(goalTargetForYear(goal,2025,index).nominalAmountCents,d(1_500_000));
});

test('home affordability reports distinct down-payment and closing/setup failures',()=>{
  const {goal,index,household}=homeSetup(),baseline=evaluateLongTermHome({goal,year:2040,index,household}),down=evaluateLongTermHome({goal,year:2040,index,household:{...household,generalCashCents:baseline.downPaymentRequiredCents-d(1),dedicatedGoalCashCents:0,taxableInvestmentsCents:0}}),closing=evaluateLongTermHome({goal,year:2040,index,household:{...household,generalCashCents:baseline.downPaymentRequiredCents+d(1),dedicatedGoalCashCents:0,taxableInvestmentsCents:0}});
  assert.equal(down.rules.find(r=>r.ruleId==='downPaymentAvailable').shortfallCents,d(1));assert.equal(closing.rules.find(r=>r.ruleId==='closingAndSetupAvailable').pass,false);
});

test('household and retained-property reserve failures are exact blockers',()=>{
  const {goal,index,household}=homeSetup(),emergency=evaluateLongTermHome({goal,year:2040,index,household:{...household,emergencyReserveActualCents:d(90_000)}}),rental=evaluateLongTermHome({goal,year:2040,index,household:{...household,retainedPropertyReserves:[{propertyId:'retained-rental',actualCents:d(15_000),requiredCents:d(25_000)}]}});
  assert.equal(emergency.rules.find(r=>r.ruleId==='householdEmergencyReservePreserved').shortfallCents,d(10_000));assert.equal(rental.rules.find(r=>r.ruleId==='retainedPropertyReservesPreserved').shortfallCents,d(10_000));
});

test('possible and comfortably affordable are separate states with numerical explanations',()=>{
  const out=simulateHomeGoal(goldenHomeGoalFixture()),possible=out.annualResults.find(r=>r.year===2038).evaluation,comfortable=out.annualResults.find(r=>r.year===2040).evaluation;assert.equal(possible.status,'possible');assert.equal(possible.primaryBlocker.ruleId,'housingBurdenComfort');assert.match(possible.primaryBlocker.explanation,/exceeds/);assert.equal(comfortable.status,'comfortablyAffordable');assert.equal(comfortable.blockers.length,0);
});

test('post-purchase free cash flow can fail hard or comfort-only constraints',()=>{
  const {goal,index,household}=homeSetup(),hard=evaluateLongTermHome({goal,year:2040,index,household:{...household,prePurchaseFreeCashFlowCents:0,currentAnnualHousingCostCents:0}}),comfortGoal=structuredClone(goal);comfortGoal.constraints.minimumComfortFreeCashFlowCents=d(500_000);const comfort=evaluateLongTermHome({goal:comfortGoal,year:2040,index,household});assert.equal(hard.rules.find(r=>r.ruleId==='postPurchaseFreeCashFlowNonnegative').pass,false);assert.equal(comfort.status,'possible');assert.equal(comfort.rules.find(r=>r.ruleId==='postPurchaseFreeCashFlowComfort').pass,false);
});

test('existing primary residence requires an explicit disposition plan',()=>{
  const {goal,index,household}=homeSetup(),choice=evaluateLongTermHome({goal,year:2040,index,household:{...household,existingPrimaryResidenceId:'old-primary'}});assert.equal(choice.status,'needsUserChoice');const planned=structuredClone(goal);planned.home.existingPrimaryDispositionPlan={action:'sell',propertyId:'old-primary'};assert.notEqual(evaluateLongTermHome({goal:planned,year:2040,index,household:{...household,existingPrimaryResidenceId:'old-primary'}}).status,'needsUserChoice');
});

test('selected property sale proceeds are opt-in and viable keep/sell strategies can need a choice',()=>{
  const {goal,index,household}=homeSetup(2039),low={...household,generalCashCents:d(300_000),dedicatedGoalCashCents:0,taxableInvestmentsCents:0},sale={id:'sell',proposedSaleProperties:[{propertyId:'retained-rental',netSaleProceedsCents:d(280_000),annualRentalCashFlowCents:d(20_000)}]},without=evaluateLongTermHome({goal,year:2039,index,household:low,strategy:{id:'keep',proposedSaleProperties:[]}}),withSale=evaluateLongTermHome({goal,year:2039,index,household:low,strategy:sale});assert.equal(without.status,'delayed');assert.notEqual(withSale.status,'delayed');assert.equal(withSale.estimatedSaleProceedsCents,d(280_000));
  const healthy={...household,generalCashCents:d(900_000)},comparison=compareHomeStrategies({goal,year:2039,index,household:healthy,strategies:[{id:'keep',proposedSaleProperties:[]},sale]});assert.equal(comparison.status,'needsUserChoice');assert.equal(comparison.evaluations.length,2);
});

test('blocker ranking is deterministic with hard constraints ahead of comfort failures',()=>{
  const rules=[{ruleId:'comfort',kind:'comfort',pass:false,requiredCents:100,shortfallCents:90},{ruleId:'hard-b',kind:'hard',pass:false,requiredCents:100,shortfallCents:20},{ruleId:'hard-a',kind:'hard',pass:false,requiredCents:100,shortfallCents:50}],ranked=rankGoalBlockers(rules);assert.deepEqual(ranked.map(r=>r.ruleId),['hard-a','hard-b','comfort']);assert.equal(ranked[0].role,'primary');
});

test('goal status history preserves reasons, metrics, decision ids, and blockers',()=>{
  const goal=goldenHomeGoalFixture().goals[0],next=appendGoalStatus(goal,{date:'2038-12-31',status:'possible',reason:'Hard rules pass.',decisionId:'decision:2038',blockerIds:['housingBurdenComfort'],metrics:{burden:.384}});assert.equal(goal.statusHistory.length,0);assert.equal(next.statusHistory[0].blockerIds[0],'housingBurdenComfort');assert.equal(next.statusHistory[0].metrics.burden,.384);
});

test('home execution produces a normal property intent, property, mortgage, and realized event',()=>{
  const out=simulateHomeGoal(goldenHomeGoalFixture()),year=out.annualResults.find(r=>r.year===2040),intent=homeGoalToPropertyIntent({goal:goldenHomeGoalFixture().goals[0],decision:year.evaluation,year:2040});assert.equal(intent.propertyRole,'primaryResidence');assert.equal(year.propertyExecution.portfolio.purchases.length,1);assert.equal(Object.keys(year.propertyExecution.closing.properties).length,1);assert.equal(year.propertyExecution.closing.properties['long-term-home'].status,'primaryResidence');assert.ok(year.propertyExecution.closing.liabilities['long-term-home:mortgage']>0);assert.equal(year.realizedEvents[0].type,'property.purchaseIntent');
});

test('golden home fixture tracks earliest timing, delays, execution, and completion',()=>{
  const out=simulateHomeGoal(goldenHomeGoalFixture());assert.equal(out.metadata.earliestPossibleYear,2038);assert.equal(out.metadata.earliestComfortableYear,2040);assert.equal(out.annualResults.find(r=>r.year===2036).evaluation.preferredWindowStatus,'beforePreferredWindow');assert.equal(out.annualResults.find(r=>r.year===2038).evaluation.preferredWindowStatus,'withinPreferredWindow');assert.equal(out.annualResults.find(r=>r.year===2038).evaluation.nextReevaluationYear,2039);assert.equal(out.annualResults.find(r=>r.year===2040).goalStatus,'executed');assert.equal(out.annualResults.find(r=>r.year===2041).goalStatus,'completed');const statuses=out.goal.statusHistory.map(h=>h.status);assert.ok(statuses.includes('delayed'));assert.ok(statuses.includes('possible'));assert.ok(statuses.includes('comfortablyAffordable'));assert.ok(statuses.includes('executed'));assert.ok(statuses.includes('completed'));
});

test('no feasible year within the horizon remains explicit with a dominant blocker',()=>{
  const fixture=goldenHomeGoalFixture();fixture.goalSimulation.endYear=2038;fixture.goals[0].target.amountCents=d(5_000_000);const out=simulateHomeGoal(fixture);assert.equal(out.metadata.earliestPossibleYear,null);assert.equal(out.metadata.earliestComfortableYear,null);assert.ok(out.annualResults.at(-1).evaluation.primaryBlocker);assert.equal(out.goal.realizedTiming,null);
});

test('goal execution treats down payment and brokerage movement as transfers, not wealth creation',()=>{
  const fixture=goldenHomeGoalFixture(),out=simulateHomeGoal(fixture),year=out.annualResults.find(r=>r.year===2040),components=year.reconciliation.netWorthChange.components;assert.equal(components.find(c=>c.type==='downPaymentTransfer').economicEffectCents,0);assert.ok(components.find(c=>c.type==='propertyTransactionCosts').economicEffectCents<0);assert.equal(year.reconciliation.netWorthChange.passes,true);assert.ok(year.closing.generalCashCents>=0);
});

test('brokerage liquidation is explicitly posted and carries zero economic gain',()=>{
  const fixture=goldenHomeGoalFixture();fixture.goalSimulation.openingTaxableInvestmentsCents=d(600_000);for(const year of [2036,2037,2038,2039,2040])fixture.goalSimulation.annualCashContributionByYear[year]=d(50_000);const out=simulateHomeGoal(fixture),execution=out.annualResults.find(r=>r.propertyExecution);const transfer=execution.accountTransfers.find(t=>t.type==='brokerageToProperty');assert.ok(transfer.amountCents>0);assert.equal(transfer.economicEffectCents,0);assert.equal(execution.reconciliation.cash.passes,true);assert.equal(execution.reconciliation.netWorthChange.passes,true);
});

test('generic major-purchase fixture honors conflicts and executes without property logic',()=>{
  const out=simulateGenericGoals(goldenGenericGoalFixture()),first=out.annualResults[0],last=out.annualResults.at(-1);assert.deepEqual(first.allocation.allocations.filter(a=>['goal-a','goal-b'].includes(a.goalId)).map(a=>a.allocatedCents),[d(4_000),d(6_000)]);assert.equal(first.allocation.allocations.find(a=>a.goalId==='vehicle-upgrade').allocatedCents,0);assert.equal(last.executions[0].goalId,'vehicle-upgrade');assert.equal(out.metadata.majorPurchaseCompatible,true);
});

test('golden home and generic goal fixtures reconcile, remain immutable, and are deterministic',()=>{
  const homeFixture=goldenHomeGoalFixture(),homeBefore=structuredClone(homeFixture),homeA=simulateHomeGoal(homeFixture),homeB=simulateHomeGoal(homeFixture);assert.deepEqual(homeA,homeB);assert.deepEqual(homeFixture,homeBefore);assert.equal(homeA.warnings.length,0);
  const genericFixture=goldenGenericGoalFixture(),genericBefore=structuredClone(genericFixture),genericA=simulateGenericGoals(genericFixture),genericB=simulateGenericGoals(genericFixture);assert.deepEqual(genericA,genericB);assert.deepEqual(genericFixture,genericBefore);assert.equal(genericA.warnings.length,0);
  for(const row of [...homeA.annualResults,...genericA.annualResults]){assert.equal(row.reconciliation.cash.passes,true);assert.equal(row.reconciliation.balanceSheet.passes,true);assert.equal(row.reconciliation.netWorthChange.passes,true);}assert.equal(homeA.metadata.workOptionalCompatible,true);
});
