import { SCHEMA_VERSION, FINAL_MODEL_VERSION, validateModelDocument } from './schema.js';

const migrations=new Map();
export function registerMigration(fromVersion,toVersionOrMigrate,maybeMigrate){const toVersion=typeof toVersionOrMigrate==='string'?toVersionOrMigrate:SCHEMA_VERSION,migrate=typeof toVersionOrMigrate==='function'?toVersionOrMigrate:maybeMigrate;if(migrations.has(fromVersion))throw new TypeError(`Migration already registered for ${fromVersion}.`);if(typeof migrate!=='function')throw new TypeError('Migration function is required.');migrations.set(fromVersion,{toVersion,migrate});}

registerMigration('1.5.0',SCHEMA_VERSION,document=>{
  const next=structuredClone(document);next.schemaVersion=SCHEMA_VERSION;next.modelVersion=next.modelVersion??FINAL_MODEL_VERSION;next.baseCurrencyYear=next.baseCurrencyYear??2025;next.properties??=[];next.propertyIntents??=[];next.goals??=[];next.serviceHistories??=[];next.provenance??={};next.extensions={...(next.extensions??{}),migration:{from:'1.5.0',introducedDefaults:['policies.reserveMonths']}};next.policies={reserveMonths:6,...(next.policies??{})};return{document:next,warnings:[{code:'MIGRATION_DEFAULT_INTRODUCED',severity:'warning',path:'policies.reserveMonths',message:'Migration introduced the editable six-month reserve planning default.'}]};
});

export function migrateModelDocument(input){
  let current=structuredClone(input),steps=0;const warnings=[],history=[];
  if(!current||typeof current!=='object')return{ok:false,document:current,errors:[{code:'MIGRATION_INPUT_INVALID',severity:'error',path:'model',message:'Migration input must be an object.'}],warnings,history};
  while(current.schemaVersion!==SCHEMA_VERSION){const entry=migrations.get(current.schemaVersion);if(!entry)return{ok:false,document:current,normalizedModel:current,errors:[{code:'MIGRATION_PATH_MISSING',severity:'error',path:'schemaVersion',message:`No migration from ${current.schemaVersion??'unversioned'}; input preserved.`}],warnings,history};const from=current.schemaVersion,out=entry.migrate(structuredClone(current)),{document:migratedDocument,warnings:stepWarnings=[]}=out?.document?out:{document:out};current=structuredClone(migratedDocument);current.schemaVersion=entry.toVersion;warnings.push(...structuredClone(stepWarnings));history.push({fromVersion:from,toVersion:entry.toVersion});if(++steps>20)return{ok:false,document:current,normalizedModel:current,errors:[{code:'MIGRATION_CYCLE',severity:'error',path:'schemaVersion',message:'Migration cycle detected.'}],warnings,history};}
  const validation=validateModelDocument(current);return{ok:validation.valid,document:current,normalizedModel:current,errors:validation.errors,warnings:[...warnings,...validation.warnings],history,migrated:history.length>0};
}

export const supportedMigrationVersions=()=>[...migrations.keys()].toSorted();
