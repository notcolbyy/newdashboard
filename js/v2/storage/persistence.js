import { FINAL_MODEL_VERSION, SCHEMA_VERSION, validateModelDocument } from './schema.js';
import { canonicalStringify, parseUntrustedJson } from './canonical.js';
import { migrateModelDocument } from './migrations.js';

export const STORAGE_KEYS=Object.freeze({primary:'lifeWealth:v2:model',backup:'lifeWealth:v2:model:backup'});
export const STORAGE_ENVELOPE_VERSION='1.0.0';

export function createStorageEnvelope(model,{savedAt=new Date().toISOString(),applicationVersion='v2.0.0',dataManifest=null,metadata={}}={}){return{envelopeVersion:STORAGE_ENVELOPE_VERSION,schemaVersion:model.schemaVersion,modelVersion:model.modelVersion,savedAt,applicationVersion,baseCurrencyYear:model.baseCurrencyYear,dataManifest:structuredClone(dataManifest),model:structuredClone(model),metadata:structuredClone(metadata)};}

export function serializeEnvelope(envelope){return canonicalStringify(envelope);}

export function inspectEnvelope(value){const errors=[];if(!value||typeof value!=='object'||Array.isArray(value))errors.push({code:'ENVELOPE_INVALID',severity:'error',path:'envelope',message:'Save envelope must be an object.'});if(value?.envelopeVersion!==STORAGE_ENVELOPE_VERSION)errors.push({code:'ENVELOPE_VERSION_UNSUPPORTED',severity:'error',path:'envelopeVersion',message:`Expected envelope ${STORAGE_ENVELOPE_VERSION}.`});if(!value?.model)errors.push({code:'ENVELOPE_MODEL_REQUIRED',severity:'error',path:'model',message:'Envelope must contain a model payload.'});return{valid:errors.length===0,errors,warnings:[]};}

export function importModel(serialized,{maxBytes=2_000_000}={}){
  const parsed=parseUntrustedJson(serialized,{maxBytes});if(!parsed.ok)return{ok:false,normalizedModel:null,migration:null,validation:{valid:false,errors:[{...parsed.error,severity:'error',path:'import'}],warnings:[]},warnings:[],persisted:false};
  const wrapped=Boolean(parsed.value?.model&&parsed.value?.envelopeVersion);if(wrapped){const inspection=inspectEnvelope(parsed.value);if(!inspection.valid)return{ok:false,normalizedModel:null,migration:null,validation:inspection,warnings:inspection.warnings,persisted:false};}
  const candidate=wrapped?parsed.value.model:parsed.value,migration=migrateModelDocument(candidate);if(!migration.ok)return{ok:false,normalizedModel:migration.normalizedModel,migration,validation:{valid:false,errors:migration.errors,warnings:migration.warnings},warnings:migration.warnings,persisted:false};
  const validation=validateModelDocument(migration.normalizedModel,{provenanceCompleteness:true,strictReferences:true});return{ok:validation.valid,normalizedModel:migration.normalizedModel,migration,validation,warnings:[...migration.warnings,...validation.warnings],persisted:false};
}

export function exportModel(model,{dataManifest=null,metadata={},pretty=false}={}){const validation=validateModelDocument(model,{provenanceCompleteness:true,strictReferences:true});if(!validation.valid)return{ok:false,validation,serialized:null};const envelope=createStorageEnvelope(model,{dataManifest,metadata});return{ok:true,validation,envelope,serialized:pretty?JSON.stringify(envelope,null,2):serializeEnvelope(envelope)};}

export function saveModel(storage,model,{key=STORAGE_KEYS.primary,backupKey=STORAGE_KEYS.backup,dataManifest=null,metadata={}}={}){
  const exported=exportModel(model,{dataManifest,metadata});if(!exported.ok)return{ok:false,code:'SAVE_VALIDATION_FAILED',validation:exported.validation};
  const previous=storage.getItem(key);let backupCreated=false;
  try{if(previous!==null&&importModel(previous).ok){storage.setItem(backupKey,previous);backupCreated=true;}storage.setItem(key,exported.serialized);return{ok:true,key,backupCreated,savedAt:exported.envelope.savedAt,envelope:exported.envelope};}catch(cause){if(previous!==null)try{storage.setItem(key,previous);}catch{}return{ok:false,code:'SAVE_WRITE_FAILED',message:cause.message,recovered:previous!==null};}
}

export function loadModel(storage,{key=STORAGE_KEYS.primary,backupKey=STORAGE_KEYS.backup}={}){const raw=storage.getItem(key);if(raw===null)return{ok:false,code:'SAVE_NOT_FOUND',model:null,recovery:{backupAvailable:storage.getItem(backupKey)!==null}};const parsed=parseUntrustedJson(raw);if(!parsed.ok)return{ok:false,code:'SAVE_PARSE_FAILED',model:null,errors:[parsed.error],recovery:{backupAvailable:storage.getItem(backupKey)!==null,originalPreserved:true}};const envelopeCheck=inspectEnvelope(parsed.value);if(!envelopeCheck.valid)return{ok:false,code:'SAVE_ENVELOPE_INVALID',model:null,errors:envelopeCheck.errors,recovery:{backupAvailable:storage.getItem(backupKey)!==null,originalPreserved:true}};const imported=importModel(raw);return imported.ok?{ok:true,model:imported.normalizedModel,envelope:parsed.value,migration:imported.migration,warnings:imported.warnings,recovery:{backupAvailable:storage.getItem(backupKey)!==null}}:{ok:false,code:'SAVE_MODEL_INVALID',model:imported.normalizedModel,errors:imported.validation.errors,warnings:imported.warnings,recovery:{backupAvailable:storage.getItem(backupKey)!==null,originalPreserved:true}};}

export function deleteModel(storage,{key=STORAGE_KEYS.primary}={}){const existed=storage.getItem(key)!==null;storage.removeItem(key);return{ok:true,deleted:existed,key};}

export function createMemoryStorage(initial={}){const values=new Map(Object.entries(initial));return{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear(),keys:()=>[...values.keys()],snapshot:()=>Object.fromEntries(values)};}

export const persistenceCompatibility=Object.freeze({schemaVersion:SCHEMA_VERSION,modelVersion:FINAL_MODEL_VERSION,envelopeVersion:STORAGE_ENVELOPE_VERSION,storageNamespace:'lifeWealth:v2:'});
