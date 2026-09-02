import { simulatePropertyLifecycle } from '../index.js';
import { goldenPropertyFixture } from '../tests/golden-property-fixture.js';

const d=c=>Math.round(c/100),result=simulatePropertyLifecycle(goldenPropertyFixture());
console.table(result.annualResults.map(y=>({Year:y.year,Cash:d(y.closing.cashCents),Properties:y.portfolio.propertyCount,Primary:y.portfolio.primaryResidenceCount,Rentals:y.portfolio.rentalCount,'Property value':d(y.portfolio.grossPropertyValueCents),'Property debt':d(y.portfolio.propertyDebtCents),Equity:d(y.portfolio.realEstateEquityCents),'Effective rent':d(y.portfolio.effectiveRentCents),NOI:d(y.portfolio.netOperatingIncomeCents),'Rental cash flow':d(y.portfolio.cashFlowAfterFinancingCents),'Property reserves':d(y.portfolio.propertyReserveCents),'Net worth':d(y.closing.netWorthCents),Decisions:y.decisions.map(x=>`${x.intentId??x.id}:${x.status}`).join(', '),Reconciled:y.reconciliation.cash.passes&&y.reconciliation.balanceSheet.passes&&y.reconciliation.netWorthChange.passes})));
const selected=Number(process.argv.find(a=>a.startsWith('--year='))?.split('=')[1]??2034),year=result.annualResults.find(y=>y.year===selected);if(!year)throw new TypeError(`Year ${selected} is outside the fixture.`);
console.log(`\nDetailed property year: ${selected}`);console.dir({decisions:year.decisions,events:year.realizedEvents,properties:year.propertyResults,portfolio:year.portfolio,cashSources:year.cashSources,cashUses:year.cashUses,decomposition:year.reconciliation.netWorthChange,warnings:result.warnings.filter(w=>w.year===selected)},{depth:null});
console.log('\nLifecycle metadata');console.dir(result.metadata,{depth:null});

