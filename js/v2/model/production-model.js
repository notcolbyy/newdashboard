import { createModelDocument, FINAL_MODEL_VERSION, SCHEMA_VERSION, assessSimulationReadiness, validateModelDocument } from '../storage/schema.js';

const planning=(id,title,unit)=>({id,classification:'planningDefault',value:null,unit,source:{title,url:`model://planning/${id}`},sourceType:'ConfigurablePlanningDefault',effectiveDate:'2025-01-01',retrievedDate:null,confidence:'medium',editable:true,yearKeyed:false,locationKeyed:false});

export const INPUT_DEFINITIONS=Object.freeze({
  'people.reference.birthDate':{classification:'requiredToSimulate',state:'intentionallyUnset'},
  'people.partner.birthDateOrOffset':{classification:'optional',state:'intentionallyUnset'},
  'household.simulationStartYear':{classification:'requiredToSimulate',state:'intentionallyUnset'},
  'household.simulationEndYear':{classification:'derived',ruleId:'referenceBirthYear+95'},
  'household.filingStatus':{classification:'requiredToSimulate',state:'intentionallyUnset'},
  'accounts.*.openingBalanceCents':{classification:'requiredToSimulate',state:'intentionallyUnset'},
  'assumptions.futureInflationRate':{classification:'planningDefaultAvailable'},
  'policies.reserveMonths':{classification:'planningDefaultAvailable'},
  careers:{classification:'eventDriven',state:'intentionallyUnset'},
  plannedEvents:{classification:'optional'},properties:{classification:'optional'},goals:{classification:'optional'}
});

export function createBaselineModel(){
  const model=createModelDocument({
    household:{id:'household',simulationStartYear:null,simulationEndYear:null,filingStatus:null,combinationDate:null,marriageDate:null,locationKey:null},
    people:[{id:'reference',name:'Reference person',isReference:true,birthDate:null,birthYear:null,inputState:'intentionallyUnset'},{id:'partner',name:'Household partner',isReference:false,birthDate:null,birthYear:null,ageOffsetFromReference:null,inputState:'intentionallyUnset',enabled:false}],
    assumptions:{futureInflationRate:.025,cashReturn:.02,investmentReturn:.06,baseCurrencyYear:2025},
    accounts:[
      {id:'general-cash',name:'General cash',ownerId:'household',type:'generalCash',openingBalanceCents:null,inputState:'intentionallyUnset',classification:'userEntered',annualReturn:.02,returnProvenanceId:'planning.cashReturn'},
      {id:'emergency-reserve',name:'Emergency reserve',ownerId:'household',type:'emergencyReserve',openingBalanceCents:null,inputState:'intentionallyUnset',classification:'userEntered',annualReturn:.02,returnProvenanceId:'planning.cashReturn',protected:true},
      {id:'taxable-investments',name:'Taxable investments',ownerId:'household',type:'taxableInvestment',openingBalanceCents:null,inputState:'intentionallyUnset',classification:'userEntered',annualReturn:.06,returnProvenanceId:'planning.investmentReturn'},
      {id:'retirement-investments',name:'Retirement investments',ownerId:'reference',type:'retirementInvestment',openingBalanceCents:null,inputState:'intentionallyUnset',classification:'userEntered',annualReturn:.06,returnProvenanceId:'planning.investmentReturn',protected:true}
    ],
    policies:{reserveMonths:6,allocationPolicyId:'stabilityFirst',unresolvedChoice:{action:'leaveUnexecuted'}},
    provenance:Object.fromEntries([
      planning('planning.futureInflation','Editable long-range inflation planning convention','decimal annual rate'),
      planning('planning.cashReturn','Editable cash-yield planning convention','decimal annual return'),
      planning('planning.investmentReturn','Editable diversified-investment planning convention','decimal annual return'),
      planning('planning.reserveMonths','Editable emergency-reserve planning convention','months')
    ].map(record=>[record.id,record])),
    extensions:{production:{templateVersion:'1.0.0',inputDefinitions:INPUT_DEFINITIONS,optionalIntents:{householdCombination:null,marriage:null,expectedPropertyTransfer:null,dutyStation:null,longTermHome:null,postMilitaryCareer:null,familyEvents:[]}}}
  });
  model.modelVersion=FINAL_MODEL_VERSION;model.savedAt=null;return model;
}

export function auditModel(model){
  const provenance=Object.values(model.provenance??{}),definitions=model.extensions?.production?.inputDefinitions??{};
  const details={userEntered:[],researchedOfficial:[],researchedEstimate:[],planningDefault:[],scenarioControlled:[],eventDriven:[],derived:[],projected:[],unset:[]};
  for(const record of provenance){const key=record.classification==='official'?'researchedOfficial':record.classification==='estimated'?'researchedEstimate':record.classification==='scenarioAdjusted'?'scenarioControlled':record.classification;(details[key]??=[]).push(record.id);}
  for(const [path,definition] of Object.entries(definitions)){if(definition.state==='intentionallyUnset')details.unset.push(path);if(definition.classification==='eventDriven')details.eventDriven.push(path);if(definition.classification==='derived')details.derived.push(path);}
  for(const account of model.accounts??[])if(account.classification==='userEntered')details.userEntered.push(`accounts.${account.id}.openingBalanceCents`);
  return{counts:Object.fromEntries(Object.entries(details).map(([key,value])=>[key,new Set(value).size])),details};
}

export function modelHealthSummary(model,{migration=null,simulationWarnings=[]}={}){
  const validation=validateModelDocument(model,{provenanceCompleteness:true,strictReferences:true}),readiness=assessSimulationReadiness(model),projected=Object.values(model.provenance??{}).filter(record=>record.classification==='projected').map(record=>record.id);
  const unresolvedChoices=simulationWarnings.filter(warning=>warning.code==='UNRESOLVED_USER_CHOICE');
  return{status:!validation.valid?'INVALID':!readiness.ready?'INCOMPLETE_CONFIGURATION':validation.warnings.length||projected.length||unresolvedChoices.length?'READY_WITH_WARNINGS':'READY',modelHealthOnly:true,validation,readiness,projectedFallbacks:projected,unresolvedChoices,migration};
}

export function validateProductionModel(model){return validateModelDocument(model,{provenanceCompleteness:true,strictReferences:true});}

