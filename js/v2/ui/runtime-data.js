import { FEDERAL_TAX_2026, PRICE_INDEX, BRS_RULES, projectFederalTaxTable, MILITARY_PAY_2026, OFFICER_BAS, PEDIATRIC_COMPENSATION_BASELINE } from '../index.js';

export function buildRuntimeInputs(model){
  const end=model.household.simulationEndYear,rate=model.assumptions?.futureInflationRate??PRICE_INDEX.futureAnnualInflation;
  const taxTables={};for(let year=2026;year<=end;year++)taxTables[year]=projectFederalTaxTable(FEDERAL_TAX_2026,year,rate);
  return{data:{militaryPay:MILITARY_PAY_2026,officerBas:OFFICER_BAS,bah:{official:{}},physician:PEDIATRIC_COMPENSATION_BASELINE,brsRules:BRS_RULES,priceIndex:{...structuredClone(PRICE_INDEX),futureAnnualInflation:rate}},taxTables};
}
