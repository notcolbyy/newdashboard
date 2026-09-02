export function reconcileNetWorthChange({ year, openingNetWorthCents, closingNetWorthCents, components, toleranceCents=1 }) {
  const explainedChangeCents=components.reduce((s,c)=>s+c.economicEffectCents,0), actualChangeCents=closingNetWorthCents-openingNetWorthCents, differenceCents=actualChangeCents-explainedChangeCents;
  return {year,openingNetWorthCents,closingNetWorthCents,actualChangeCents,explainedChangeCents,differenceCents,passes:Math.abs(differenceCents)<=toleranceCents,components,warning:Math.abs(differenceCents)<=toleranceCents?null:{code:'NET_WORTH_DECOMPOSITION_FAILED',year,differenceCents,components}};
}

