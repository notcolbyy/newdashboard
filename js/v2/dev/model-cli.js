import { readFile } from 'node:fs/promises';
import { createBaselineModel, assessSimulationReadiness, validateProductionModel, auditModel, modelHealthSummary } from '../index.js';
import { exportModel, importModel } from '../storage/persistence.js';
import { goldenProductionFixture } from '../tests/golden-production-fixture.js';
import { simulateReproducibly, replaySimulation } from '../model/reproducibility.js';

const command=process.argv[2]??'help';
const fixture=()=>goldenProductionFixture({throughAge95:process.argv.includes('--long')});
let output;
if(command==='baseline'){const model=createBaselineModel();output={model,readiness:assessSimulationReadiness(model),audit:auditModel(model)};}
else if(command==='validate'){const {model}=fixture();output={validation:validateProductionModel(model),readiness:assessSimulationReadiness(model),health:modelHealthSummary(model)};}
else if(command==='export'){const {model,data,taxTables}=fixture(),{manifest}=simulateReproducibly(model,{data,taxTables,generatedAt:'2000-01-01T00:00:00.000Z'});output=JSON.parse(exportModel(model,{dataManifest:manifest.dataManifest}).serialized);}
else if(command==='import'){const raw=await readFile(process.argv[3], 'utf8');output=importModel(raw);}
else if(['run','manifest','replay'].includes(command)){const {model,data,taxTables}=fixture(),run=simulateReproducibly(model,{data,taxTables,generatedAt:'2000-01-01T00:00:00.000Z'});output=command==='run'?{metadata:run.result.metadata,years:run.result.years.length,invariants:run.result.invariants}:command==='manifest'?run.manifest:replaySimulation({model,data,taxTables,expectedManifest:run.manifest});}
else output={usage:['baseline','validate','export','import <file>','run [--long]','manifest [--long]','replay [--long]']};
console.log(JSON.stringify(output,null,2));

