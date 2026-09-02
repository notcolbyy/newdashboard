export const EVENT_PHASES=Object.freeze({
  periodStart:10,householdStatus:20,career:30,propertyStatus:40,compensation:50,
  retirement:60,tax:70,spending:80,debt:90,reserves:100,propertyDecision:110,
  goalDecision:120,execution:130,allocation:140,growth:150,valuation:160,close:170
});

export const MONTHLY_SUBPERIOD_RULES=Object.freeze({
  annualOutput:true,
  monthlyUses:['career transition','military accession or promotion','BRS eligibility','mortgage amortization','property purchase or sale','rental conversion and partial-year rent'],
  annualUses:['tax settlement','spending schedules','reserve rules','account growth','balance-sheet reporting'],
  rollup:'Monthly records are summed into integer-cent annual totals; closing monthly state becomes the annual closing state.'
});

export const WITHIN_YEAR_ORDER=Object.freeze([
  'carryForward','calendarAndService','startEvents','careerTransitions','compensation',
  'propertyStatusTransitions','propertyOperations','retirement','taxes','spending','debtService',
  'preGoalFreeCashFlow','householdReserves','propertyReserves','propertyDecisions','goalDecisions',
  'executeDecisions','remainingCashAllocation','investmentGrowth','propertyAppreciation',
  'otherValuation','closeLiabilities','closeState','cashReconciliation','balanceSheetReconciliation',
  'netWorthDecomposition','explanations','recordClosingState'
]);

const inferredPhase=event=>{
  const type=event.type??'';
  if(type.startsWith('household.')||type.startsWith('tax.filing'))return EVENT_PHASES.householdStatus;
  if(type.startsWith('career.')||type.includes('promotion'))return EVENT_PHASES.career;
  if(type.includes('convert')||type.includes('PCS')||type.includes('pcs'))return EVENT_PHASES.propertyStatus;
  if(type.includes('sale')||type.includes('purchase')||type.includes('transfer'))return EVENT_PHASES.execution;
  if(type.startsWith('goal.'))return EVENT_PHASES.goalDecision;
  return EVENT_PHASES.startEvents;
};

export function orderEvents(events){
  return [...events].map((event,index)=>({...structuredClone(event),_inputIndex:index})).sort((a,b)=>
    String(a.effectiveDate??a.resolvedDate??a.date).localeCompare(String(b.effectiveDate??b.resolvedDate??b.date))||
    (a.phase??inferredPhase(a))-(b.phase??inferredPhase(b))||
    (a.priority??0)-(b.priority??0)||
    (a.sequence??0)-(b.sequence??0)||
    String(a.id).localeCompare(String(b.id))
  ).map(({_inputIndex,...event})=>event);
}
