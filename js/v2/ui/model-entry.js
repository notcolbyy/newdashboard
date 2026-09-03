import { createBaselineModel, loadModel, saveModel, exportModel, importModel, assessSimulationReadiness, validateProductionModel, modelHealthSummary, auditModel, simulateReproducibly, STORAGE_KEYS } from '../index.js';
import { buildRuntimeInputs } from './runtime-data.js';

export function inspectModel(model,{migration=null,simulationWarnings=[]}={}){return{validation:validateProductionModel(model),readiness:assessSimulationReadiness(model),health:modelHealthSummary(model,{migration,simulationWarnings}),audit:auditModel(model)};}

export function createNewModel(){const model=createBaselineModel();return{model,...inspectModel(model),loadState:'VALID_MODEL'};}

export function loadSavedModel(storage){const loaded=loadModel(storage);if(!loaded.ok)return{loadState:loaded.code==='SAVE_NOT_FOUND'?'NO_MODEL':loaded.recovery?.backupAvailable?'BROKEN_WITH_BACKUP':'BROKEN_MODEL',loaded};const inspection=inspectModel(loaded.model,{migration:loaded.migration});return{loadState:loaded.migration?.migrated?'MIGRATED_MODEL':loaded.warnings?.length?'VALID_WITH_WARNINGS':'VALID_MODEL',loaded,model:loaded.model,...inspection};}

export function loadBackupModel(storage){const loaded=loadModel(storage,{key:STORAGE_KEYS.backup,backupKey:STORAGE_KEYS.primary});if(!loaded.ok)return{ok:false,loaded};return{ok:true,loaded,model:loaded.model,...inspectModel(loaded.model,{migration:loaded.migration})};}

export function inspectSimulationResult(model,run,{migration=null}={}){return inspectModel(model,{migration,simulationWarnings:run?.result?.warnings??[]});}

export function prepareImport(text){const result=importModel(text);return{result,candidate:result.ok?result.normalizedModel:null,inspection:result.ok?inspectModel(result.normalizedModel,{migration:result.migration}):null};}

export function persistModel(storage,model,manifest=null){return saveModel(storage,model,{dataManifest:manifest?.dataManifest??null,metadata:{outputContractVersion:manifest?.outputContractVersion??null}});}
export function serializeModelExport(model,manifest=null){return exportModel(model,{dataManifest:manifest?.dataManifest??null,metadata:{runId:manifest?.runId??null},pretty:true});}

export function runReadyModel(model){const readiness=assessSimulationReadiness(model);if(!readiness.ready)return{ran:false,readiness,result:null,manifest:null,error:null};try{const {data,taxTables}=buildRuntimeInputs(model),run=simulateReproducibly(model,{data,taxTables});return{ran:true,readiness,result:run.result,manifest:run.manifest,error:null};}catch(cause){return{ran:false,readiness,result:null,manifest:null,error:{type:'SIMULATION_ERROR',message:cause.message}};}}
