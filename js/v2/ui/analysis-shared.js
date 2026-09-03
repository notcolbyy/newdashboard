import { escapeHtml, formatCurrency, titleCase } from './formatting.js';
import { referenceAge } from './app-state.js';

export function jumpCandidates(simulation,model){const first=simulation.years[0],last=simulation.years.at(-1),items=simulation.timeline.filter(item=>['career','household','property','goal'].includes(item.category));const seen=new Set(),result=[];for(const item of items){const year=Number(String(item.realizedDate??item.plannedDate??'').slice(0,4));if(year<first.year||year>last.year||seen.has(year))continue;seen.add(year);result.push({year,label:item.category==='career'?'Career':item.category==='household'?'Household':item.category==='property'?'Property':'Goal'});if(result.length===4)break;}return result.length?result:[{year:first.year,label:`Age ${referenceAge(first,model)}`},{year:last.year,label:`Age ${referenceAge(last,model)}`}];}

export function periodExplorerMarkup({row,simulation,model,title='Explore the plan'}){
  const age=referenceAge(row,model),first=simulation.years[0],last=simulation.years.at(-1);
  return `<section class="panel age-explorer" aria-labelledby="age-explorer-title"><div class="age-row">
    <div class="age-value"><span id="age-explorer-title">${escapeHtml(title)}</span><strong>Age ${age} · ${row.year}</strong></div>
    <div class="slider-wrap"><label class="sr-only" for="age-slider">Select modeled age and year</label><input id="age-slider" type="range" min="${first.year}" max="${last.year}" value="${row.year}" step="1" aria-valuetext="Age ${age}, year ${row.year}"><div class="slider-labels"><span>${referenceAge(first,model)} · ${first.year}</span><span>${referenceAge(last,model)} · ${last.year}</span></div></div>
    <div class="jump-row" id="age-jumps" aria-label="Jump to major milestones">${jumpCandidates(simulation,model).map(item=>`<button type="button" data-jump-year="${item.year}">${escapeHtml(item.label)} · ${item.year}</button>`).join('')}</div>
  </div></section>`;
}

export function ownerLabels(model){
  const labels=new Map([['household','Household'],['joint','Joint']]);
  for(const person of model?.people??[])if(person.enabled!==false)labels.set(person.id,person.name||person.label||(person.isReference?'Me':'Partner'));
  return labels;
}

export function ownershipLabel(ownership,labels){
  if(!ownership?.length)return 'Not specified';
  if(ownership.length>1)return ownership.map(item=>`${labels.get(item.ownerId)??item.ownerId} ${Math.round(item.share*100)}%`).join(' · ');
  return labels.get(ownership[0].ownerId)??ownership[0].ownerId;
}

export const reconciliationBadge=(result,label='Reconciled')=>`<span class="reconciliation-badge ${result?.passes?'pass':'fail'}"><span aria-hidden="true">${result?.passes?'✓':'!'}</span>${result?.passes?label:'Needs attention'}</span>`;

export const statusTag=status=>`<span class="status-tag ${String(status??'unknown').replace(/[^a-z]/gi,'').toLowerCase()}">${escapeHtml(titleCase(status??'unknown'))}</span>`;

export function warningKind(warning){const code=String(warning?.code??'');if(code==='UNRESOLVED_USER_CHOICE')return'userChoice';if(code.includes('RECONCILIATION')||code.includes('SIMULATION'))return'application';if(code.includes('PROJECTED')||code.includes('FALLBACK')||code.includes('PROVENANCE'))return'modelHealth';return'financialCondition';}
export function warningSummaryMarkup(warnings=[]){const labels={modelHealth:'Model health',financialCondition:'Financial condition',userChoice:'User choice',application:'Application integrity'},groups={};for(const warning of warnings)(groups[warningKind(warning)]??=[]).push(warning);return `<section class="panel panel-pad warning-card"><div class="panel-header"><div><p class="section-label">Plan signals</p><h2>${warnings.length?`${warnings.length} signal${warnings.length===1?'':'s'}`:'No current signals'}</h2><p>Configuration quality, financial conditions, and decisions remain distinct.</p></div></div>${warnings.length?`<div class="signal-groups">${Object.entries(groups).map(([kind,items])=>`<section data-signal-kind="${kind}"><h3>${labels[kind]}</h3>${items.slice(0,6).map(item=>`<details><summary>${escapeHtml(titleCase(item.code))}</summary><p>${escapeHtml(item.explanation)}</p></details>`).join('')}</section>`).join('')}</div>`:'<p class="muted">This selected year has no model-health, financial-condition, or user-choice signals.</p>'}</section>`;}

export function financialRows(rows,{empty='No modeled activity in this category.'}={}){
  const visible=rows.filter(row=>Number.isSafeInteger(row.value)&&row.value!==0);
  return visible.length?`<div class="financial-rows">${visible.map(row=>`<div class="financial-row"><div><strong>${escapeHtml(row.label)}</strong>${row.detail?`<small>${escapeHtml(row.detail)}</small>`:''}</div><span class="money ${row.tone??''}">${formatCurrency(row.value)}</span></div>`).join('')}</div>`:`<p class="muted empty-copy">${escapeHtml(empty)}</p>`;
}

export function modelScopeNote(warnings=[]){
  const projected=warnings.some(item=>/project|fallback/i.test(`${item.code} ${item.explanation}`));
  return `<details class="scope-note"><summary>Model scope${projected?' · projected inputs used':''}</summary><p>Federal and payroll taxes are modeled; state income tax and Social Security retirement benefits are not.${projected?' Some selected-year inputs use projected or fallback planning data.':''}</p></details>`;
}

export const displayName=value=>titleCase(value||'Other');
