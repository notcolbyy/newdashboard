import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMemoryStorage, saveModel, STORAGE_KEYS } from '../index.js';
import { simulateFinancialLife } from '../model/financial-life.js';
import { createAppStore } from '../ui/app-state.js';
import { formatCurrency, formatPercentagePoints } from '../ui/formatting.js';
import { warningKind, warningSummaryMarkup, periodExplorerMarkup } from '../ui/analysis-shared.js';
import { overviewMarkup } from '../ui/overview.js';
import { cashFlowMarkup } from '../ui/cash-flow-view.js';
import { assetsMarkup } from '../ui/assets-view.js';
import { realEstateMarkup } from '../ui/real-estate-view.js';
import { goalsMarkup } from '../ui/goals-view.js';
import { timelineMarkup, timelineDestination } from '../ui/timeline-view.js';
import { identityPanel, loadErrorMarkup } from '../ui/readiness-view.js';
import { inspectSimulationResult, loadBackupModel } from '../ui/model-entry.js';
import { goldenIntegratedFixture } from './golden-integrated-fixture.js';
import { goldenProductionFixture } from './golden-production-fixture.js';

const source=relative=>readFile(new URL(relative,import.meta.url),'utf8');
const integrated=()=>{const fixture=goldenIntegratedFixture();return{...fixture,simulation:simulateFinancialLife(fixture.model,{data:fixture.data,taxTables:fixture.taxTables})};};
const row=(simulation,year)=>simulation.years.find(item=>item.year===year);

test('currency formatting distinguishes unavailable, zero, cents, negatives, and large headlines',()=>{assert.equal(formatCurrency(null),'—');assert.equal(formatCurrency(0),'$0');assert.equal(formatCurrency(-0),'$0');assert.equal(formatCurrency(1,{exact:true}),'$0.01');assert.equal(formatCurrency(-1099),'-$11');assert.equal(formatCurrency(1_000_000_37,{compact:true}),'$1M');assert.equal(formatPercentagePoints(.012),'+1.2 pp');});

test('global warning taxonomy keeps model health, financial condition, user choice, and application integrity separate',()=>{assert.equal(warningKind({code:'PROJECTED_TAX_TABLE'}),'modelHealth');assert.equal(warningKind({code:'NEGATIVE_FREE_CASH_FLOW'}),'financialCondition');assert.equal(warningKind({code:'UNRESOLVED_USER_CHOICE'}),'userChoice');assert.equal(warningKind({code:'RECONCILIATION_FAILURE'}),'application');const html=warningSummaryMarkup([{code:'PROJECTED_TAX_TABLE',explanation:'Projected.'},{code:'UNRESOLVED_USER_CHOICE',explanation:'Choose.'}]);assert.match(html,/Model health/);assert.match(html,/User choice/);});

test('Overview uses authoritative cash income and links headline concepts to detailed views',()=>{const {model,simulation}=integrated(),selected=row(simulation,2034),html=overviewMarkup({row:selected,simulation,model});assert.match(html,/Cash income/);assert.match(html,/data-view-link="cash-flow"/);assert.match(html,/data-view-link="assets"/);assert.match(html,/data-view-link="real-estate"/);assert.doesNotMatch(html,/After-tax income/);});

test('one shared period explorer is used by each analytical view',()=>{const {model,simulation}=integrated(),selected=row(simulation,2037),views=[overviewMarkup,cashFlowMarkup,assetsMarkup,realEstateMarkup,goalsMarkup];for(const render of views){const html=render({row:selected,simulation,model});assert.equal((html.match(/id="age-slider"/g)??[]).length,1);assert.match(html,/value="2037"/);}assert.equal((periodExplorerMarkup({row:selected,simulation,model}).match(/id="age-slider"/g)??[]).length,1);});

test('selected period and presentation selections preserve one cached simulation',()=>{const {model,simulation}=integrated(),store=createAppStore({model,simulation,selectedYear:2035}),cached=store.getState().simulation;for(const view of ['overview','cash-flow','assets','real-estate','goals','timeline','model'])store.setView(view);store.setSelectedYear(2040);store.selectProperty('long-term-home');store.selectGoal('long-term-home-goal');assert.equal(store.getState().simulation,cached);assert.equal(store.getState().selectedYear,2040);});

test('timeline destinations preserve authoritative related identifiers',()=>{assert.deepEqual(timelineDestination({category:'property',target:'home',relatedIds:{propertyId:'property-1'}}),{view:'real-estate',propertyId:'property-1'});assert.deepEqual(timelineDestination({category:'goal',target:'goal-1',relatedIds:{goalId:'goal-1'}}),{view:'goals',goalId:'goal-1'});assert.deepEqual(timelineDestination({category:'career'}),{view:'overview'});});

test('Timeline exposes separate keyboard buttons for period focus and analytical context',()=>{const {simulation}=integrated(),html=timelineMarkup({simulation,selectedTimelineItemId:null});assert.match(html,/Focus this year/);assert.match(html,/data-timeline-link=/);assert.doesNotMatch(html,/role="button"/);});

test('Cash Flow and Assets expose contextual Real Estate links without financial state',()=>{const {model,simulation}=integrated(),selected=row(simulation,2035);assert.match(cashFlowMarkup({row:selected,simulation,model}),/data-view-link="real-estate"/);assert.match(assetsMarkup({row:selected,simulation,model}),/data-property-link="duty-home"/);});

test('goal-property cross-links remain presentation-only and preserve cached year',()=>{const {model,simulation}=integrated(),store=createAppStore({model,simulation,selectedYear:2040}),cached=store.getState().simulation,goalHtml=goalsMarkup({row:row(simulation,2040),simulation,model}),propertyHtml=realEstateMarkup({row:row(simulation,2040),simulation,model,selectedPropertyId:'long-term-home'});assert.match(goalHtml,/data-property-link="long-term-home"/);assert.match(propertyHtml,/data-goal-link="long-term-home-goal"/);store.selectGoal('long-term-home-goal');store.setView('real-estate');store.selectProperty('long-term-home');assert.equal(store.getState().simulation,cached);assert.equal(store.getState().selectedYear,2040);});

test('strategy comparison stays authoritative, unranked, and unrecommended',()=>{const fixture=goldenIntegratedFixture();fixture.model.policies.unresolvedChoice={action:'leaveUnexecuted'};const simulation=simulateFinancialLife(fixture.model,{data:fixture.data,taxTables:fixture.taxTables}),selected=row(simulation,2039),html=goalsMarkup({row:selected,simulation,model:fixture.model}),comparison=selected.decisions.find(item=>item.strategyComparison)?.strategyComparison;assert.ok(comparison?.needsUserChoice);for(const item of comparison.evaluations)assert.match(html,new RegExp(item.strategyId));assert.match(html,/not ranked/);assert.match(html,/does not recommend a winner/);for(const key of ['recommendedStrategy','bestStrategy','winner','preferredStrategy'])assert.equal(key in comparison,false);});

test('post-simulation inspection includes authoritative simulation warnings in model health',()=>{const {model}=integrated(),run={result:{warnings:[{code:'UNRESOLVED_USER_CHOICE',explanation:'Choice remains.'}]}};const inspected=inspectSimulationResult(model,run);assert.equal(inspected.health.unresolvedChoices.length,1);});

test('run identity includes all reproducibility fingerprints and approved versions',()=>{const {model}=goldenProductionFixture(),manifest={engineVersion:'v2.0.1',outputContractVersion:'2.0.1',inputHash:'input',assumptionsHash:'assumptions',dataFingerprint:'data',outputHash:'output',runId:'run'};const html=identityPanel(model,manifest);for(const value of ['v2.0.1','2.0.1','Input hash','Assumptions hash','Data fingerprint','Output fingerprint'])assert.match(html,new RegExp(value));assert.equal(model.modelVersion,'2.0.0');assert.equal(model.schemaVersion,'2.0.0');});

test('corrupted primary storage offers explicit backup recovery without automatic replacement',()=>{const fixture=goldenIntegratedFixture(),storage=createMemoryStorage();assert.equal(saveModel(storage,fixture.model).ok,true);const changed=structuredClone(fixture.model);changed.assumptions.inflationRate=.03;assert.equal(saveModel(storage,changed).ok,true);storage.setItem(STORAGE_KEYS.primary,'{broken');const before=storage.getItem(STORAGE_KEYS.primary),loaded=loadBackupModel(storage);assert.equal(loaded.ok,true);assert.equal(storage.getItem(STORAGE_KEYS.primary),before);assert.match(loadErrorMarkup('BROKEN_WITH_BACKUP',{code:'SAVE_PARSE_FAILED',recovery:{backupAvailable:true}}),/Restore previous backup/);});

test('startup markup prevents a flash of zero-valued projections and assets share one revision',async()=>{const html=await source('../../../v2/index.html');assert.match(html,/Loading your model safely/);assert.doesNotMatch(html,/\$0/);const revisions=[...html.matchAll(/(?:app\.css|app\.js)\?v=([^"']+)/g)].map(match=>match[1]);assert.deepEqual(revisions,['2.1.5','2.1.5']);});

test('application source restores focus and limits simulation to load or saved model changes',async()=>{const app=await source('../../../v2/app.js');assert.match(app,/focusDescriptor/);assert.match(app,/restoreFocus/);assert.match(app,/simulationRunCount/);assert.equal((app.match(/runReadyModel\(/g)??[]).length,2);for(const gesture of ['jump-year','property-id','goal-id','timeline-id','timeline-link'])assert.match(app,new RegExp(`data-${gesture}`));});

test('READY financial difficulty remains distinct from application failure',()=>{const {model,simulation}=integrated(),selected=structuredClone(row(simulation,2029));selected.cashFlow.freeCashFlowCents=-125_000;const html=cashFlowMarkup({row:selected,simulation:{...simulation,years:[selected]},model});assert.match(html,/negative/);assert.doesNotMatch(html,/Simulation error|Model recovery/);});

test('single-person presentation excludes an inactive persisted partner',()=>{const {model,simulation}=integrated(),single=structuredClone(model);single.people.find(person=>!person.isReference).enabled=false;const selected=row(simulation,2035),estate=realEstateMarkup({row:selected,simulation,model:single}),assets=assetsMarkup({row:selected,simulation,model:single});assert.doesNotMatch(estate,/Inactive partner/);assert.doesNotMatch(assets,/Inactive partner/);});

test('two-person ownership remains human readable without duplicate household totals',()=>{const {model,simulation}=integrated(),selected=row(simulation,2041),html=assetsMarkup({row:selected,simulation,model});assert.match(html,/Me/);assert.match(html,/Partner/);assert.equal(selected.balanceSheet.assets.items.filter(item=>item.id==='duty-home').length,1);});

test('long-horizon selected period and major views render through age 95',()=>{const fixture=goldenProductionFixture({throughAge95:true}),simulation=simulateFinancialLife(fixture.model,{data:fixture.data,taxTables:fixture.taxTables}),selected=simulation.years.at(-1);assert.equal(selected.ages.jag,95);for(const render of [overviewMarkup,cashFlowMarkup,assetsMarkup,realEstateMarkup,goalsMarkup]){const html=render({row:selected,simulation,model:fixture.model});assert.match(html,/2099/);assert.doesNotMatch(html,/undefined|NaN/);}});

test('responsive source defines deliberate tablet, mobile, and narrow layouts without fixed page tables',async()=>{const css=await source('../../../v2/app.css');assert.match(css,/@media \(max-width: 1120px\)/);assert.match(css,/@media \(max-width: 760px\)/);assert.match(css,/@media \(max-width: 430px\)/);assert.match(css,/overflow-x: auto/);assert.match(css,/prefers-reduced-motion/);assert.doesNotMatch(css,/min-width:\s*[89]\d\dpx/);});

test('static host entry uses only relative V2 assets and all seven hash routes',async()=>{const html=await source('../../../v2/index.html'),routes=[...html.matchAll(/data-route="([^"]+)"/g)].map(match=>match[1]);assert.deepEqual(routes,['overview','cash-flow','assets','real-estate','goals','timeline','model']);assert.match(html,/href="\.\/app\.css/);assert.match(html,/src="\.\/app\.js/);assert.doesNotMatch(html,/localhost|node_modules|data-route="what-if"/);});

test('production imports exclude fixtures, tests, CLI, and standalone decision engines',async()=>{const files=['analysis-shared.js','overview.js','cash-flow-view.js','assets-view.js','real-estate-view.js','goals-view.js','timeline-view.js','model-entry.js'],text=(await Promise.all(files.map(file=>source(`../ui/${file}`)))).join('\n');assert.doesNotMatch(text,/golden|\/tests\/|\/dev\/|compareHomeStrategies|simulateGoals|simulateProperty|home-goal\.js/);});

test('production UI contains no alternate financial calculator or strategy optimizer',async()=>{const text=(await Promise.all([source('../../../v2/app.js'),source('../ui/cash-flow-view.js'),source('../ui/assets-view.js'),source('../ui/real-estate-view.js'),source('../ui/goals-view.js')])).join('\n');assert.doesNotMatch(text,/function\s+(calculateTax|calculateMortgage|calculateFCF|calculateNOI|calculateEquity|evaluateAffordability|calculateNominal|optimizeStrategy)/i);});

test('documentation records the seven-view boundary, version matrix, deployment process, and deferred V2.2 work',async()=>{const readme=await source('../README.md');for(const term of ['Overview, Cash Flow, Assets, Real Estate, Goals, Timeline, and Model','v2.0.1','2.0.1','Deployment verification','V2.2','What If'])assert.match(readme,new RegExp(term));});

test('M5 leaves frozen engine contracts and V1 entry files untouched by source boundary',async()=>{const changed=(await source('../../../v2/app.js'))+(await source('../ui/overview.js'));assert.doesNotMatch(changed,/ENGINE_VERSION\s*=|OUTPUT_CONTRACT_VERSION\s*=|schemaVersion\s*=|modelVersion\s*=/);const appCss=await source('../../../v2/app.css');assert.match(appCss,/private-wealth|--red:/);});
