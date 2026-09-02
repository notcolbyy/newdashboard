export const DECISION_STATUSES=Object.freeze(['feasible','possible','comfortablyAffordable','executed','completed','delayed','rejected','needsUserChoice']);

export function evaluateReserveDecision({id,availableCents,requiredCents,plannedDate}){
  const pass=availableCents>=requiredCents,shortfallCents=Math.max(0,requiredCents-availableCents);
  return Object.freeze({id,status:pass?'feasible':'delayed',plannedDate,actualDate:pass?plannedDate:null,rules:[{id:'reserveFloor',actualCents:availableCents,requiredCents,pass,shortfallCents,severity:pass?'none':'blocking',explanation:pass?'Required reserves remain funded.':`Purchase delayed because reserves are short by ${shortfallCents} cents.`}]});
}
