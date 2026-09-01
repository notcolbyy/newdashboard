import { dollarsToCents } from './money.js';

export function progressiveTax(taxableIncomeCents, brackets) {
  let tax=0;
  for(const [lowerDollars,upperDollars,rate] of brackets){
    const lower=dollarsToCents(lowerDollars),upper=upperDollars===null?Infinity:dollarsToCents(upperDollars);
    const amount=Math.max(0,Math.min(taxableIncomeCents,upper)-lower);
    tax+=Math.round(amount*rate);
  }
  return tax;
}

export function calculateFederalTaxes({filingStatus,earners,table}) {
  if(!table.standardDeduction[filingStatus]||!table.brackets[filingStatus]) throw new TypeError(`Unsupported filing status: ${filingStatus}`);
  const grossIncomeCents=earners.reduce((sum,e)=>sum+(e.taxableIncomeCents??e.wagesCents??0),0);
  const pretaxRetirementCents=earners.reduce((sum,e)=>sum+(e.pretaxRetirementCents??0),0);
  const taxableIncomeCents=Math.max(0,grossIncomeCents-pretaxRetirementCents-dollarsToCents(table.standardDeduction[filingStatus]));
  const federalIncomeTaxCents=progressiveTax(taxableIncomeCents,table.brackets[filingStatus]);
  const socialSecurityTaxCents=earners.reduce((sum,e)=>sum+Math.round(Math.min(e.socialSecurityWagesCents??e.wagesCents??0,dollarsToCents(table.payroll.socialSecurityWageBase))*table.payroll.socialSecurityRate),0);
  const medicareWagesCents=earners.reduce((sum,e)=>sum+(e.medicareWagesCents??e.wagesCents??0),0);
  const medicareTaxCents=Math.round(medicareWagesCents*table.payroll.medicareRate);
  const additionalThreshold=dollarsToCents(table.payroll.additionalMedicareThreshold[filingStatus]);
  const additionalMedicareTaxCents=Math.round(Math.max(0,medicareWagesCents-additionalThreshold)*table.payroll.additionalMedicareRate);
  return {grossIncomeCents,pretaxRetirementCents,taxableIncomeCents,federalIncomeTaxCents,socialSecurityTaxCents,medicareTaxCents,additionalMedicareTaxCents,totalTaxCents:federalIncomeTaxCents+socialSecurityTaxCents+medicareTaxCents+additionalMedicareTaxCents,provenanceIds:[table.provenanceId,table.payroll.provenanceId]};
}
