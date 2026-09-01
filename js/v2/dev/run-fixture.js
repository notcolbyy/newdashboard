import { FEDERAL_TAX_2026, simulate } from '../index.js';
import { minimalLifeFixture } from '../tests/fixtures.js';

const result=simulate(minimalLifeFixture(),{taxTables:{2026:FEDERAL_TAX_2026,2027:FEDERAL_TAX_2026}});
console.table(result.years.map(row=>({year:row.year,openingCash:row.reconciliation.cash.openingCashCents,sources:row.reconciliation.cash.sourcesCents,uses:row.reconciliation.cash.usesCents,closingCash:row.reconciliation.cash.actualClosingCashCents,netWorth:row.balanceSheet.netWorthCents,reconciled:row.reconciliation.cash.passes&&row.reconciliation.balanceSheet.passes})));
console.log(JSON.stringify({metadata:result.metadata,warnings:result.warnings,realizedEvents:result.realizedEvents},null,2));
