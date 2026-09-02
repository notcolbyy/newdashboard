import { createAppStore, selectedAnnualResult, referenceAge } from '../js/v2/ui/app-state.js';
import { installRouting } from '../js/v2/ui/routing.js';
import { createNewModel, loadSavedModel, prepareImport, persistModel, serializeModelExport, runReadyModel, inspectModel } from '../js/v2/ui/model-entry.js';
import { overviewMarkup, overviewBodyMarkup, trajectorySvg, jumpCandidates } from '../js/v2/ui/overview.js';
import { timelineMarkup } from '../js/v2/ui/timeline-view.js';
import { modelViewMarkup, noModelMarkup, blockedProjectionMarkup, loadErrorMarkup } from '../js/v2/ui/readiness-view.js';

const store=createAppStore(),view=document.querySelector('#app-view'),fileInput=document.querySelector('#model-file'),healthButton=document.querySelector('#health-button');
let simulationRunCount=0;

function toast(message){const item=document.createElement('div');item.className='toast';item.textContent=message;document.querySelector('#toast-region').append(item);setTimeout(()=>item.remove(),3600);}

function installModel(model,{loadState='VALID_MODEL',migration=null,save=false}={}){
  const inspection=inspectModel(model,{migration}),run=runReadyModel(model);simulationRunCount+=run.ran?1:0;
  if(save){const saved=persistModel(localStorage,model,run.manifest);if(!saved.ok){toast('The model could not be saved. Your previous save was preserved.');return;}}
  const selected=run.result?.years?.[0]?.year??null;store.setState({model,loadState,...inspection,simulation:run.result,manifest:run.manifest,selectedYear:selected,selectedTimelineItemId:null,error:run.error});
}

function boot(){const loaded=loadSavedModel(localStorage);if(loaded.model){const run=runReadyModel(loaded.model);simulationRunCount+=run.ran?1:0;store.setState({...loaded,simulation:run.result,manifest:run.manifest,selectedYear:run.result?.years?.[0]?.year??null,error:run.error});}else store.setState({loadState:loaded.loadState,loadFailure:loaded.loaded});}

function render(){const state=store.getState(),row=selectedAnnualResult(state);for(const link of document.querySelectorAll('[data-route]'))link.toggleAttribute('aria-current',link.dataset.route===state.activeView);const health=state.health?.status??(state.loadState==='NO_MODEL'?'NO_MODEL':'INVALID'),healthClass=health==='READY'?'healthy':health==='READY_WITH_WARNINGS'||health==='INCOMPLETE_CONFIGURATION'?'warning':health==='NO_MODEL'?'neutral':'attention';healthButton.dataset.status=healthClass;document.querySelector('#shell-health').textContent=health==='NO_MODEL'?'No model':health.replaceAll('_',' ').toLowerCase();document.querySelector('#shell-period').textContent=row?`Age ${referenceAge(row,state.model)} · ${row.year}`:'Not configured';
  if(state.error){view.innerHTML=errorMarkup(state.error,state.manifest);return bind();}
  if(['BROKEN_MODEL','BROKEN_WITH_BACKUP'].includes(state.loadState)){view.innerHTML=loadErrorMarkup(state.loadState,state.loadFailure);return bind();}
  if(!state.model){view.innerHTML=noModelMarkup();return bind();}
  if(state.activeView==='model')view.innerHTML=modelViewMarkup(state);
  else if(!state.readiness?.ready)view.innerHTML=blockedProjectionMarkup(state.readiness);
  else if(state.activeView==='timeline')view.innerHTML=timelineMarkup({simulation:state.simulation,selectedTimelineItemId:state.selectedTimelineItemId,category:state.timelineCategory});
  else view.innerHTML=overviewMarkup({row,simulation:state.simulation,model:state.model});
  bind();
}

function bind(){const state=store.getState(),row=selectedAnnualResult(state),slider=document.querySelector('#age-slider');if(slider){slider.addEventListener('input',event=>{store.setSelectedYear(event.target.value,{notify:false});refreshOverviewPeriod();});const chart=document.querySelector('#wealth-chart');chart.innerHTML=trajectorySvg(state.simulation.years,state.selectedYear);const jumps=document.querySelector('#age-jumps');jumps.innerHTML=jumpCandidates(state.simulation,state.model).map(item=>`<button type="button" data-jump-year="${item.year}">${item.label} · ${item.year}</button>`).join('');}
  for(const button of document.querySelectorAll('[data-action]'))button.addEventListener('click',()=>handleAction(button.dataset.action));
  for(const button of document.querySelectorAll('[data-jump-year]'))button.addEventListener('click',()=>store.setSelectedYear(button.dataset.jumpYear));
  for(const button of document.querySelectorAll('[data-timeline-filter]'))button.addEventListener('click',()=>store.setState({timelineCategory:button.dataset.timelineFilter}));
  for(const item of document.querySelectorAll('[data-timeline-id]')){const select=()=>{const found=state.simulation.timeline.find(row=>row.id===item.dataset.timelineId);store.selectTimeline(found);};item.addEventListener('click',select);item.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}});}
}

function refreshOverviewPeriod(){const state=store.getState(),row=selectedAnnualResult(state),grid=document.querySelector('.overview-grid'),slider=document.querySelector('#age-slider');if(!row||!grid||!slider)return;grid.outerHTML=overviewBodyMarkup({row,simulation:state.simulation,model:state.model});const age=referenceAge(row,state.model);document.querySelector('.age-value strong').textContent=`Age ${age} · ${row.year}`;slider.value=String(row.year);slider.setAttribute('aria-valuetext',`Age ${age}, year ${row.year}`);document.querySelector('#shell-period').textContent=`Age ${age} · ${row.year}`;document.querySelector('#wealth-chart').innerHTML=trajectorySvg(state.simulation.years,state.selectedYear);}

function handleAction(action){const state=store.getState();if(action==='create'){const created=createNewModel();installModel(created.model,{loadState:created.loadState,save:true});location.hash='#model';toast('A clean V2 model was created. Personal inputs remain unset.');}else if(action==='import')fileInput.click();else if(action==='confirm-import'&&state.importCandidate){const migrated=state.importResult.result.migration?.migrated,candidate=state.importCandidate,ready=state.importResult.inspection.readiness.ready,migration=state.importResult.result.migration;store.setState({importCandidate:null,importResult:null});installModel(candidate,{loadState:migrated?'MIGRATED_MODEL':'VALID_MODEL',migration,save:true});location.hash=ready?'#overview':'#model';toast('Imported model validated and saved.');}else if(action==='cancel-import')store.setState({importCandidate:null,importResult:null});else if(action==='save'&&state.model){const result=persistModel(localStorage,state.model,state.manifest);toast(result.ok?'Model saved in this browser.':'Save failed; the previous valid model was preserved.');}else if(action==='export'&&state.model){const result=serializeModelExport(state.model,state.manifest);if(!result.ok)return toast('Export failed validation.');const blob=new Blob([result.serialized],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='life-wealth-v2-model.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0);toast('Model export prepared.');}}

fileInput.addEventListener('change',async()=>{const file=fileInput.files?.[0];fileInput.value='';if(!file)return;const prepared=prepareImport(await file.text());if(!prepared.result.ok){toast(`Import failed: ${prepared.result.validation.errors[0]?.message??'invalid model'}`);return;}store.setState({importCandidate:prepared.candidate,importResult:prepared,activeView:'model'});location.hash='#model';toast('Import validated. Review it before saving.');});

healthButton.addEventListener('click',()=>{location.hash='#model';});
store.subscribe(render);installRouting(route=>store.setView(route));
try{boot();}catch(error){store.setState({error:{type:'SIMULATION_ERROR',message:error.message}});}

function errorMarkup(error,manifest){return `<section class="view start-layout"><div class="panel start-card"><p class="eyebrow">Simulation error</p><h1>V2 could not complete this run.</h1><p class="lede">${String(error.message??'An unexpected model error occurred.').replace(/[&<>]/g,'')}</p><span class="error-code">${error.type??'SIMULATION_ERROR'}</span>${manifest?.runId?`<p class="muted">Run ${manifest.runId}</p>`:''}<div class="button-row"><a class="button primary" href="#model">Inspect model</a></div></div></section>`;}

export const uiDiagnostics={getSimulationRunCount:()=>simulationRunCount,getState:()=>store.getState()};
