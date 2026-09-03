import { assessSimulationReadiness, validateProductionModel, modelHealthSummary, auditModel } from '../index.js';

export const SETUP_SECTIONS=Object.freeze([
  ['setup','Setup'],['people','People'],['finances','Starting finances'],['careers','Careers'],
  ['household','Household'],['spending','Spending'],['assumptions','Assumptions'],
  ['events','Future events'],['review','Review']
]);

export function parseMoneyInput(value){
  if(value==null||String(value).trim()==='')return null;
  const cleaned=String(value).trim().replace(/[$,\s]/g,'');
  if(!/^-?\d+(?:\.\d{0,2})?$/.test(cleaned))throw new TypeError('Enter a dollar amount with no more than two decimal places.');
  const negative=cleaned.startsWith('-'),unsigned=negative?cleaned.slice(1):cleaned,[whole='0',fraction='']=unsigned.split('.');
  const cents=Number(whole)*100+Number((fraction+'00').slice(0,2));
  if(!Number.isSafeInteger(cents))throw new TypeError('This amount is too large.');
  return negative?-cents:cents;
}

export function formatMoneyInput(cents){
  if(cents==null)return '';
  if(!Number.isSafeInteger(cents))throw new TypeError('Money must use integer cents.');
  const sign=cents<0?'-':'',absolute=Math.abs(cents),whole=Math.floor(absolute/100).toLocaleString('en-US'),fraction=String(absolute%100).padStart(2,'0');
  return `${sign}${whole}${fraction==='00'?'':`.${fraction}`}`;
}

export function stableEntityId(prefix,entities=[]){
  const used=new Set(entities.map(entity=>entity.id));let number=1,candidate=prefix;
  while(used.has(candidate))candidate=`${prefix}-${++number}`;
  return candidate;
}

export function createDraftSession(model){
  const persisted=structuredClone(model),draft=structuredClone(model);
  return evaluateDraft({persisted,draft,dirty:false,fieldErrors:{},changes:[]});
}

export function evaluateDraft(session){
  const validation=validateProductionModel(session.draft),readiness=assessSimulationReadiness(session.draft);
  const issues={errors:[...(validation.errors??[]),...(readiness.missing??[])],warnings:validation.warnings??[]};
  return{...session,validation,readiness,health:modelHealthSummary(session.draft),audit:auditModel(session.draft),fieldErrors:mapValidationToFields(issues)};
}

export function editDraft(session,mutator,change){
  const draft=structuredClone(session.draft);mutator(draft);
  return evaluateDraft({...session,draft,dirty:JSON.stringify(draft)!==JSON.stringify(session.persisted),changes:appendChange(session.changes,change)});
}

export function discardDraft(session){return createDraftSession(session.persisted);}
export function acceptSavedDraft(session){return createDraftSession(session.draft);}

export function mapValidationToFields(validation){
  const fields={};for(const item of [...(validation?.errors??[]),...(validation?.warnings??[])]){const path=normalizeValidationPath(item.path);(fields[path]??=[]).push(item);}return fields;
}

export function normalizeValidationPath(path=''){
  return String(path).replace(/^(people|accounts|liabilities|careers|spendingSchedules|plannedEvents|goals)\.([^.]+)/,(_,collection,id)=>`${collection}.${id}`);
}

export function editorFieldPaths(field,model){
  const reference=model.people?.find(person=>person.isReference)?.id??'reference',partner=model.people?.find(person=>!person.isReference)?.id??'partner';
  const direct={simulationStartYear:['household.simulationStartYear','household'],simulationEndYear:['household.simulationEndYear','household'],referenceBirthDate:[`people.${reference}.birthDate`,`people.${reference}`],partnerEnabled:[`people.${partner}`],partnerBirthDate:[`people.${partner}.birthDate`,`people.${partner}`],partnerAgeOffset:[`people.${partner}.ageOffsetFromReference`,`people.${partner}`],filingStatus:['household.filingStatus'],combinationDate:['plannedEvents.household-combination'],filingChangeDate:['plannedEvents.filing-status-change'],transferDate:['plannedEvents.expected-property-transfer.date'],transferValue:['plannedEvents.expected-property-transfer'],homeTarget:['goals.long-term-home.target.amountCents'],homeStart:['goals.long-term-home.preferredWindow.startDate','goals.long-term-home'],homeEnd:['goals.long-term-home.preferredWindow.endDate','goals.long-term-home']};
  if(direct[field])return direct[field];
  const [kind,id]=String(field).split(':');
  if(kind==='account')return[`accounts.${id}.openingBalanceCents`,`accounts.${id}`];
  if(kind==='accountOwner')return[`accounts.${id}.ownerId`,`accounts.${id}`];
  if(kind==='debtBalance')return[`liabilities.${id}.openingBalanceCents`,`liabilities.${id}`];
  if(kind==='debtOwner')return[`liabilities.${id}.ownerId`,`liabilities.${id}`];
  if(kind==='debtRate')return[`liabilities.${id}.annualRate`,`liabilities.${id}`];
  if(kind==='careerPerson')return[`careers.${id}.personId`,`careers.${id}`];
  if(kind==='careerStart')return[`careers.${id}.startDate`,`careers.${id}`];
  if(kind==='careerEnd')return[`careers.${id}.endDate`,`careers.${id}`];
  if(kind==='careerPay')return[`careers.${id}`];
  if(kind==='spending')return[`spendingSchedules.spending-${id}.amountCents`,`spendingSchedules.spending-${id}`];
  if(kind==='assumption')return[`assumptions.${id}`];
  return[];
}

export function issuesForEditorField(session,field){
  const paths=editorFieldPaths(field,session.draft),issues=[];
  for(const path of paths)for(const issue of session.fieldErrors[normalizeValidationPath(path)]??[])if(!issues.some(row=>row.code===issue.code&&row.path===issue.path))issues.push(issue);
  return issues;
}

export function markUserEntered(model,{id,path,value,unit}){
  const provenanceId=`user.${id}`;
  model.provenance??={};model.provenance[provenanceId]={id:provenanceId,classification:'userEntered',value,unit,source:{title:'Entered in Model Setup',url:'user://model-setup'},sourceType:'UserInput',effectiveDate:null,retrievedDate:null,confidence:'userProvided',editable:true,yearKeyed:false,locationKeyed:false,notes:`User override for ${path}.`};
  return provenanceId;
}

export function sectionStatuses(model,readiness=assessSimulationReadiness(model),validation=validateProductionModel(model)){
  const issuePaths=[...(readiness.missing??[]),...(validation.errors??[])].map(item=>item.path);
  const has=prefix=>issuePaths.some(path=>String(path).startsWith(prefix));
  const spending=(model.spendingSchedules??[]).length>0,careers=(model.careers??[]).length>0;
  return{
    setup:!has('household.simulation')?'complete':'needsSetup',people:!has('people')?'complete':'needsSetup',
    finances:!has('accounts')&&!has('liabilities')?'complete':'needsSetup',careers:careers&&!has('careers')?'complete':'needsSetup',
    household:!has('household.filingStatus')?'complete':'needsSetup',spending:spending?'complete':'optional',
    assumptions:validation.warnings?.length?'warning':'complete',events:'optional',review:readiness.ready?'complete':'needsSetup'
  };
}

export function setupProgress(statuses){
  const required=['setup','people','finances','careers','household'],complete=required.filter(key=>statuses[key]==='complete').length;
  return{complete,total:required.length,percent:Math.round(complete/required.length*100)};
}

export function canDeleteEntity(model,collection,id){
  const references=[];
  if(collection==='people'){
    for(const [name,items] of Object.entries({accounts:model.accounts,liabilities:model.liabilities,careers:model.careers,serviceHistories:model.serviceHistories}))for(const item of items??[])if(item.ownerId===id||item.personId===id)references.push(`${name}: ${item.name??item.role??item.id}`);
    for(const property of model.properties??[])if(property.ownership?.some(row=>row.ownerId===id))references.push(`property: ${property.name??property.id}`);
    for(const event of model.plannedEvents??[])if(event.personId===id||event.property?.ownership?.some(row=>row.ownerId===id))references.push(`event: ${event.title??event.id}`);
  }
  return{allowed:references.length===0,references};
}

export function summarizeChanges(before,after){
  const rows=[];
  const compare=(label,a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))rows.push({label,before:displayValue(a),after:displayValue(b)});};
  compare('Reference birth',before.people?.find(x=>x.isReference)?.birthDate??before.people?.find(x=>x.isReference)?.birthYear,after.people?.find(x=>x.isReference)?.birthDate??after.people?.find(x=>x.isReference)?.birthYear);
  compare('Simulation period',`${before.household?.simulationStartYear??'Unset'}–${before.household?.simulationEndYear??'Unset'}`,`${after.household?.simulationStartYear??'Unset'}–${after.household?.simulationEndYear??'Unset'}`);
  compare('Filing status',before.household?.filingStatus,after.household?.filingStatus);
  for(const account of after.accounts??[]){const old=before.accounts?.find(x=>x.id===account.id);compare(account.name??account.id,old?.openingBalanceCents==null?null:formatMoneyInput(old.openingBalanceCents),account.openingBalanceCents==null?null:formatMoneyInput(account.openingBalanceCents));}
  compare('Career stages',before.careers?.length??0,after.careers?.length??0);compare('Starting debts',before.liabilities?.length??0,after.liabilities?.length??0);compare('Spending categories',before.spendingSchedules?.length??0,after.spendingSchedules?.length??0);
  compare('Inflation assumption',before.assumptions?.futureInflationRate,after.assumptions?.futureInflationRate);compare('Investment return',before.assumptions?.investmentReturn,after.assumptions?.investmentReturn);
  return rows;
}

function appendChange(changes,change){if(!change)return changes;return[...changes.filter(row=>row.path!==change.path),change];}
function displayValue(value){return value==null||value===''?'Unset':String(value);}
