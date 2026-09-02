import { simulateHousehold } from '../index.js';
import { goldenHouseholdFixture } from '../tests/golden-household-fixture.js';

const dollars=cents=>Math.round(cents/100),fixture=goldenHouseholdFixture(),result=simulateHousehold(fixture.model,{data:fixture.data,taxTables:fixture.taxTables});
const career=(year,personId)=>year.careers.filter(c=>c.personId===personId).map(c=>c.role).join(' / ')||'Education';
console.table(result.years.map(y=>({
  Year:y.year,'Age A':y.ages.jag,'Age B':y.ages.physician,'Career A':career(y,'jag'),'Career B':career(y,'physician'),
  'Gross comp':dollars(y.income.cashCompensationCents),'Taxable comp':dollars(y.income.taxableCompensationCents),Taxes:dollars(y.taxes.totalTaxCents),Spending:dollars(y.spending.totalCents),'Debt service':dollars(y.debt.interestCents+y.debt.principalCents),'Retirement contrib':dollars(y.allocation.employeeRetirementCents+y.allocation.employerGovernmentRetirementCents),'Taxable investing':dollars(y.allocation.taxableInvestmentCents),'Closing cash':dollars(y.closingBalances.accounts.cash),'Closing investments':dollars(y.balanceSheet.investableNetWorthCents),'Closing debt':dollars(y.debt.closingCents),'Net worth':dollars(y.balanceSheet.netWorthCents),'Liquid NW':dollars(y.balanceSheet.liquidNetWorthCents)
})));

const selectedYear=Number(process.argv.find(a=>a.startsWith('--year='))?.split('=')[1]??2032),detail=result.years.find(y=>y.year===selectedYear);
if(!detail)throw new TypeError(`Year ${selectedYear} is outside the fixture.`);
console.log(`\nDetailed year: ${selectedYear}`);
console.dir({compensation:detail.income.records,taxes:detail.taxes,spending:detail.spending.entries,accounts:detail.accountActivity,debt:detail.debt,reserve:detail.reserve,netWorthDecomposition:detail.reconciliation.netWorthChange,events:result.realizedEvents.filter(e=>Number(e.actualDate.slice(0,4))===selectedYear),warnings:result.warnings.filter(w=>w.year===selectedYear)},{depth:null});
console.log('\nMetadata');console.dir(result.metadata,{depth:null});
