import { ageOnDate, buildSimulationYears, resolvePeople } from './calendar.js';
import { buildPriceIndex } from './currency.js';
import { produceCompensationRecords, activeCareerStages } from './careers.js';
import { retirementContributionsForYear } from './retirement.js';
import { spendingForYear, emergencyReserveStatus } from './spending.js';
import { householdStateForYear, BASELINE_ALLOCATION_POLICY } from './household.js';
import { calculateFederalTaxes } from './tax.js';
import { calculateLiabilityYear } from './liabilities.js';
import { applyRate, sumCents } from './money.js';
import { reconcileCash, reconcileBalanceSheet } from './reconciliation.js';
import { reconcileNetWorthChange } from './decomposition.js';
import { resolvePlannedEvents, realizeEvent } from './events.js';
import { validateModelDocument } from '../storage/schema.js';

function calculateTaxes({ people, records, retirement, filingStatus, table }) {
  const earners=people.map(person=>{
    const owned=records.filter(r=>r.personId===person.id),ret=retirement.filter(r=>r.personId===person.id);
    return {personId:person.id,wagesCents:sumCents(owned.map(r=>r.payrollWagesCents)),socialSecurityWagesCents:sumCents(owned.map(r=>r.payrollWagesCents)),medicareWagesCents:sumCents(owned.map(r=>r.payrollWagesCents)),taxableIncomeCents:sumCents(owned.map(r=>r.taxableCents)),pretaxRetirementCents:sumCents(ret.map(r=>r.traditionalCents))};
  });
  if(filingStatus==='marriedFilingJointly')return calculateFederalTaxes({filingStatus,earners,table});
  const results=earners.map(e=>calculateFederalTaxes({filingStatus,earners:[e],table}));
  const fields=['grossIncomeCents','pretaxRetirementCents','taxableIncomeCents','federalIncomeTaxCents','socialSecurityTaxCents','medicareTaxCents','additionalMedicareTaxCents','totalTaxCents'];
  return Object.fromEntries(fields.map(k=>[k,sumCents(results.map(r=>r[k]))]));
}

function reportingUnits({people,combined,records,spending,accountState,liabilityState,accounts,liabilities}){
  const unit=(ownerId,all=false)=>({incomeCents:sumCents(records.filter(r=>all||r.personId===ownerId).map(r=>r.taxableCents+r.nontaxableCents)),spendingCents:sumCents(spending.entries.filter(e=>all||e.ownerId===ownerId).map(e=>e.amountCents)),accountBalanceCents:sumCents(accounts.filter(a=>all||a.ownerId===ownerId).map(a=>accountState.get(a.id))),liabilityBalanceCents:sumCents(liabilities.filter(l=>all||l.ownerId===ownerId).map(l=>liabilityState.get(l.id)))});
  return combined?{household:unit('household',true)}:{...Object.fromEntries(people.map(p=>[p.id,unit(p.id)])),shared:unit('household')};
}

export function simulateHousehold(model,{data,taxTables}={}){
  const validation=validateModelDocument(model);if(!validation.valid)return{years:[],realizedEvents:[],decisions:[],warnings:validation.warnings,errors:validation.errors,metadata:{valid:false}};
  const before=structuredClone(model),people=resolvePeople(model.people),years=buildSimulationYears(model),priceIndex=buildPriceIndex(data.priceIndex,Math.max(...years)),planned=resolvePlannedEvents(model.plannedEvents,people);
  const accountState=new Map(model.accounts.map(a=>[a.id,a.openingBalanceCents])),liabilityState=new Map(model.liabilities.map(l=>[l.id,l.openingBalanceCents]));
  const results=[],realizedEvents=[],warnings=[...validation.warnings];
  for(const year of years){
    const openingAccounts=Object.fromEntries(accountState),openingLiabilities=Object.fromEntries(liabilityState),openingAssets=sumCents(model.assets.map(a=>a.valueCents??0)),openingGross=sumCents([...accountState.values()])+openingAssets,openingLiability=sumCents([...liabilityState.values()]),openingNetWorth=openingGross-openingLiability;
    const householdState=householdStateForYear({year,plannedEvents:model.plannedEvents,defaultFilingStatus:model.household.filingStatus});
    const records=produceCompensationRecords({stages:model.careers,year,serviceHistories:model.serviceHistories,data});
    const retirement=retirementContributionsForYear({records,stages:model.careers,year,serviceHistories:model.serviceHistories,policies:model.retirementPolicies,brsRules:data.brsRules});
    const table=taxTables[year];if(!table)throw new TypeError(`Tax table required for ${year}.`);
    const taxes=calculateTaxes({people,records,retirement,filingStatus:householdState.filingStatus,table});
    const spending=spendingForYear({schedules:model.spendingSchedules,adjustments:model.spendingAdjustments,year,priceIndex,baseCurrencyYear:model.baseCurrencyYear});
    const cashAccount=model.accounts.find(a=>a.type==='generalCash'),reserveAccount=model.accounts.find(a=>a.type==='emergencyReserve'),taxableAccount=model.accounts.find(a=>a.type==='taxableInvestment');if(!cashAccount||!reserveAccount)throw new TypeError('Household simulation requires general cash and emergency reserve accounts.');
    const cashSources=records.map(r=>({id:r.id,type:'compensation',amountCents:r.taxableCents+r.nontaxableCents,ownerId:r.personId}));
    const cashUses=[{id:`tax:${year}`,type:'tax',amountCents:taxes.totalTaxCents},{id:`spending:${year}`,type:'spending',amountCents:spending.totalCents}];
    const liabilityChanges=[];for(const liability of model.liabilities){const change=calculateLiabilityYear({...liability,openingBalanceCents:liabilityState.get(liability.id),scheduledPaymentCents:(liability.scheduledPayments??[]).find(p=>p.year===year)?.amountCents??0,extraPrincipalCents:(liability.extraPrincipalPayments??[]).find(p=>p.year===year)?.amountCents??0});liabilityChanges.push(change);liabilityState.set(liability.id,change.closingBalanceCents);if(change.totalPaymentCents)cashUses.push({id:`debt:${liability.id}`,type:'debtService',amountCents:change.totalPaymentCents});}
    const employeeRetirement=sumCents(retirement.map(r=>r.traditionalCents+r.rothCents));if(employeeRetirement)cashUses.push({id:`retirement:${year}`,type:'employeeRetirement',amountCents:employeeRetirement});
    const openingCash=accountState.get(cashAccount.id),cashInterest=applyRate(openingCash,cashAccount.annualReturn??0);if(cashInterest)cashSources.push({id:`cashInterest:${year}`,type:'cashInterest',amountCents:cashInterest});
    let available=openingCash+sumCents(cashSources.map(s=>s.amountCents))-sumCents(cashUses.map(u=>u.amountCents));
    const reserveBefore=accountState.get(reserveAccount.id),reserveInitial=emergencyReserveStatus({annualEssentialSpendingCents:spending.essentialCents,actualReserveCents:reserveBefore,reserveMonths:model.policies.reserveMonths??6}),reserveContribution=Math.min(Math.max(0,available),reserveInitial.shortfallCents);available-=reserveContribution;if(reserveContribution)cashUses.push({id:`reserve:${year}`,type:'reserveRestoration',amountCents:reserveContribution});
    const plannedTaxable=Math.min(Math.max(0,available),model.policies.taxableInvestmentAnnualCents??0);available-=plannedTaxable;if(plannedTaxable)cashUses.push({id:`taxable:${year}`,type:'taxableInvestment',amountCents:plannedTaxable});
    const contributionsByAccount=new Map();for(const contribution of retirement){const total=contribution.traditionalCents+contribution.rothCents+contribution.employerAutomaticCents+contribution.employerMatchCents;contributionsByAccount.set(contribution.accountId,(contributionsByAccount.get(contribution.accountId)??0)+total);}contributionsByAccount.set(reserveAccount.id,(contributionsByAccount.get(reserveAccount.id)??0)+reserveContribution);if(taxableAccount)contributionsByAccount.set(taxableAccount.id,(contributionsByAccount.get(taxableAccount.id)??0)+plannedTaxable);
    const accountActivity={};for(const account of model.accounts){if(account.id===cashAccount.id)continue;const opening=accountState.get(account.id),contributions=contributionsByAccount.get(account.id)??0,growth=applyRate(opening+Math.round(contributions/2),account.annualReturn??0),closing=opening+contributions+growth;accountState.set(account.id,closing);accountActivity[account.id]={openingBalanceCents:opening,contributionsCents:contributions,withdrawalsCents:0,growthCents:growth,closingBalanceCents:closing};}
    accountState.set(cashAccount.id,available);accountActivity[cashAccount.id]={openingBalanceCents:openingCash,contributionsCents:sumCents(cashSources.map(s=>s.amountCents)),withdrawalsCents:sumCents(cashUses.map(u=>u.amountCents)),growthCents:cashInterest,closingBalanceCents:available};
    const reserve=emergencyReserveStatus({annualEssentialSpendingCents:spending.essentialCents,actualReserveCents:accountState.get(reserveAccount.id),reserveMonths:model.policies.reserveMonths??6});
    const grossAssets=sumCents([...accountState.values()])+openingAssets,totalLiabilities=sumCents([...liabilityState.values()]),netWorth=grossAssets-totalLiabilities;
    const employerContributions=sumCents(retirement.map(r=>r.employerAutomaticCents+r.employerMatchCents)),investmentGrowth=sumCents(model.accounts.filter(a=>a.type.includes('Investment')).map(a=>accountActivity[a.id]?.growthCents??0)),reserveInterest=accountActivity[reserveAccount.id]?.growthCents??0,debtInterest=sumCents(liabilityChanges.map(l=>l.interestCents)),debtPrincipal=sumCents(liabilityChanges.map(l=>l.principalPaidCents));
    const compensationCash=sumCents(records.map(r=>r.taxableCents+r.nontaxableCents));
    const components=[{type:'retainedHouseholdSurplus',economicEffectCents:compensationCash-taxes.totalTaxCents-spending.totalCents-debtInterest},{type:'employeeContributions',economicEffectCents:0,transferCents:employeeRetirement},{type:'employerGovernmentContributions',economicEffectCents:employerContributions},{type:'investmentGrowth',economicEffectCents:investmentGrowth},{type:'cashReserveInterest',economicEffectCents:cashInterest+reserveInterest},{type:'debtPrincipalReduction',economicEffectCents:0,transferCents:debtPrincipal},{type:'oneTimeTransfers',economicEffectCents:0},{type:'otherValuationChanges',economicEffectCents:0}];
    const decomposition=reconcileNetWorthChange({year,openingNetWorthCents:openingNetWorth,closingNetWorthCents:netWorth,components});
    const cashReconciliation=reconcileCash({year,openingCashCents:openingCash,sources:cashSources,uses:cashUses,actualClosingCashCents:available}),balanceSheetReconciliation=reconcileBalanceSheet({year,accountValuesCents:[...accountState.values()],assetValuesCents:model.assets.map(a=>a.valueCents??0),liabilityValuesCents:[...liabilityState.values()],reportedGrossAssetsCents:grossAssets,reportedLiabilitiesCents:totalLiabilities,reportedNetWorthCents:netWorth});
    for(const event of planned.filter(e=>Number(e.resolvedDate.slice(0,4))===year))realizedEvents.push(realizeEvent(event,event.resolvedDate));
    if(cashReconciliation.warning)warnings.push(cashReconciliation.warning);if(balanceSheetReconciliation.warning)warnings.push(balanceSheetReconciliation.warning);if(decomposition.warning)warnings.push(decomposition.warning);
    const liquidAssets=sumCents(model.accounts.filter(a=>['generalCash','emergencyReserve','taxableInvestment'].includes(a.type)).map(a=>accountState.get(a.id))),investable=sumCents(model.accounts.filter(a=>['taxableInvestment','retirementInvestment'].includes(a.type)).map(a=>accountState.get(a.id)));
    results.push({year,ages:Object.fromEntries(people.map(p=>[p.id,ageOnDate(p,`${year}-12-31`)])),careers:activeCareerStages(model.careers,year).map(s=>({personId:s.personId,type:s.careerType,role:s.role})),householdState,reportingUnits:reportingUnits({people,combined:householdState.combined,records,spending,accountState,liabilityState,accounts:model.accounts,liabilities:model.liabilities}),income:{records,militaryTaxableCents:sumCents(records.filter(r=>r.type==='military').map(r=>r.taxableCents)),militaryNontaxableCents:sumCents(records.filter(r=>r.type==='military').map(r=>r.nontaxableCents)),physicianCents:sumCents(records.filter(r=>r.type==='physician').map(r=>r.taxableCents)),otherEmploymentCents:sumCents(records.filter(r=>r.type==='employment').map(r=>r.taxableCents)),pensionCents:sumCents(records.filter(r=>r.type==='pension').map(r=>r.taxableCents)),cashCompensationCents:compensationCash,taxableCompensationCents:sumCents(records.map(r=>r.taxableCents))},taxes,spending,allocation:{policy:BASELINE_ALLOCATION_POLICY,reserveRestorationCents:reserveContribution,taxableInvestmentCents:plannedTaxable,employeeRetirementCents:employeeRetirement,employerGovernmentRetirementCents:employerContributions,retainedCashCents:available},retirement,accountActivity,debt:{changes:liabilityChanges,interestCents:debtInterest,principalCents:debtPrincipal,closingCents:totalLiabilities},reserve,balanceSheet:{grossAssetsCents:grossAssets,totalLiabilitiesCents:totalLiabilities,netWorthCents:netWorth,liquidNetWorthCents:liquidAssets-totalLiabilities,investableNetWorthCents:investable},openingBalances:{accounts:openingAccounts,liabilities:openingLiabilities},closingBalances:{accounts:Object.fromEntries(accountState),liabilities:Object.fromEntries(liabilityState)},reconciliation:{cash:cashReconciliation,balanceSheet:balanceSheetReconciliation,netWorthChange:decomposition}});
  }
  if(JSON.stringify(model)!==JSON.stringify(before))throw new Error('Household simulation mutated model input.');
  return{years:results,realizedEvents,decisions:[],warnings,errors:[],metadata:{valid:true,schemaVersion:model.schemaVersion,modelVersion:model.modelVersion,baseCurrencyYear:model.baseCurrencyYear,deterministic:true,allocationPolicy:BASELINE_ALLOCATION_POLICY}};
}
