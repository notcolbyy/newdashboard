import { createAssetRecord, transitionAsset } from './assets.js';

const daysInYear=year=>(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
export function fractionOfYear(startDate,endDate,year){const start=Math.max(Date.parse(`${year}-01-01T00:00:00Z`),Date.parse(`${startDate}T00:00:00Z`)),end=Math.min(Date.parse(`${year+1}-01-01T00:00:00Z`),Date.parse(`${endDate}T00:00:00Z`));return Math.max(0,end-start)/86400000/daysInYear(year);}

export function createPropertyRecord(input){
  const asset=createAssetRecord({...input,type:'property',liquidity:'illiquid',wealthRole:input.wealthRole??(input.status==='rental'?'productive':'personal-use')});
  return {...asset,locationKey:input.locationKey??null,purchasePriceCents:input.purchasePriceCents??0,downPaymentCents:input.downPaymentCents??0,financedAmountCents:input.financedAmountCents??0,buyerClosingCostsCents:input.buyerClosingCostsCents??0,initialSetupCostsCents:input.initialSetupCostsCents??0,operations:structuredClone(input.operations??{}),propertyReserve:structuredClone(input.propertyReserve??{balanceCents:0,months:6}),sale:structuredClone(input.sale??null)};
}

export function transitionProperty(property,input){return transitionAsset(property,input);}

export function appreciateProperty({openingValueCents,annualRate,ownershipFraction=1}){const appreciationCents=Math.round(openingValueCents*((1+annualRate)**ownershipFraction-1));return{openingValueCents,annualRate,ownershipFraction,appreciationCents,closingValueCents:openingValueCents+appreciationCents};}

export function rentalOperatingStatement({monthlyRentCents,rentGrowthRate=0,baseYear,year,rentalFraction=1,vacancyRate=0,propertyTaxCents=0,insuranceCents=0,hoaCents=0,maintenanceRate=0,capexRate=0,managementRate=0,mortgageDebtServiceCents=0}){
  const annualScheduled=Math.round(monthlyRentCents*12*(1+rentGrowthRate)**Math.max(0,year-baseYear)*rentalFraction),vacancyLossCents=Math.round(annualScheduled*vacancyRate),effectiveRentCents=annualScheduled-vacancyLossCents;
  const scaled=n=>Math.round(n*rentalFraction),tax=scaled(propertyTaxCents),insurance=scaled(insuranceCents),hoa=scaled(hoaCents),maintenance=Math.round(annualScheduled*maintenanceRate),capex=Math.round(annualScheduled*capexRate),management=Math.round(effectiveRentCents*managementRate),operatingExpensesCents=tax+insurance+hoa+maintenance+capex+management,netOperatingIncomeCents=effectiveRentCents-operatingExpensesCents,cashFlowAfterFinancingCents=netOperatingIncomeCents-mortgageDebtServiceCents;
  return{grossScheduledRentCents:annualScheduled,vacancyLossCents,effectiveRentCents,propertyTaxCents:tax,insuranceCents:insurance,hoaCents:hoa,maintenanceCents:maintenance,capexCents:capex,managementCents:management,operatingExpensesCents,netOperatingIncomeCents,mortgageDebtServiceCents,cashFlowAfterFinancingCents,householdSubsidyCents:Math.max(0,-cashFlowAfterFinancingCents),rentalFraction};
}

export function primaryResidenceCosts({ownershipFraction=1,propertyTaxCents=0,insuranceCents=0,hoaCents=0,maintenanceCents=0,mortgageDebtServiceCents=0}){const scaled=n=>Math.round(n*ownershipFraction),nonMortgageCents=scaled(propertyTaxCents)+scaled(insuranceCents)+scaled(hoaCents)+scaled(maintenanceCents);return{ownershipFraction,propertyTaxCents:scaled(propertyTaxCents),insuranceCents:scaled(insuranceCents),hoaCents:scaled(hoaCents),maintenanceCents:scaled(maintenanceCents),nonMortgageCents,mortgageDebtServiceCents,totalCashCostCents:nonMortgageCents+mortgageDebtServiceCents};}

export function propertyReserveStatus({operatingExpensesCents,debtServiceCents,balanceCents,reserveMonths=6}){const requiredCents=Math.round((operatingExpensesCents+debtServiceCents)*reserveMonths/12),difference=balanceCents-requiredCents;return{reserveMonths,requiredCents,actualCents:balanceCents,shortfallCents:Math.max(0,-difference),surplusCents:Math.max(0,difference),status:difference>=0?'adequate':'shortfall'};}
export function propertyEquity({marketValueCents,debtCents}){return{marketValueCents,debtCents,equityCents:marketValueCents-debtCents};}

export function calculatePropertySale({carryingValueCents,salePriceCents=carryingValueCents,sellerCostRate=0,mortgagePayoffCents=0,reserveReleaseCents=0}){const sellingCostsCents=Math.round(salePriceCents*sellerCostRate),netSaleProceedsCents=salePriceCents-sellingCostsCents-mortgagePayoffCents+reserveReleaseCents;return{carryingValueCents,salePriceCents,sellingCostsCents,mortgagePayoffCents,reserveReleaseCents,netSaleProceedsCents,saleValuationDifferenceCents:salePriceCents-carryingValueCents};}

