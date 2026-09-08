import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaselineModel, assessSimulationReadiness, simulateFinancialLife, validateModelDocument, canonicalStringify, resultFingerprint, simulateReproducibly, replaySimulation, calculateHousingBurden } from '../index.js';
import { buildRuntimeInputs } from '../ui/runtime-data.js';
import { configureReference, configureAccountBalance, addGenericCareer, configureLongTermHome } from '../ui/model-editor-actions.js';
import { goldenProductionFixture } from './golden-production-fixture.js';

function zeroIncomeModel(){
  const model=createBaselineModel();
  model.household.simulationStartYear=2026;model.household.simulationEndYear=2028;model.household.filingStatus='single';
  configureReference(model,{name:'Example',birthDate:'2000-01-01'});
  for(const account of model.accounts)configureAccountBalance(model,account.id,0);
  addGenericCareer(model,{personId:'reference',role:'Short career',startDate:'2026-01-01',endDate:'2027-01-01',annualCents:10_000_000});
  configureLongTermHome(model,{enabled:true,targetCents:10_000_000,startDate:'2028-01-01',endDate:'2028-12-31',locationKey:'EXAMPLE',downPaymentRate:.2,allowTaxableInvestments:false});
  return model;
}
function finite(value){if(typeof value==='number')assert.ok(Number.isFinite(value));else if(value&&typeof value==='object')Object.values(value).forEach(finite);}
test('READY zero-income home evaluation is unavailable, fails comfort, serializes and replays deterministically',()=>{
  const model=zeroIncomeModel(),inputs=buildRuntimeInputs(model);
  assert.equal(validateModelDocument(model).valid,true);assert.equal(assessSimulationReadiness(model).status,'READY');
  const run=simulateReproducibly(model,inputs),result=run.result,decision=result.decisions.at(-1),rule=decision.rules.find(r=>r.ruleId==='housingBurdenComfort');
  assert.equal(decision.evaluatedYear,2028);assert.equal(decision.housingBurden.denominatorCents,0);
  assert.equal(decision.housingBurden.burden,null);assert.equal(decision.housingBurden.excessCents,null);assert.equal(rule.actualCents,null);assert.equal(rule.shortfallCents,null);assert.equal(rule.pass,false);
  assert.equal(rule.explanation,'Housing burden cannot be evaluated because after-tax household income is not positive.');
  finite(result);assert.doesNotThrow(()=>canonicalStringify(result));assert.equal(resultFingerprint(result),resultFingerprint(simulateFinancialLife(model,inputs)));
  assert.equal(replaySimulation({model,...inputs,expectedManifest:run.manifest}).status,'MATCH');
});
test('positive housing burden retains exact ratio, threshold and excess behavior',()=>{
  assert.deepEqual(calculateHousingBurden({annualHousingCostCents:3000000,afterTaxIncomeCents:10000000,comfortThreshold:.25}),{annualHousingCostCents:3000000,denominator:'afterTaxIncome',denominatorCents:10000000,burden:.3,comfortThreshold:.25,pass:false,excessCents:500000});
  assert.equal(calculateHousingBurden({annualHousingCostCents:2000000,afterTaxIncomeCents:10000000,comfortThreshold:.25}).pass,true);
});
test('non-positive denominators including negative income never become fake zero burden',()=>{
  for(const income of [0,-100000])for(const denominator of ['afterTaxIncome','grossCashCompensation']){
    const burden=calculateHousingBurden({annualHousingCostCents:0,afterTaxIncomeCents:income,grossCashCompensationCents:income,denominator,comfortThreshold:.25});
    assert.equal(burden.burden,null);assert.equal(burden.pass,false);finite(burden);
  }
});
test('production property and home combination is finite-safe and fingerprint stable',()=>{
  const {model,data,taxTables}=goldenProductionFixture(),result=simulateFinancialLife(model,{data,taxTables});
  assert.equal(validateModelDocument(model).valid,true);assert.ok(model.propertyIntents.length);assert.ok(result.decisions.some(d=>d.housingBurden));finite(result);
  assert.doesNotThrow(()=>canonicalStringify(result));assert.equal(resultFingerprint(result),resultFingerprint(simulateFinancialLife(model,{data,taxTables})));
});
