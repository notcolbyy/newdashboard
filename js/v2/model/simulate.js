import { buildSimulationYears, resolvePeople } from './calendar.js';
import { resolvePlannedEvents, realizeEvent } from './events.js';
import { calculateFederalTaxes } from './tax.js';
import { applyRate, sumCents } from './money.js';
import { reconcileCash, reconcileBalanceSheet } from './reconciliation.js';
import { validateModelDocument } from '../storage/schema.js';

const ACTIVE=(entry,year)=>year>=entry.startYear&&year<=(entry.endYear??year);

export function simulate(model,{taxTables={}}={}){
  const validation=validateModelDocument(model);if(!validation.valid)return{years:[],realizedEvents:[],decisions:[],warnings:validation.warnings,errors:validation.errors,metadata:{valid:false}};
  const originalEvents=JSON.stringify(model.plannedEvents),people=resolvePeople(model.people),years=buildSimulationYears(model),planned=resolvePlannedEvents(model.plannedEvents,people);
  const accountState=new Map(model.accounts.map(a=>[a.id,a.openingBalanceCents]));
  const liabilityState=new Map(model.liabilities.map(l=>[l.id,l.openingBalanceCents]));
  const results=[],realizedEvents=[],warnings=[...validation.warnings];
  for(const year of years){
    const openingAccounts=Object.fromEntries(accountState),openingLiabilities=Object.fromEntries(liabilityState);
    const cashAccount=model.accounts.find(a=>a.type==='generalCash');if(!cashAccount)throw new TypeError('A generalCash account is required.');
    const cashSources=model.income.filter(e=>ACTIVE(e,year)).map(e=>({id:e.id,type:e.type??'income',amountCents:e.amountCents,taxable:e.taxable!==false,ownerId:e.ownerId}));
    const cashUses=model.spending.filter(e=>ACTIVE(e,year)).map(e=>({id:e.id,type:e.type??'spending',amountCents:e.amountCents}));
    const yearEvents=planned.filter(e=>Number(e.resolvedDate.slice(0,4))===year);for(const event of yearEvents)realizedEvents.push(realizeEvent(event,event.resolvedDate));
    const earners=people.map(person=>({wagesCents:cashSources.filter(s=>s.ownerId===person.id&&s.taxable).reduce((n,s)=>n+s.amountCents,0),taxableIncomeCents:cashSources.filter(s=>s.ownerId===person.id&&s.taxable).reduce((n,s)=>n+s.amountCents,0),pretaxRetirementCents:0}));
    const taxTable=taxTables[year];const taxes=taxTable?calculateFederalTaxes({filingStatus:model.household.filingStatus,earners,table:taxTable}):null;if(taxes)cashUses.push({id:`tax:${year}`,type:'tax',amountCents:taxes.totalTaxCents});
    const accountActivity={};for(const account of model.accounts){const opening=accountState.get(account.id),contributions=(account.contributions??[]).filter(e=>e.year===year).reduce((s,e)=>s+e.amountCents,0),withdrawals=(account.withdrawals??[]).filter(e=>e.year===year).reduce((s,e)=>s+e.amountCents,0),growth=account.type.includes('investment')||account.type==='emergencyReserve'?applyRate(opening+Math.round(contributions/2)-Math.round(withdrawals/2),account.annualReturn??0):0;const closing=opening+contributions-withdrawals+growth;accountState.set(account.id,closing);accountActivity[account.id]={openingBalanceCents:opening,contributionsCents:contributions,withdrawalsCents:withdrawals,growthCents:growth,closingBalanceCents:closing};if(account.id!==cashAccount.id){if(contributions)cashUses.push({id:`contribution:${account.id}`,type:'accountContribution',amountCents:contributions});if(withdrawals)cashSources.push({id:`withdrawal:${account.id}`,type:'accountWithdrawal',amountCents:withdrawals,taxable:false});}}
    const openingCash=accountState.get(cashAccount.id); // no direct cash growth in M1
    const expectedClosingCash=openingCash+sumCents(cashSources.map(e=>e.amountCents))-sumCents(cashUses.map(e=>e.amountCents));accountState.set(cashAccount.id,expectedClosingCash);accountActivity[cashAccount.id]={openingBalanceCents:openingCash,contributionsCents:sumCents(cashSources.map(e=>e.amountCents)),withdrawalsCents:sumCents(cashUses.map(e=>e.amountCents)),growthCents:0,closingBalanceCents:expectedClosingCash};
    const assetValuesCents=model.assets.filter(a=>ACTIVE(a,year)).map(a=>a.valueCents),grossAssetsCents=sumCents([...accountState.values(),...assetValuesCents]),totalLiabilitiesCents=sumCents([...liabilityState.values()]),netWorthCents=grossAssetsCents-totalLiabilitiesCents;
    const cashReconciliation=reconcileCash({year,openingCashCents:openingCash,sources:cashSources,uses:cashUses,actualClosingCashCents:accountState.get(cashAccount.id)});
    const balanceSheetReconciliation=reconcileBalanceSheet({year,accountValuesCents:[...accountState.values()],assetValuesCents,liabilityValuesCents:[...liabilityState.values()],reportedGrossAssetsCents:grossAssetsCents,reportedLiabilitiesCents:totalLiabilitiesCents,reportedNetWorthCents:netWorthCents});
    if(cashReconciliation.warning)warnings.push(cashReconciliation.warning);if(balanceSheetReconciliation.warning)warnings.push(balanceSheetReconciliation.warning);
    results.push({year,openingBalances:{accounts:openingAccounts,liabilities:openingLiabilities},cashSources,cashUses,accountActivity,assetChanges:[],liabilityChanges:[],closingBalances:{accounts:Object.fromEntries(accountState),liabilities:Object.fromEntries(liabilityState)},taxes,balanceSheet:{grossAssetsCents,totalLiabilitiesCents,netWorthCents},reconciliation:{cash:cashReconciliation,balanceSheet:balanceSheetReconciliation}});
  }
  if(JSON.stringify(model.plannedEvents)!==originalEvents)throw new Error('Simulation mutated planned events.');
  return{years:results,realizedEvents,decisions:[],warnings,errors:[],metadata:{valid:true,schemaVersion:model.schemaVersion,modelVersion:model.modelVersion,baseCurrencyYear:model.baseCurrencyYear,deterministic:true}};
}
