import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stageFraction, activeCareerStages, produceCompensationRecords,
  lookupMilitaryBasePay, lookupOfficerBas, lookupBah,
  MILITARY_PAY_2026, OFFICER_BAS, PEDIATRIC_COMPENSATION_BASELINE,
  BRS_RULES, PRICE_INDEX, FEDERAL_TAX_2026, projectFederalTaxTable,
  householdStateForYear, calculateFederalTaxes, dollarsToCents,
  brsServiceContribution, spendingForYear, buildPriceIndex,
  emergencyReserveStatus, calculateLiabilityYear, reconcileNetWorthChange,
  simulateHousehold
} from '../index.js';
import { goldenHouseholdFixture } from './golden-household-fixture.js';

const d=dollarsToCents;

test('career stages honor dates and midyear transitions',()=>{
  const stages=[{id:'pgy1',startDate:'2028-07-01',endDate:'2029-06-30'},{id:'pgy2',startDate:'2029-07-01',endDate:'2030-06-30'}];
  assert.ok(Math.abs(stageFraction(stages[0],2028)-.5)<.01);assert.equal(activeCareerStages(stages,2027).length,0);assert.equal(activeCareerStages(stages,2029).length,2);
});

test('military pay, BAS, and BAH use official/override/fallback precedence',()=>{
  const pay=lookupMilitaryBasePay({year:2026,grade:'O-2',creditableServiceYears:0,officialTable:MILITARY_PAY_2026});assert.equal(pay.monthlyCents,d(4782));assert.equal(pay.state,'official');
  const projected=lookupMilitaryBasePay({year:2027,grade:'O-3',creditableServiceYears:2.2,officialTable:MILITARY_PAY_2026,annualProjectionRate:.03});assert.equal(projected.state,'projected');
  assert.equal(lookupOfficerBas({year:2026,basTable:OFFICER_BAS}).monthlyCents,d(328.48));
  const official={'2026:TX001:O-2:without':{monthlyCents:d(1800),provenanceId:'official-bah'}};
  assert.equal(lookupBah({year:2026,locationKey:'TX001',grade:'O-2',withDependents:false,official,fallback:{monthlyCents:d(1500)}}).state,'official');
  assert.equal(lookupBah({year:2026,locationKey:'TX001',grade:'O-2',withDependents:false,official,override:{monthlyCents:d(1900)}}).state,'userEntered');
  const fallback=lookupBah({year:2027,locationKey:'UNKNOWN',grade:'O-2',withDependents:false,official,fallback:{monthlyCents:d(2000),baseYear:2026,annualGrowth:.02,provenanceIds:['fallback']}});assert.equal(fallback.state,'projected');assert.deepEqual(fallback.provenanceIds,['fallback']);
});

test('JAG grade transition uses service history, not age',()=>{
  const fixture=goldenHouseholdFixture(),records2029=produceCompensationRecords({stages:fixture.model.careers,year:2029,serviceHistories:fixture.model.serviceHistories,data:fixture.data}),records2030=produceCompensationRecords({stages:fixture.model.careers,year:2030,serviceHistories:fixture.model.serviceHistories,data:fixture.data});
  assert.equal(records2029.find(r=>r.type==='military').metadata.grade,'O-2');assert.equal(records2030.find(r=>r.type==='military').metadata.grade,'O-3');assert.ok(records2030.find(r=>r.type==='military').metadata.serviceYears<2);
});

test('physician residency progresses through PGY stages and attending',()=>{
  const fixture=goldenHouseholdFixture();const r2029=produceCompensationRecords({stages:fixture.model.careers,year:2029,serviceHistories:fixture.model.serviceHistories,data:fixture.data}).filter(r=>r.type==='physician'),r2032=produceCompensationRecords({stages:fixture.model.careers,year:2032,serviceHistories:fixture.model.serviceHistories,data:fixture.data}).filter(r=>r.type==='physician');
  assert.deepEqual(r2029.map(r=>r.metadata.role),['PGY1','PGY2']);assert.equal(r2032[0].metadata.role,'Attending pediatrician');assert.ok(r2032[0].taxableCents>PEDIATRIC_COMPENSATION_BASELINE.residencyAnnualCents.PGY3);
});

test('household combination and filing status are independent',()=>{
  const events=[{id:'combine',type:'household.combine',date:'2030-01-01'},{id:'file',type:'tax.filingStatus.change',date:'2031-01-01',filingStatus:'marriedFilingJointly'}];
  assert.deepEqual(householdStateForYear({year:2030,plannedEvents:events}),{combined:true,combinationEventId:'combine',filingStatus:'single',filingEventId:null});assert.equal(householdStateForYear({year:2031,plannedEvents:events}).filingStatus,'marriedFilingJointly');
});

test('same total compensation with a non-taxable allowance produces lower tax',()=>{
  const table=FEDERAL_TAX_2026,allTaxable=calculateFederalTaxes({filingStatus:'single',earners:[{wagesCents:d(100000),taxableIncomeCents:d(100000)}],table}),mixed=calculateFederalTaxes({filingStatus:'single',earners:[{wagesCents:d(70000),taxableIncomeCents:d(70000)}],table});assert.ok(mixed.totalTaxCents<allTaxable.totalTaxCents);
  const pretax=calculateFederalTaxes({filingStatus:'single',earners:[{wagesCents:d(100000),taxableIncomeCents:d(100000),pretaxRetirementCents:d(10000)}],table});assert.ok(pretax.federalIncomeTaxCents<allTaxable.federalIncomeTaxCents);
});

test('BRS match tiers and commencement boundaries remain exact',()=>{
  const args={basicPayCents:d(10000),serviceStartDate:'2026-01-01',rules:BRS_RULES};
  assert.equal(brsServiceContribution({...args,memberContributionRate:.05,payDate:'2026-02-28'}).automaticCents,0);
  assert.equal(brsServiceContribution({...args,memberContributionRate:.01,payDate:'2028-01-02'}).matchingCents,d(100));
  assert.equal(brsServiceContribution({...args,memberContributionRate:.03,payDate:'2028-01-02'}).matchingCents,d(300));
  assert.equal(brsServiceContribution({...args,memberContributionRate:.04,payDate:'2028-01-02'}).matchingCents,d(350));
  assert.equal(brsServiceContribution({...args,memberContributionRate:.05,payDate:'2028-01-02'}).matchingCents,d(400));
});

test('spending inflates, separates categories, applies stage changes, and includes one-time costs',()=>{
  const index=buildPriceIndex(PRICE_INDEX,2030),out=spendingForYear({year:2030,baseCurrencyYear:2025,priceIndex:index,schedules:[{id:'food',category:'food',classification:'essential',amountCents:d(10000),valueBasis:'real',baseYear:2025,startYear:2025},{id:'travel',category:'travel',classification:'discretionary',amountCents:d(1000),valueBasis:'real',baseYear:2025,startYear:2025},{id:'move',category:'other',classification:'essential',amountCents:d(500),valueBasis:'nominal',startYear:2030,endYear:2030,oneTime:true}],adjustments:[{id:'more-travel',category:'travel',operation:'increase',amountCents:d(500),startYear:2030}]});assert.ok(out.essentialCents>d(10000));assert.ok(out.discretionaryCents>d(1000));assert.equal(out.oneTimeCents,d(500));
});

test('reserve rule handles six months, custom months, shortfall, and adequate cases',()=>{const short=emergencyReserveStatus({annualEssentialSpendingCents:d(48000),actualReserveCents:d(10000)});assert.equal(short.requiredCents,d(24000));assert.equal(short.shortfallCents,d(14000));assert.equal(emergencyReserveStatus({annualEssentialSpendingCents:d(48000),actualReserveCents:d(24000)}).status,'adequate');assert.equal(emergencyReserveStatus({annualEssentialSpendingCents:d(48000),actualReserveCents:0,reserveMonths:3}).requiredCents,d(12000));});

test('education debt accrues interest, pays principal, and caps payoff',()=>{const year=calculateLiabilityYear({id:'education',openingBalanceCents:d(10000),annualRate:.05,scheduledPaymentCents:d(3000)});assert.equal(year.interestCents,d(500));assert.equal(year.principalPaidCents,d(2500));const payoff=calculateLiabilityYear({id:'education',openingBalanceCents:d(1000),annualRate:0,scheduledPaymentCents:d(5000)});assert.equal(payoff.closingBalanceCents,0);});

test('net-worth decomposition treats contributions and principal as transfers',()=>{const result=reconcileNetWorthChange({year:2030,openingNetWorthCents:d(100),closingNetWorthCents:d(120),components:[{type:'surplus',economicEffectCents:d(15)},{type:'employeeContribution',economicEffectCents:0,transferCents:d(10)},{type:'debtPrincipal',economicEffectCents:0,transferCents:d(5)},{type:'employerMatch',economicEffectCents:d(3)},{type:'growth',economicEffectCents:d(2)}]});assert.equal(result.passes,true);});

test('golden household fixture preserves ownership and reconciles every year deterministically',()=>{
  const fixture=goldenHouseholdFixture(),before=structuredClone(fixture.model),first=simulateHousehold(fixture.model,{data:fixture.data,taxTables:fixture.taxTables}),second=simulateHousehold(fixture.model,{data:fixture.data,taxTables:fixture.taxTables});assert.deepEqual(first,second);assert.deepEqual(fixture.model,before);assert.equal(first.years.length,13);assert.equal(first.warnings.length,0);
  for(const year of first.years){assert.equal(year.reconciliation.cash.passes,true);assert.equal(year.reconciliation.balanceSheet.passes,true);assert.equal(year.reconciliation.netWorthChange.passes,true);}
  assert.ok(first.years.find(y=>y.year===2032).reportingUnits.jag);assert.ok(first.years.find(y=>y.year===2033).reportingUnits.household);assert.equal(fixture.model.accounts.find(a=>a.id==='tsp').ownerId,'jag');assert.equal(first.years.find(y=>y.year===2033).householdState.filingStatus,'single');assert.equal(first.years.find(y=>y.year===2034).householdState.filingStatus,'marriedFilingJointly');
  const separate=first.years.find(y=>y.year===2032).reportingUnits;assert.notEqual(separate.jag.spendingCents,separate.physician.spendingCents);assert.ok(separate.shared.spendingCents>0);
  const firstTsp=first.years.find(y=>y.year===2029).retirement.find(r=>r.personId==='jag');assert.ok(firstTsp.employerAutomaticCents>0);assert.equal(firstTsp.employerMatchCents,0);const matched=first.years.find(y=>y.year===2032).retirement.find(r=>r.personId==='jag');assert.ok(matched.employerMatchCents>0);
  const attending=first.years.find(y=>y.year===2032);assert.ok(attending.income.physicianCents>attending.income.militaryTaxableCents);assert.equal(attending.allocation.policy.id,'stabilityFirst');
});

test('traditional and Roth contributions preserve cash use but differ in taxable income',()=>{const traditional=goldenHouseholdFixture(),roth=goldenHouseholdFixture();roth.model.retirementPolicies['jag-career'].rothRate=.05;roth.model.retirementPolicies['jag-career'].traditionalRate=0;const a=simulateHousehold(traditional.model,{data:traditional.data,taxTables:traditional.taxTables}).years.find(y=>y.year===2032),b=simulateHousehold(roth.model,{data:roth.data,taxTables:roth.taxTables}).years.find(y=>y.year===2032);assert.equal(a.allocation.employeeRetirementCents,b.allocation.employeeRetirementCents);assert.ok(a.taxes.taxableIncomeCents<b.taxes.taxableIncomeCents);assert.ok(a.taxes.federalIncomeTaxCents<b.taxes.federalIncomeTaxCents);});

test('future tax tables are explicitly projected',()=>{const projected=projectFederalTaxTable(FEDERAL_TAX_2026,2030,.025);assert.equal(projected.state,'projected');assert.ok(projected.standardDeduction.single>FEDERAL_TAX_2026.standardDeduction.single);assert.match(projected.provenanceId,/projected/);});
