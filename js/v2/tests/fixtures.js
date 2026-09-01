import { createModelDocument } from '../storage/schema.js';

export function minimalLifeFixture(){return createModelDocument({
  household:{simulationStartYear:2026,simulationEndYear:2027,filingStatus:'single'},
  people:[{id:'reference',isReference:true,birthDate:'2001-04-15'},{id:'partner',ageOffsetFromReference:-2}],
  accounts:[
    {id:'cash',ownerId:'household',type:'generalCash',openingBalanceCents:1_000_000,annualReturn:0},
    {id:'emergency',ownerId:'reference',type:'emergencyReserve',openingBalanceCents:600_000,annualReturn:.02,liquidity:'liquid',protected:true,contributions:[{year:2026,amountCents:120_000}]},
    {id:'taxable',ownerId:'reference',type:'taxableInvestment',openingBalanceCents:2_000_000,annualReturn:.06,liquidity:'liquid',protected:false,contributions:[{year:2026,amountCents:500_000}],withdrawals:[{year:2027,amountCents:100_000}]},
    {id:'retirement',ownerId:'reference',type:'retirementInvestment',openingBalanceCents:1_500_000,annualReturn:.06,liquidity:'restricted',protected:true,contributions:[{year:2026,amountCents:300_000}]}
  ],
  liabilities:[{id:'student-loan',ownerId:'reference',type:'educationDebt',openingBalanceCents:500_000,originalPrincipalCents:500_000}],
  income:[{id:'salary',ownerId:'reference',type:'employment.taxable',amountCents:8_000_000,startYear:2026,endYear:2027,taxable:true},{id:'gift',ownerId:'reference',type:'oneTime.nontaxable',amountCents:100_000,startYear:2026,endYear:2026,taxable:false}],
  spending:[{id:'essential',type:'essential',amountCents:3_000_000,startYear:2026,endYear:2027},{id:'discretionary',type:'discretionary',amountCents:500_000,startYear:2026,endYear:2027}],
  plannedEvents:[{id:'career-start',type:'career.start',personId:'reference',age:25,target:'reference'},{id:'midyear-move',type:'household.move',date:'2026-07-15',target:'household'}]
});}
