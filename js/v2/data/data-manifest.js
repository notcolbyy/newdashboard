import { canonicalize, stableFingerprint } from '../storage/canonical.js';

export const DATASET_VERSIONS=Object.freeze({
  federalTax:'irs-2026-v1',payroll:'ssa-2026-v1',militaryPay:'dfas-officer-2026-v1',bas:'dfas-bas-2026-v1',brs:'dod-tsp-brs-2026-v1',cpi:'bls-cpi-2025base-v1',physician:'pediatrics-planning-2026-v1',planningDefaults:'v2.0-planning-v1'
});

export function buildDataManifest(data={},taxTables={}){
  const taxYears=Object.keys(taxTables).map(Number).filter(Number.isFinite).toSorted((a,b)=>a-b),officialTaxYears=taxYears.filter(year=>taxTables[year]?.state!=='projected'),projectedTaxYears=taxYears.filter(year=>taxTables[year]?.state==='projected'||String(taxTables[year]?.provenanceId).includes(':projected:'));
  const contentFingerprint=stableFingerprint(canonicalize({data,taxTables}));
  const manifest={version:'1.0.0',datasets:{...DATASET_VERSIONS},contentFingerprint,coverage:{taxYears,officialTaxYears,projectedTaxYears,militaryPayYear:data.militaryPay?.year??null,priceIndexBaseYear:data.priceIndex?.baseYear??null},provenanceIds:[data.militaryPay?.provenanceId,...Object.values(data.officerBas??{}).map(x=>x.provenanceId),data.priceIndex?.futureProvenanceId].flat().filter(Boolean).toSorted()};
  return Object.freeze({...manifest,fingerprint:stableFingerprint(canonicalize(manifest))});
}
