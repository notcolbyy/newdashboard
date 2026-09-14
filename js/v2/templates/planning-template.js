import { createBaselineModel } from '../model/production-model.js';

// This is deliberately an incomplete document.  It supplies a planning shape,
// not personal facts, and is always reviewed before it can be saved.
export function createPlanningTemplate(){
  const model=createBaselineModel();
  model.extensions.production.template={kind:'planning',reviewRequired:true,createdFrom:'planning-template-v2.1.1'};
  const ref=model.people.find(person=>person.isReference),partner=model.people.find(person=>!person.isReference);
  ref.name='Reference person';
  partner.enabled=true;partner.name='Partner';partner.ageOffsetFromReference=null;
  model.careers=[
    {id:'planning-jag',personId:ref.id,careerType:'military',role:'Air Force JAG (planning structure)',startDate:null,endDate:null,metadata:{startAge:25,endAge:49},compensationRule:{locationKey:'UNSET',withDependents:false,payGrowth:.025,allowanceGrowth:.025},classification:'planningDefault',provenanceIds:['planning.futureInflation']},
    ...[1,2,3].map(n=>({id:'planning-pgy'+n,personId:partner.id,careerType:'physicianResidency',role:'PGY'+n,startDate:null,endDate:null,metadata:{startAge:25+n,endAge:26+n},classification:'planningDefault',provenanceIds:['planning.template']})),
    {id:'planning-pediatrician',personId:partner.id,careerType:'physicianAttending',role:'Attending pediatrician (planning structure)',startDate:null,endDate:null,metadata:{startAge:29,endAge:67},compensationRule:{case:'baseline',baseYear:2026,annualGrowth:.025},classification:'planningDefault',provenanceIds:['planning.futureInflation']}
  ];
  model.spendingSchedules=[
    {id:'planning-essential',ownerId:'household',category:'housing',classification:'essential',amountCents:3000000,valueBasis:'real',baseYear:2025,startYear:2026,endYear:2075,classificationOrigin:'planningDefault',provenanceIds:['planning.reserveMonths']},
    {id:'planning-lifestyle',ownerId:'household',category:'lifestyle',classification:'discretionary',amountCents:1200000,valueBasis:'real',baseYear:2025,startYear:2026,endYear:2075,classificationOrigin:'planningDefault',provenanceIds:['planning.reserveMonths']}
  ];
  model.goals=[{id:'long-term-home',name:'Long-term home (North Dallas planning context)',type:'longTermHome',scope:'household',ownerIds:[ref.id,partner.id],enabled:true,earliestDesiredDate:null,preferredWindow:{startDate:null,endDate:null},latestAcceptableDate:null,plannedTiming:null,target:{amountCents:150000000,basis:'real',baseYear:2025,inflationTreatment:'priceIndex'},priority:'important',priorityOrder:null,samePriorityPolicy:'proportional',fundingPolicy:{permittedSources:['generalCash','taxableInvestments'],allowTaxableInvestments:true,permittedAccountIds:['general-cash','taxable-investments'],permittedPropertySaleIds:[]},constraints:{housingBurdenDenominator:'afterTaxIncome',maxComfortHousingBurden:.27,minimumPossibleFreeCashFlowCents:0,minimumComfortFreeCashFlowCents:0,minimumDiscretionaryCapacityCents:0,minimumPostPurchaseLiquidityCents:5000000},home:{targetRole:'primaryResidence',locationKey:'TX-NORTH-DALLAS',downPaymentRate:.2,buyerClosingCostRate:.02,moveSetupCostsCents:0,moveSetupCostsBasis:'real',initialHomeReserveCents:0,initialHomeReserveMonths:0,mortgageRate:.06,mortgageTermMonths:360,propertyTaxRate:0,insuranceRate:0,maintenanceRate:.01,hoaAnnualCents:0,otherAnnualCarryingCostsCents:0,resultingPropertyId:'long-term-home-property',ownership:[{ownerId:ref.id,share:.5},{ownerId:partner.id,share:.5}],existingPrimaryDispositionPlan:null},status:'planned',statusHistory:[],provenanceIds:['planning.futureInflation'],metadata:{planningContext:'Texas / North Dallas; timing remains a user decision.'}}];
  // A transfer is recorded as an unresolved intention, never as a current asset.
  model.extensions.production.optionalIntents.expectedPropertyTransfer={estimatedValueCents:20000000,status:'unresolved',timing:null};
  model.extensions.production.template.education=[{personId:ref.id,stage:'Current high-school junior',startYear:2026,endYear:2027,detail:'Current planning chapter; graduation timing remains reviewable.'},{personId:ref.id,stage:'UT Knoxville undergraduate (planned)',startAge:18,endAge:22},{personId:ref.id,stage:'Law school',startAge:22,endAge:25},{personId:partner.id,stage:'Undergraduate',startAge:18,endAge:22},{personId:partner.id,stage:'Medical school',startAge:22,endAge:26}];
  model.extensions.production.optionalIntents.householdCombination={referenceAge:29,timing:null};
  model.extensions.production.optionalIntents.postMilitaryCareer={status:'optional',referenceAge:49};
  model.extensions.production.template.savingPhilosophy='Aim to save and invest 25–35% when feasible; retirement contributions and taxable investing remain separate editable choices. No fixed share of gross income is imposed.';
  model.extensions.production.template.serviceAssumption='Future JAG entry with no prior service is a planning assumption to review, not historical service.';
  model.provenance['planning.template']={id:'planning.template',classification:'planningDefault',value:null,unit:'planning structure',source:{title:'Editable user-requested planning structure',url:'model://planning/template'},sourceType:'ConfigurablePlanningDefault',editable:true};
  for(const row of [...model.careers,...model.goals,...model.spendingSchedules])row.provenanceIds=['planning.template'];
  return model;
}

// Materialize editable future planning dates only after the person supplies birth timing.
// Existing dates are preserved; this is input construction, not a financial calculation.
export function materializePlanningDates(model){
  if(model.extensions?.production?.template?.kind!=='planning')return;
  const ref=model.people.find(p=>p.isReference),refYear=ref.birthDate?Number(ref.birthDate.slice(0,4)):ref.birthYear;
  for(const career of model.careers){const person=model.people.find(p=>p.id===career.personId),year=person?.birthDate?Number(person.birthDate.slice(0,4)):person?.birthYear??(Number.isInteger(refYear)&&Number.isInteger(person?.ageOffsetFromReference)?refYear-person.ageOffsetFromReference:null);
    if(!Number.isInteger(year)||!career.metadata)continue;
    career.startDate??=String(year+career.metadata.startAge)+'-07-01';career.endDate??=String(year+career.metadata.endAge)+'-07-01';
    if(career.careerType==='military'&&!model.serviceHistories.some(h=>h.personId===person.id))model.serviceHistories.push({id:'planning-service',personId:person.id,periods:[{startDate:career.startDate,endDate:career.endDate}],payGradeHistory:[{effectiveDate:career.startDate,grade:'O-2',expected:true},{effectiveDate:String(Number(career.startDate.slice(0,4))+1)+'-01-01',grade:'O-3',expected:true}],metadata:{planningAssumption:'Future entry with no prior service; review before saving.'}});
  }
}
