export function buildPriceIndex(config, throughYear) {
  if (!config?.known?.[config.baseYear]) throw new TypeError('Price index requires its base year.');
  const result=structuredClone(config.known);
  for (const [year,entry] of Object.entries(result)) if (!Number.isFinite(entry.value)||entry.value<=0) throw new TypeError(`Invalid price index for ${year}.`);
  const latestKnown=Math.max(...Object.keys(result).map(Number));
  for(let year=latestKnown+1;year<=throughYear;year++){
    const rate=typeof config.futureAnnualInflation==='object' ? (config.futureAnnualInflation[year]??config.futureAnnualInflation.default) : config.futureAnnualInflation;
    if(!Number.isFinite(rate)||rate<=-1) throw new TypeError(`Invalid future inflation for ${year}.`);
    result[year]={value:result[year-1].value*(1+rate),state:'projected',provenanceId:config.futureProvenanceId,derivedFromYear:year-1};
  }
  return Object.freeze(result);
}

export function convertCurrency({amountCents,fromYear,toYear,index}) {
  if (!Number.isSafeInteger(amountCents)) throw new TypeError('Currency amount must be integer cents.');
  const from=index[fromYear]?.value,to=index[toYear]?.value;
  if (!Number.isFinite(from)||from<=0||!Number.isFinite(to)||to<=0) throw new TypeError(`Missing or invalid price index for ${fromYear}/${toYear}.`);
  return Math.round(amountCents*to/from);
}

export const nominalToReal=(amountCents,year,baseYear,index)=>convertCurrency({amountCents,fromYear:year,toYear:baseYear,index});
export const realToNominal=(amountCents,baseYear,year,index)=>convertCurrency({amountCents,fromYear:baseYear,toYear:year,index});
