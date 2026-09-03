import { simulateFinancialLife } from './financial-life.js';
import { FINAL_MODEL_VERSION, OUTPUT_CONTRACT_VERSION, SCHEMA_VERSION } from '../storage/schema.js';
import { buildDataManifest } from '../data/data-manifest.js';
import { modelFingerprint, stableFingerprint } from '../storage/canonical.js';

export const ENGINE_VERSION='v2.0.1';
export const REPLAY_GUARANTEE='Identical canonical input and normalized data reproduce identical financial output within the same supported engine and model version.';

export function resultFingerprint(result){return stableFingerprint({metadata:{schemaVersion:result.metadata.schemaVersion,modelVersion:result.metadata.modelVersion,baseCurrencyYear:result.metadata.baseCurrencyYear,deterministic:result.metadata.deterministic},years:result.years,timeline:result.timeline,timelineDeltas:result.timelineDeltas,realizedEvents:result.realizedEvents,decisions:result.decisions,goalResults:result.goalResults,goals:result.goals,warnings:result.warnings,errors:result.errors,invariants:result.invariants});}

export function createRunManifest({model,dataManifest,result,generatedAt=new Date().toISOString()}){
  const inputHash=modelFingerprint(model),dataHash=dataManifest.fingerprint,outputHash=resultFingerprint(result),startYear=model.household.simulationStartYear,endYear=model.household.simulationEndYear;
  const assumptionInputs={assumptions:model.assumptions??{},policies:model.policies??{},accountReturns:(model.accounts??[]).map(({id,annualReturn,returnProvenanceId})=>({id,annualReturn,returnProvenanceId})),careerCompensation:(model.careers??[]).map(({id,compensationRule,provenanceIds})=>({id,compensationRule,provenanceIds})),propertyIntents:model.propertyIntents??[],goals:model.goals??[]};
  return{runId:`run:${inputHash.slice(-16)}:${dataHash.slice(-16)}`,generatedAt,engineVersion:ENGINE_VERSION,modelVersion:model.modelVersion,schemaVersion:model.schemaVersion,outputContractVersion:OUTPUT_CONTRACT_VERSION,inputHash,assumptionsHash:stableFingerprint(assumptionInputs),dataFingerprint:dataHash,dataManifest,baseCurrencyYear:model.baseCurrencyYear,startYear,endYear,deterministic:true,outputHash};
}

export function simulateReproducibly(model,{data,taxTables,generatedAt}={}){const result=simulateFinancialLife(model,{data,taxTables});if(!result.metadata.valid)return{result,manifest:null};const dataManifest=buildDataManifest(data,taxTables),manifest=createRunManifest({model,dataManifest,result,generatedAt});result.metadata={...result.metadata,engineVersion:ENGINE_VERSION,outputContractVersion:OUTPUT_CONTRACT_VERSION,runManifest:manifest};return{result,manifest};}

export function replaySimulation({model,data,taxTables,expectedManifest}){
  if(!expectedManifest)return{status:'INVALID_REPLAY_REQUEST',matches:false,issues:[{code:'EXPECTED_MANIFEST_REQUIRED'}]};
  const supported=expectedManifest.engineVersion===ENGINE_VERSION&&expectedManifest.modelVersion===model.modelVersion&&expectedManifest.schemaVersion===SCHEMA_VERSION;
  if(!supported)return{status:'UNSUPPORTED_VERSION',matches:false,issues:[{code:'REPLAY_VERSION_UNSUPPORTED',expected:{engineVersion:expectedManifest.engineVersion,modelVersion:expectedManifest.modelVersion,schemaVersion:expectedManifest.schemaVersion},actual:{engineVersion:ENGINE_VERSION,modelVersion:model.modelVersion,schemaVersion:SCHEMA_VERSION}}]};
  const {result,manifest}=simulateReproducibly(model,{data,taxTables,generatedAt:expectedManifest.generatedAt});const checks={inputFingerprint:manifest.inputHash===expectedManifest.inputHash,dataFingerprint:manifest.dataFingerprint===expectedManifest.dataFingerprint,outputFingerprint:manifest.outputHash===expectedManifest.outputHash};return{status:Object.values(checks).every(Boolean)?'MATCH':'MISMATCH',matches:Object.values(checks).every(Boolean),checks,manifest,result,guarantee:REPLAY_GUARANTEE};
}

export function assertFinalModelVersion(model){return model.modelVersion===FINAL_MODEL_VERSION;}
