import { SCHEMA_VERSION, validateModelDocument } from './schema.js';

const migrations=new Map();
export function registerMigration(fromVersion,migrate){if(migrations.has(fromVersion))throw new TypeError(`Migration already registered for ${fromVersion}.`);migrations.set(fromVersion,migrate);}
export function migrateModelDocument(input){
  let current=structuredClone(input),steps=0;
  while(current.schemaVersion!==SCHEMA_VERSION){const migrate=migrations.get(current.schemaVersion);if(!migrate)return{ok:false,document:current,errors:[{code:'MIGRATION_PATH_MISSING',message:`No migration from ${current.schemaVersion??'unversioned'}; input preserved.`}]};current=migrate(current);if(++steps>20)throw new Error('Migration cycle detected.');}
  const validation=validateModelDocument(current);return{ok:validation.valid,document:current,...validation};
}
