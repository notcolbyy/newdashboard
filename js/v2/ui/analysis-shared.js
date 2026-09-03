import { escapeHtml, formatCurrency, titleCase } from './formatting.js';
import { referenceAge } from './app-state.js';
import { jumpCandidates } from './overview.js';

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

export function financialRows(rows,{empty='No modeled activity in this category.'}={}){
  const visible=rows.filter(row=>Number.isSafeInteger(row.value)&&row.value!==0);
  return visible.length?`<div class="financial-rows">${visible.map(row=>`<div class="financial-row"><div><strong>${escapeHtml(row.label)}</strong>${row.detail?`<small>${escapeHtml(row.detail)}</small>`:''}</div><span class="money ${row.tone??''}">${formatCurrency(row.value)}</span></div>`).join('')}</div>`:`<p class="muted empty-copy">${escapeHtml(empty)}</p>`;
}

export function modelScopeNote(warnings=[]){
  const projected=warnings.some(item=>/project|fallback/i.test(`${item.code} ${item.explanation}`));
  return `<aside class="scope-note"><strong>Model scope</strong><span>Federal and payroll taxes are modeled; state income tax and Social Security retirement benefits are not.</span>${projected?'<span>Some selected-year inputs use projected or fallback planning data.</span>':''}</aside>`;
}

export const displayName=value=>titleCase(value||'Other');
