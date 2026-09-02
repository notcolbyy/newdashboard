import { dollarsToCents } from '../model/money.js';
import { PROPERTY_PLANNING_DEFAULTS } from '../data/property-defaults.js';

const d=dollarsToCents;
export function goldenPropertyFixture(){
  const years=Array.from({length:10},(_,i)=>2030+i),annualFree=Object.fromEntries(years.map(y=>[y,y===2030?d(16000):d(70000)])),emergency=Object.fromEntries(years.map(y=>[y,d(30000)])),housing=Object.fromEntries(years.map(y=>[y,d(24000)]));
  return{
    schemaVersion:'2.0.0',modelVersion:'2.0.0-m3',baseCurrencyYear:2025,
    propertySimulation:{startYear:2030,endYear:2039,openingCashCents:d(56000),emergencyReserveActualCents:d(30000),emergencyReserveRequiredByYear:emergency,openingTaxableInvestmentsCents:d(50000),openingRetirementInvestmentsCents:d(100000),annualHouseholdFreeCashFlowByYear:annualFree,genericHousingSpendingByYear:housing,appreciationRate:PROPERTY_PLANNING_DEFAULTS.appreciationRate,sellerTransactionCostRate:PROPERTY_PLANNING_DEFAULTS.sellerTransactionCostRate},
    propertyIntents:[{id:'duty-home-intent',propertyId:'duty-home',name:'Duty-station home',desiredYear:2030,earliestAcceptableYear:2030,latestAcceptableYear:2032,enabled:true,propertyRole:'primaryResidence',locationKey:'FIXTURE-AFB',ownership:[{ownerId:'jag',share:.5},{ownerId:'physician',share:.5}],expectedPriceCents:d(300000),downPaymentCents:d(60000),financedAmountCents:d(240000),buyerClosingCostsCents:d(9000),initialSetupCostsCents:d(3000),initialPropertyReserveCents:d(12800),propertyReserveMonths:6,mortgageId:'duty-home-mortgage',mortgageRate:.05,mortgageTermMonths:360,estimatedAnnualDebtServiceCents:d(15500),minimumPostPurchaseFreeCashFlowCents:0,fundingPolicy:{sources:['generalCash'],allowTaxableInvestments:false},operations:{baseYear:2031,monthlyRentCents:d(3000),rentGrowthRate:.025,vacancyRate:.05,propertyTaxCents:d(3600),insuranceCents:d(1800),hoaCents:d(1200),maintenanceRate:.01,capexRate:.005,managementRate:.08,primaryMaintenanceCents:d(3000)},provenanceIds:['planning.property.defaults.m3']}],
    plannedEvents:[
      {id:'expected-condo-transfer',type:'asset.transfer.expected',date:'2032-01-01',provenanceIds:['user.expectedPropertyTransfer'],property:{id:'expected-condo',name:'Expected paid-off condo',estimatedValueCents:d(200000),ownership:[{ownerId:'jag',share:1}],initialStatus:'other',wealthRole:'personal-use',locationKey:'UNSET'}},
      {id:'pcs-conversion',type:'property.convertToRentalIntent',propertyId:'duty-home',date:'2034-07-01',preferenceSensitive:false},
      {id:'duty-home-sale',type:'property.saleIntent',propertyId:'duty-home',date:'2038-07-01',sellerCostRate:.06}
    ]
  };
}
