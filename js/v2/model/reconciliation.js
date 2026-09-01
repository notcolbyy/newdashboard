import { sumCents, withinTolerance, MONEY_TOLERANCE_CENTS } from './money.js';

export function reconcileCash({year,openingCashCents,sources,uses,actualClosingCashCents,toleranceCents=MONEY_TOLERANCE_CENTS}){
  const sourcesCents=sumCents(sources.map(entry=>entry.amountCents)),usesCents=sumCents(uses.map(entry=>entry.amountCents));
  const expectedClosingCashCents=openingCashCents+sourcesCents-usesCents,differenceCents=actualClosingCashCents-expectedClosingCashCents;
  const passes=withinTolerance(actualClosingCashCents,expectedClosingCashCents,toleranceCents);
  return {passes,warning:passes?null:{code:'CASH_RECONCILIATION_FAILED',year,expectedAmountCents:expectedClosingCashCents,actualAmountCents:actualClosingCashCents,differenceCents,relevantEntries:[...sources,...uses]},openingCashCents,sourcesCents,usesCents,expectedClosingCashCents,actualClosingCashCents,differenceCents,entries:[...sources,...uses]};
}

export function reconcileBalanceSheet({year,accountValuesCents,assetValuesCents,liabilityValuesCents,reportedGrossAssetsCents,reportedLiabilitiesCents,reportedNetWorthCents,toleranceCents=MONEY_TOLERANCE_CENTS}){
  const underlyingGrossAssetsCents=sumCents([...accountValuesCents,...assetValuesCents]),underlyingLiabilitiesCents=sumCents(liabilityValuesCents),expectedNetWorthCents=underlyingGrossAssetsCents-underlyingLiabilitiesCents;
  const grossDifferenceCents=reportedGrossAssetsCents-underlyingGrossAssetsCents,liabilityDifferenceCents=reportedLiabilitiesCents-underlyingLiabilitiesCents,netWorthDifferenceCents=reportedNetWorthCents-expectedNetWorthCents;
  const passes=Math.abs(grossDifferenceCents)<=toleranceCents&&Math.abs(liabilityDifferenceCents)<=toleranceCents&&Math.abs(netWorthDifferenceCents)<=toleranceCents;
  return {passes,warning:passes?null:{code:'BALANCE_SHEET_RECONCILIATION_FAILED',year,expectedAmountCents:expectedNetWorthCents,actualAmountCents:reportedNetWorthCents,differenceCents:netWorthDifferenceCents,relevantEntries:{accountValuesCents,assetValuesCents,liabilityValuesCents}},reportedGrossAssetsCents,underlyingGrossAssetsCents,reportedLiabilitiesCents,underlyingLiabilitiesCents,reportedNetWorthCents,expectedNetWorthCents,grossDifferenceCents,liabilityDifferenceCents,netWorthDifferenceCents};
}
