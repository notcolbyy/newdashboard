import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ageOnDate,resolvePeople,resolveEventDate,serviceYearsOnDate,buildPriceIndex,nominalToReal,realToNominal,FEDERAL_TAX_2026,PRICE_INDEX,calculateFederalTaxes,dollarsToCents,monthlyPaymentCents,amortizeMortgage,aggregateMortgageYear,calculateLiabilityYear,resolvePlannedEvents,realizeEvent,evaluateReserveDecision,BRS_RULES,brsServiceContribution,simulate,validateModelDocument,migrateModelDocument,createCompensationRecord,compensationToIncomeEntries,reconcileCash,reconcileBalanceSheet} from '../index.js';
import { minimalLifeFixture } from './fixtures.js';

test('calendar resolves exact ages, offsets, age events, service years, and midyear ordering',()=>{
  const people=resolvePeople([{id:'a',isReference:true,birthDate:'2000-04-15'},{id:'b',ageOffsetFromReference:-2}]);
  assert.equal(ageOnDate(people[0],'2025-04-14'),24);assert.equal(ageOnDate(people[0],'2025-04-15'),25);assert.equal(people[1].birthDate,'2002-04-15');
  assert.equal(resolveEventDate({id:'e',personId:'a',age:25},people),'2025-04-15');
  assert.ok(Math.abs(serviceYearsOnDate('2020-01-01','2025-01-01')-5)<.01);
  const events=resolvePlannedEvents([{id:'late',date:'2025-08-01',type:'x'},{id:'early',date:'2025-07-01',type:'x'}],people);assert.deepEqual(events.map(e=>e.id),['early','late']);
});

test('currency converts both ways, round trips, and projects provenance',()=>{
  const index=buildPriceIndex(PRICE_INDEX,2030),nominal=realToNominal(1_000_000,2025,2030,index),real=nominalToReal(nominal,2030,2025,index);
  assert.ok(Math.abs(real-1_000_000)<=1);assert.equal(index[2030].state,'projected');assert.throws(()=>buildPriceIndex({...PRICE_INDEX,known:{2025:{value:0}}},2026));
});

test('federal tax handles deduction, bracket, wage base, Medicare, and two earners',()=>{
  const below=calculateFederalTaxes({filingStatus:'single',earners:[{wagesCents:dollarsToCents(10000)}],table:FEDERAL_TAX_2026});assert.equal(below.federalIncomeTaxCents,0);
  const boundary=calculateFederalTaxes({filingStatus:'single',earners:[{wagesCents:dollarsToCents(16100+12400)}],table:FEDERAL_TAX_2026});assert.equal(boundary.federalIncomeTaxCents,dollarsToCents(1240));
  const capped=calculateFederalTaxes({filingStatus:'single',earners:[{wagesCents:dollarsToCents(200000)}],table:FEDERAL_TAX_2026});assert.equal(capped.socialSecurityTaxCents,dollarsToCents(11439));assert.ok(capped.medicareTaxCents>0);
  const joint=calculateFederalTaxes({filingStatus:'marriedFilingJointly',earners:[{wagesCents:dollarsToCents(150000)},{wagesCents:dollarsToCents(175000)}],table:FEDERAL_TAX_2026});assert.equal(joint.additionalMedicareTaxCents,dollarsToCents(675));
});

test('mortgage handles known payment, first year, midyear start, extra principal, zero rate, and payoff',()=>{
  assert.ok(Math.abs(monthlyPaymentCents(dollarsToCents(100000),.06,360)-dollarsToCents(599.55))<=1);
  const normal=amortizeMortgage({principalCents:dollarsToCents(100000),annualRate:.06,termMonths:360,startDate:'2026-01-01',throughYear:2026});const annual=aggregateMortgageYear(normal.rows,2026);assert.equal(normal.rows.length,11);assert.equal(normal.rows[0].month,'2026-02');assert.ok(annual.interestCents>annual.principalPaidCents);
  const mid=amortizeMortgage({principalCents:dollarsToCents(12000),annualRate:.05,termMonths:12,startDate:'2026-06-01',throughYear:2026,extraPrincipalByMonth:{'2026-09':dollarsToCents(500)}});assert.equal(mid.rows.length,6);assert.equal(mid.rows.find(r=>r.month==='2026-09').extraPrincipalCents,dollarsToCents(500));
  assert.equal(monthlyPaymentCents(dollarsToCents(1200),0,12),dollarsToCents(100));
  const payoff=amortizeMortgage({principalCents:dollarsToCents(1000),annualRate:.05,termMonths:12,startDate:'2026-01-01',throughYear:2026,payoffDate:'2026-05-01'});assert.equal(payoff.closingBalanceCents,0);assert.equal(payoff.rows.at(-1).payoff,true);
});

test('generic liabilities handle interest, zero interest, extra principal, and final-payment caps',()=>{
  const normal=calculateLiabilityYear({id:'loan',openingBalanceCents:dollarsToCents(10000),annualRate:.05,scheduledPaymentCents:dollarsToCents(1500),extraPrincipalCents:dollarsToCents(500)});assert.equal(normal.interestCents,dollarsToCents(500));assert.equal(normal.principalPaidCents,dollarsToCents(1500));assert.equal(normal.closingBalanceCents,dollarsToCents(8500));
  const zero=calculateLiabilityYear({id:'zero',openingBalanceCents:dollarsToCents(1000),annualRate:0,scheduledPaymentCents:dollarsToCents(200)});assert.equal(zero.interestCents,0);assert.equal(zero.closingBalanceCents,dollarsToCents(800));
  const payoff=calculateLiabilityYear({id:'payoff',openingBalanceCents:dollarsToCents(100),annualRate:.1,scheduledPaymentCents:dollarsToCents(1000),extraPrincipalCents:dollarsToCents(500)});assert.equal(payoff.totalPaymentCents,dollarsToCents(110));assert.equal(payoff.closingBalanceCents,0);
});

test('events are immutable and realized records preserve planned/actual timing',()=>{const source=[{id:'e',type:'income.once',personId:'p',age:25}];const before=JSON.stringify(source),resolved=resolvePlannedEvents(source,[{id:'p',isReference:true,birthYear:2000}]),realized=realizeEvent(resolved[0],'2025-07-01');assert.equal(JSON.stringify(source),before);assert.equal(realized.plannedEventId,'e');assert.equal(realized.actualDate,'2025-07-01');});

test('decision reserve rule passes or delays with exact shortfall',()=>{assert.equal(evaluateReserveDecision({id:'a',availableCents:100,requiredCents:100,plannedDate:'2030-01-01'}).status,'feasible');const failed=evaluateReserveDecision({id:'b',availableCents:60,requiredCents:100,plannedDate:'2030-01-01'});assert.equal(failed.status,'delayed');assert.equal(failed.rules[0].shortfallCents,40);});

test('BRS timing is isolated and matches official commencement/vesting rules',()=>{const early=brsServiceContribution({basicPayCents:100000,memberContributionRate:.05,serviceStartDate:'2026-01-01',payDate:'2026-02-01',rules:BRS_RULES});assert.equal(early.automaticCents,0);assert.equal(early.matchingCents,0);const thirdYear=brsServiceContribution({basicPayCents:100000,memberContributionRate:.05,serviceStartDate:'2026-01-01',payDate:'2028-01-02',rules:BRS_RULES});assert.equal(thirdYear.automaticCents,1000);assert.equal(thirdYear.matchingCents,4000);assert.equal(thirdYear.automaticVested,true);});

test('compensation records stay separate from ledger income',()=>{const record=createCompensationRecord({id:'mil',personId:'p',type:'military',period:'2026',taxableCents:100,nontaxableCents:20,retirementEligibleCents:80,provenanceIds:['x']});const entries=compensationToIncomeEntries([record]);assert.equal(entries.length,2);assert.equal(entries[0].taxable,true);});

test('schema validates and migration preserves unsupported documents',()=>{const model=minimalLifeFixture();assert.equal(validateModelDocument(model).valid,true);const unknown={...model,schemaVersion:'1.0.0',futureField:{keep:true}};const result=migrateModelDocument(unknown);assert.equal(result.ok,false);assert.deepEqual(result.document.futureField,{keep:true});});

test('annual simulation reconciles cash and balance sheet and is deterministic',()=>{const model=minimalLifeFixture(),options={taxTables:{2026:FEDERAL_TAX_2026,2027:FEDERAL_TAX_2026}},before=JSON.stringify(model);const first=simulate(model,options),second=simulate(model,options);assert.deepEqual(first,second);assert.equal(JSON.stringify(model),before);assert.equal(first.years.length,2);for(const year of first.years){assert.equal(year.reconciliation.cash.passes,true);assert.equal(year.reconciliation.cash.differenceCents,0);assert.equal(year.reconciliation.balanceSheet.passes,true);assert.equal(year.balanceSheet.netWorthCents,year.balanceSheet.grossAssetsCents-year.balanceSheet.totalLiabilitiesCents);}assert.equal(first.warnings.length,0);assert.equal(first.realizedEvents.length,2);});

test('reconciliation failures are structured and never silently repaired',()=>{const cash=reconcileCash({year:2030,openingCashCents:100,sources:[{id:'income',amountCents:50}],uses:[{id:'expense',amountCents:20}],actualClosingCashCents:125});assert.equal(cash.passes,false);assert.equal(cash.warning.code,'CASH_RECONCILIATION_FAILED');assert.equal(cash.warning.differenceCents,-5);const sheet=reconcileBalanceSheet({year:2030,accountValuesCents:[100],assetValuesCents:[50],liabilityValuesCents:[20],reportedGrossAssetsCents:150,reportedLiabilitiesCents:20,reportedNetWorthCents:128});assert.equal(sheet.passes,false);assert.equal(sheet.warning.code,'BALANCE_SHEET_RECONCILIATION_FAILED');assert.equal(sheet.warning.differenceCents,-2);});

test('V2 modules contain no UI dependencies',()=>{const root=new URL('../',import.meta.url);for(const path of ['model','data','storage']){for(const file of fs.readdirSync(new URL(`${path}/`,root)).filter(f=>f.endsWith('.js'))){const source=fs.readFileSync(new URL(`${path}/${file}`,root),'utf8');assert.doesNotMatch(source,/\bdocument\s*[.(]|\bwindow\s*[.(]|Chart\./,`${path}/${file}`);}}});
