import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAssetRecord, transitionAsset, disposeAsset, validateOwnership,
  createPropertyRecord, appreciateProperty, rentalOperatingStatement,
  primaryResidenceCosts, propertyReserveStatus, propertyEquity,
  calculatePropertySale, evaluatePropertyPurchase, evaluateRentalHealth,
  evaluatePcsProperty, simulatePropertyLifecycle, dollarsToCents
} from '../index.js';
import { goldenPropertyFixture } from './golden-property-fixture.js';

const d=dollarsToCents;
const baseIntent={id:'intent',desiredYear:2030,evaluationYear:2030,downPaymentCents:d(20_000),buyerClosingCostsCents:d(5_000),initialSetupCostsCents:d(2_000),initialPropertyReserveCents:d(6_000),financedAmountCents:d(180_000),mortgageRate:.05,mortgageTermMonths:360,estimatedAnnualDebtServiceCents:d(12_000),fundingPolicy:{sources:['generalCash'],allowTaxableInvestments:false}};
const purchaseArgs={intent:baseIntent,availableCashCents:d(40_000),taxableInvestmentsCents:d(25_000),emergencyReserveActualCents:d(30_000),emergencyReserveRequiredCents:d(30_000),annualFreeCashFlowCents:d(24_000),currentPropertyCount:0,protectedObligationsFunded:true};

test('generic asset lifecycle preserves ownership and supports future vehicle states',()=>{
  const planned=createAssetRecord({id:'vehicle-1',name:'Future vehicle',type:'vehicle',ownership:[{ownerId:'person-a',share:1}],status:'planned',liquidity:'marketable'});
  const acquired=transitionAsset(planned,{effectiveDate:'2030-01-01',newStatus:'acquired',explanation:'Purchased.'});
  const held=transitionAsset(acquired,{effectiveDate:'2030-02-01',newStatus:'held',explanation:'In use.'});
  const sold=disposeAsset(held,{effectiveDate:'2035-01-01',newStatus:'sold',explanation:'Sold.'});
  assert.equal(planned.status,'planned');assert.equal(sold.status,'sold');assert.equal(sold.statusHistory.length,3);assert.deepEqual(sold.ownership,[{ownerId:'person-a',share:1}]);
});

test('ownership shares must be positive and total one',()=>{
  assert.equal(validateOwnership([{ownerId:'a',share:.4},{ownerId:'b',share:.6}]),true);
  assert.throws(()=>validateOwnership([{ownerId:'a',share:.7},{ownerId:'b',share:.7}]),/total 1/);
});

test('property record and valuation support full and partial ownership years',()=>{
  const property=createPropertyRecord({id:'home',name:'Home',ownership:[{ownerId:'a',share:1}],status:'primaryResidence',currentValueCents:d(200_000)});
  assert.equal(property.type,'property');assert.equal(property.liquidity,'illiquid');
  const full=appreciateProperty({openingValueCents:d(200_000),annualRate:.03});
  const half=appreciateProperty({openingValueCents:d(200_000),annualRate:.03,ownershipFraction:.5});
  assert.equal(full.closingValueCents,d(206_000));assert.ok(half.appreciationCents>0&&half.appreciationCents<full.appreciationCents);
});

test('purchase feasibility reports each funding and protection constraint',()=>{
  assert.equal(evaluatePropertyPurchase(purchaseArgs).status,'feasible');
  const down=evaluatePropertyPurchase({...purchaseArgs,availableCashCents:d(19_000)});assert.equal(down.rules.find(r=>r.ruleId==='downPaymentAvailable').shortfallCents,d(1_000));
  const closing=evaluatePropertyPurchase({...purchaseArgs,availableCashCents:d(23_000)});assert.equal(closing.rules.find(r=>r.ruleId==='closingAndSetupAvailable').shortfallCents,d(4_000));
  const householdReserve=evaluatePropertyPurchase({...purchaseArgs,emergencyReserveActualCents:d(20_000)});assert.equal(householdReserve.rules.find(r=>r.ruleId==='householdEmergencyReservePreserved').shortfallCents,d(10_000));
  const propertyReserve=evaluatePropertyPurchase({...purchaseArgs,availableCashCents:d(29_000)});assert.equal(propertyReserve.rules.find(r=>r.ruleId==='propertyReserveFunded').shortfallCents,d(4_000));
  const protectedFunds=evaluatePropertyPurchase({...purchaseArgs,intent:{...baseIntent,fundingPolicy:{sources:['retirement'],allowTaxableInvestments:false}}});assert.equal(protectedFunds.rules.find(r=>r.ruleId==='protectedRetirementUntouched').pass,false);
});

test('taxable investments fund a purchase only when explicitly permitted',()=>{
  const denied=evaluatePropertyPurchase({...purchaseArgs,availableCashCents:d(25_000)});assert.equal(denied.status,'delayed');assert.equal(denied.availableFundingCents,d(25_000));
  const allowed=evaluatePropertyPurchase({...purchaseArgs,availableCashCents:d(25_000),intent:{...baseIntent,fundingPolicy:{sources:['generalCash','taxableInvestments'],allowTaxableInvestments:true}}});assert.equal(allowed.status,'feasible');assert.equal(allowed.funding.taxableInvestmentCents,d(8_000));
});

test('primary residence costs never produce rent and housing replacement remains explicit',()=>{
  const costs=primaryResidenceCosts({propertyTaxCents:d(4_000),insuranceCents:d(2_000),hoaCents:d(1_000),maintenanceCents:d(3_000),mortgageDebtServiceCents:d(12_000)});
  assert.deepEqual(costs,{ownershipFraction:1,propertyTaxCents:d(4_000),insuranceCents:d(2_000),hoaCents:d(1_000),maintenanceCents:d(3_000),nonMortgageCents:d(10_000),mortgageDebtServiceCents:d(12_000),totalCashCostCents:d(22_000)});
  assert.equal('effectiveRentCents' in costs,false);
});

test('rental operating statement distinguishes NOI from financing and all operating costs',()=>{
  const statement=rentalOperatingStatement({monthlyRentCents:d(2_000),baseYear:2030,year:2030,vacancyRate:.05,propertyTaxCents:d(3_000),insuranceCents:d(1_200),hoaCents:d(600),maintenanceRate:.05,capexRate:.03,managementRate:.08,mortgageDebtServiceCents:d(12_000)});
  assert.equal(statement.grossScheduledRentCents,d(24_000));assert.equal(statement.vacancyLossCents,d(1_200));assert.equal(statement.effectiveRentCents,d(22_800));
  assert.equal(statement.operatingExpensesCents,statement.propertyTaxCents+statement.insuranceCents+statement.hoaCents+statement.maintenanceCents+statement.capexCents+statement.managementCents);
  assert.equal(statement.netOperatingIncomeCents,statement.effectiveRentCents-statement.operatingExpensesCents);assert.equal(statement.cashFlowAfterFinancingCents,statement.netOperatingIncomeCents-d(12_000));
});

test('property reserves remain separate and report exact funding shortfalls',()=>{
  const short=propertyReserveStatus({operatingExpensesCents:d(8_000),debtServiceCents:d(16_000),balanceCents:d(9_000),reserveMonths:6});assert.equal(short.requiredCents,d(12_000));assert.equal(short.shortfallCents,d(3_000));
  const adequate=propertyReserveStatus({operatingExpensesCents:d(8_000),debtServiceCents:d(16_000),balanceCents:d(13_000),reserveMonths:6});assert.equal(adequate.status,'adequate');assert.equal(adequate.surplusCents,d(1_000));
});

test('PCS policy can convert, sell, or require a user choice without optimization',()=>{
  const statement={cashFlowAfterFinancingCents:d(5_000),householdSubsidyCents:0},reserve={actualCents:d(12_000),requiredCents:d(10_000)},householdReserve={actualCents:d(30_000),requiredCents:d(30_000)};
  const pass=evaluateRentalHealth({statement,reserve,householdReserve,annualHouseholdFreeCashFlowCents:d(20_000)});assert.equal(evaluatePcsProperty({rentalHealth:pass}).action,'convertToRental');
  const fail=evaluateRentalHealth({statement:{...statement,cashFlowAfterFinancingCents:-d(1_000),householdSubsidyCents:d(1_000)},reserve,householdReserve,annualHouseholdFreeCashFlowCents:d(20_000)});assert.equal(evaluatePcsProperty({rentalHealth:fail}).action,'sell');
  const choice=evaluateRentalHealth({statement,reserve,householdReserve,annualHouseholdFreeCashFlowCents:d(20_000),preferenceSensitive:true});assert.equal(evaluatePcsProperty({rentalHealth:choice}).status,'needsUserChoice');
});

test('property equity is value less linked debt and sale proceeds reconcile',()=>{
  assert.deepEqual(propertyEquity({marketValueCents:d(300_000),debtCents:d(220_000)}),{marketValueCents:d(300_000),debtCents:d(220_000),equityCents:d(80_000)});
  const sale=calculatePropertySale({carryingValueCents:d(300_000),salePriceCents:d(310_000),sellerCostRate:.06,mortgagePayoffCents:d(210_000),reserveReleaseCents:d(10_000)});
  assert.equal(sale.sellingCostsCents,d(18_600));assert.equal(sale.netSaleProceedsCents,d(91_400));assert.equal(sale.saleValuationDifferenceCents,d(10_000));
});

test('golden lifecycle delays, reevaluates, purchases, converts, rents, and sells',()=>{
  const out=simulatePropertyLifecycle(goldenPropertyFixture()),y=year=>out.annualResults.find(r=>r.year===year);
  const delayed=y(2030).decisions.find(v=>v.status==='delayed');assert.equal(delayed.blockers.length,1);assert.equal(delayed.blockers[0].ruleId,'propertyReserveFunded');assert.equal(delayed.blockers[0].shortfallCents,d(12_800));
  const executed=y(2031).decisions.find(v=>v.status==='executed');assert.equal(executed.delayYears,1);assert.equal(y(2031).portfolio.purchases[0].downPaymentCents,d(60_000));
  assert.equal(y(2034).portfolio.conversions.length,1);assert.equal(y(2034).portfolio.rentalCount,1);assert.ok(y(2034).portfolio.effectiveRentCents>0);assert.ok(y(2034).portfolio.effectiveRentCents<y(2035).portfolio.effectiveRentCents);
  assert.equal(y(2038).portfolio.sales.length,1);assert.equal(y(2039).portfolio.effectiveRentCents,0);assert.equal(y(2039).portfolio.rentalCount,0);
});

test('expected property transfer appears only when realized, creates no wages, and earns no rent',()=>{
  const out=simulatePropertyLifecycle(goldenPropertyFixture()),y=year=>out.annualResults.find(r=>r.year===year);
  assert.equal(y(2031).portfolio.propertyCount,1);assert.equal(y(2032).portfolio.propertyCount,2);
  const component=y(2032).reconciliation.netWorthChange.components.find(c=>c.type==='externalPropertyTransfer');assert.equal(component.economicEffectCents,d(200_000));
  assert.equal(y(2032).cashSources.some(s=>/income|wage/i.test(s.type)),false);assert.equal(y(2032).portfolio.effectiveRentCents,0);assert.equal(y(2039).portfolio.effectiveRentCents,0);
});

test('purchase, principal, appreciation, rental activity, sale, and transfer decompose without double counting',()=>{
  const out=simulatePropertyLifecycle(goldenPropertyFixture()),y=year=>out.annualResults.find(r=>r.year===year),component=(year,type)=>y(year).reconciliation.netWorthChange.components.find(c=>c.type===type);
  assert.equal(component(2031,'downPaymentTransfer').economicEffectCents,0);assert.equal(component(2031,'downPaymentTransfer').transferCents,d(60_000));assert.ok(component(2031,'propertyTransactionCosts').economicEffectCents<0);
  assert.equal(component(2031,'mortgagePrincipalReduction').economicEffectCents,0);assert.ok(component(2031,'propertyAppreciation').economicEffectCents>0);
  assert.ok(component(2035,'propertyOperatingSurplus').economicEffectCents>0);assert.ok(component(2038,'propertyTransactionCosts').economicEffectCents<0);assert.equal(component(2032,'externalPropertyTransfer').economicEffectCents,d(200_000));
});

test('golden property fixture preserves status and ownership histories and reconciles deterministically',()=>{
  const fixture=goldenPropertyFixture(),before=structuredClone(fixture),first=simulatePropertyLifecycle(fixture),second=simulatePropertyLifecycle(fixture);assert.deepEqual(first,second);assert.deepEqual(fixture,before);assert.equal(first.annualResults.length,10);assert.equal(first.warnings.length,0);
  for(const year of first.annualResults){assert.equal(year.reconciliation.cash.passes,true);assert.equal(year.reconciliation.balanceSheet.passes,true);assert.equal(year.reconciliation.netWorthChange.passes,true);}
  const final=first.annualResults.at(-1),home=final.closing.properties['duty-home'],condo=final.closing.properties['expected-condo'];assert.equal(home.status,'sold');assert.deepEqual(home.statusHistory.map(s=>s.newStatus),['primaryResidence','rental','sold']);assert.deepEqual(home.ownership,[{ownerId:'jag',share:.5},{ownerId:'physician',share:.5}]);assert.deepEqual(condo.ownership,[{ownerId:'jag',share:1}]);assert.equal(first.metadata.mortgageEngine,'model/mortgage.js');assert.equal(first.metadata.vehicleCompatible,true);
});

test('generic housing is replaced during primary occupancy and posted once after conversion',()=>{
  const out=simulatePropertyLifecycle(goldenPropertyFixture()),y=year=>out.annualResults.find(r=>r.year===year);
  assert.equal(y(2031).cashUses.some(u=>u.type==='genericHousing'),false);assert.equal(y(2033).cashUses.some(u=>u.type==='genericHousing'),false);
  assert.equal(y(2035).cashUses.filter(u=>u.type==='genericHousing').length,1);assert.equal(y(2035).cashUses.find(u=>u.type==='genericHousing').amountCents,d(24_000));
});

test('rising rental costs restore property reserves without using the household emergency reserve',()=>{
  const out=simulatePropertyLifecycle(goldenPropertyFixture()),year=out.annualResults.find(r=>r.year===2037),funding=year.cashUses.find(u=>u.type==='propertyReserveFunding'),property=year.propertyResults.find(p=>p.propertyId==='duty-home');
  assert.ok(funding.amountCents>0);assert.equal(property.reserve.status,'adequate');assert.equal(property.reserve.actualCents,property.reserve.requiredCents);assert.equal(year.closing.emergencyReserveCents,d(30_000));
});
