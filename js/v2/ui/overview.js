import { escapeHtml, formatCurrency, formatSignedCurrency, titleCase } from './formatting.js';
import { referenceAge } from './app-state.js';

const metric=(label,value,help)=>`<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(help)}</small></article>`;
const meaningfulDeltas=row=>row.deltas?[
  ['Net worth',row.deltas.netWorthCents],['Income',row.deltas.incomeCents],['Free cash flow',row.deltas.freeCashFlowCents],['Property equity',row.deltas.propertyEquityCents]
].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,3):[];

export function overviewMarkup({row,simulation,model}){
  const age=referenceAge(row,model);
  return `<section class="view" aria-labelledby="overview-title">
    <section class="panel age-explorer" aria-labelledby="age-explorer-title">
      <div class="age-row"><div class="age-value"><span id="age-explorer-title">Explore the plan</span><strong>Age ${age} · ${row.year}</strong></div>
      <div class="slider-wrap"><label class="sr-only" for="age-slider">Select modeled age and year</label><input id="age-slider" type="range" min="${simulation.years[0].year}" max="${simulation.years.at(-1).year}" value="${row.year}" step="1" aria-valuetext="Age ${age}, year ${row.year}"><div class="slider-labels"><span>${referenceAge(simulation.years[0],model)} · ${simulation.years[0].year}</span><span>${referenceAge(simulation.years.at(-1),model)} · ${simulation.years.at(-1).year}</span></div></div>
      <div class="jump-row" id="age-jumps" aria-label="Jump to major milestones"></div></div>
    </section>${overviewBodyMarkup({row,simulation,model})}</section>`;
}

export function overviewBodyMarkup({row,simulation,model}){
  const age=referenceAge(row,model),context=row.careers?.map(c=>c.role).join(' · ')||'No active career stage',bs=row.balanceSheet,cf=row.cashFlow,milestone=row.nextMajorMilestone;
  const afterTax=(cf.income?.totalCashIncomeCents??null)!==null?(cf.income.totalCashIncomeCents-cf.taxes.totalTaxCents):null;
  const deltas=meaningfulDeltas(row),drivers=[...(row.netWorthDecomposition?.components??[])].filter(x=>x.economicEffectCents!==0).sort((a,b)=>Math.abs(b.economicEffectCents)-Math.abs(a.economicEffectCents)).slice(0,4);
  return `<div class="overview-grid">
      <section class="panel hero-overview"><div class="hero-copy"><p class="eyebrow">Selected chapter</p><div class="hero-age" aria-hidden="true">${age}</div><h1 id="overview-title">${escapeHtml(context)}</h1><p class="hero-context">Calendar year ${row.year} · Overview balances are shown in nominal modeled dollars.</p></div>
      <aside class="milestone"><span class="section-label">Next major milestone</span>${milestone?`<strong>${escapeHtml(milestone.description)}</strong><time datetime="${escapeHtml(milestone.targetDate)}">Age ${milestone.age} · ${milestone.targetYear} · ${milestone.yearsAway} year${milestone.yearsAway===1?'':'s'} away</time>`:'<strong>No later major milestone is currently modeled.</strong><span class="muted">Additions belong in the future model editor.</span>'}</aside></section>
      <div class="metrics">
        ${metric('Total net worth',formatCurrency(bs.totalNetWorthCents,{compact:true}),'All modeled assets minus liabilities.')}
        ${metric('Liquid net worth',formatCurrency(bs.liquidNetWorthCents,{compact:true}),'Cash and marketable taxable assets, less immediate unsecured debt.')}
        ${metric('After-tax income',formatCurrency(afterTax,{compact:true}),'Modeled cash income after federal and payroll taxes.')}
        ${metric('Free cash flow',formatCurrency(cf.freeCashFlowCents,{compact:true}),'Before optional investing and goals.')}
        ${metric('Real-estate equity',formatCurrency(bs.realEstateEquityCents,{compact:true}),'Property value minus linked property debt.')}
        ${metric('Investable net worth',formatCurrency(bs.investableNetWorthCents,{compact:true}),'Cash and marketable investment accounts.')}
      </div>
      <section class="panel panel-pad trajectory"><div class="panel-header"><div><p class="section-label">Wealth trajectory</p><h2>Modeled household wealth</h2><p>Nominal dollars · selected age highlighted</p></div><div class="chart-legend"><span>Total net worth</span><span>Liquid net worth</span></div></div><div class="chart-wrap" id="wealth-chart"></div></section>
      <div class="side-stack">
        <section class="panel panel-pad"><div class="panel-header"><div><p class="section-label">Year over year</p><h2>What changed</h2></div></div><div class="delta-list">${deltas.length?deltas.map(([label,value])=>`<div class="delta-item"><span>${label}</span><strong>${formatSignedCurrency(value)}</strong></div>`).join(''):'<p class="muted">This is the first modeled year, so no prior-year comparison exists.</p>'}</div></section>
        <section class="panel panel-pad"><div class="panel-header"><div><p class="section-label">Economic drivers</p><h2>What grew wealth</h2></div></div><div class="driver-list">${drivers.length?drivers.map(item=>`<div class="driver-item"><span>${escapeHtml(item.label??titleCase(item.type))}</span><strong>${formatSignedCurrency(item.economicEffectCents)}</strong></div>`).join(''):'<p class="muted">No material economic drivers are recorded for this year.</p>'}</div></section>
      </div>
      <section class="panel panel-pad"><div class="panel-header"><div><p class="section-label">Model narrator</p><h2>Why this age matters</h2></div></div><div class="narrator-list">${row.narrator?.length?row.narrator.slice(0,4).map((item,index)=>`<div class="narrator-item"><span class="narrator-index">0${index+1}</span><p>${escapeHtml(item.text)}</p></div>`).join(''):'<div class="empty"><div><div class="empty-icon" aria-hidden="true">·</div><h3>A quieter year</h3><p>No material transition or warning was selected by the model narrator.</p></div></div>'}</div></section>
      ${warningsMarkup(row.warnings)}
    </div>`;
}

function warningsMarkup(warnings=[]){return `<section class="panel panel-pad warning-card"><div class="panel-header"><div><p class="section-label">Model signals</p><h2>${warnings.length?`${warnings.length} warning${warnings.length===1?'':'s'}`:'No warnings'}</h2><p>Model warnings are separate from financial decision blockers.</p></div></div>${warnings.length?`<div class="warning-list">${warnings.slice(0,6).map(w=>`<details><summary>${escapeHtml(titleCase(w.code))}</summary><p>${escapeHtml(w.explanation)}</p></details>`).join('')}</div>`:'<p class="muted">This selected year has no model-health or financial warnings.</p>'}</section>`;}

export function trajectorySvg(years,selectedYear){
  const width=900,height=300,pad={l:64,r:18,t:18,b:35},values=years.flatMap(r=>[r.balanceSheet.totalNetWorthCents,r.balanceSheet.liquidNetWorthCents]),min=Math.min(0,...values),max=Math.max(1,...values),range=max-min||1,x=i=>pad.l+i*(width-pad.l-pad.r)/Math.max(1,years.length-1),y=v=>pad.t+(max-v)*(height-pad.t-pad.b)/range,path=key=>years.map((r,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(r.balanceSheet[key]).toFixed(1)}`).join(' '),idx=Math.max(0,years.findIndex(r=>r.year===selectedYear)),markerX=x(idx),selected=years[idx],ticks=[0,.25,.5,.75,1];
  const grid=ticks.map(t=>{const value=min+(max-min)*(1-t),py=pad.t+t*(height-pad.t-pad.b);return`<line class="grid" x1="${pad.l}" y1="${py}" x2="${width-pad.r}" y2="${py}"/><text class="axis-label" x="${pad.l-8}" y="${py+4}" text-anchor="end">${escapeHtml(formatCurrency(Math.round(value),{compact:true}))}</text>`;}).join('');
  const labels=years.filter((_,i)=>i===0||i===years.length-1||i%Math.max(1,Math.ceil(years.length/6))===0).map(r=>`<text class="axis-label" x="${x(years.indexOf(r))}" y="${height-8}" text-anchor="middle">${r.year}</text>`).join('');
  return `<svg class="wealth-chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="wealth-chart-title wealth-chart-desc" preserveAspectRatio="xMidYMid meet"><title id="wealth-chart-title">Modeled household wealth over time</title><desc id="wealth-chart-desc">Total and liquid net worth in nominal modeled dollars, with ${selectedYear} selected.</desc><defs><linearGradient id="wealth-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e33b43" stop-opacity=".18"/><stop offset="1" stop-color="#e33b43" stop-opacity="0"/></linearGradient></defs>${grid}${labels}<path class="area" d="${path('totalNetWorthCents')} L ${x(years.length-1)} ${height-pad.b} L ${x(0)} ${height-pad.b} Z"/><path class="line" d="${path('totalNetWorthCents')}"/><path class="liquid" d="${path('liquidNetWorthCents')}"/><line class="marker-line" x1="${markerX}" y1="${pad.t}" x2="${markerX}" y2="${height-pad.b}"/><circle class="marker" cx="${markerX}" cy="${y(selected.balanceSheet.totalNetWorthCents)}" r="5"/></svg><div class="chart-detail">${selected.year} · ${formatCurrency(selected.balanceSheet.totalNetWorthCents,{compact:true})}</div>`;
}

export function jumpCandidates(simulation,model){const first=simulation.years[0],last=simulation.years.at(-1),items=simulation.timeline.filter(item=>['career','household','property','goal'].includes(item.category));const seen=new Set(),result=[];for(const item of items){const year=Number(String(item.realizedDate??item.plannedDate??'').slice(0,4));if(year<first.year||year>last.year||seen.has(year))continue;seen.add(year);result.push({year,label:item.category==='career'?'Career':item.category==='household'?'Household':item.category==='property'?'Property':'Goal'});if(result.length===4)break;}return result.length?result:[{year:first.year,label:`Age ${referenceAge(first,model)}`},{year:last.year,label:`Age ${referenceAge(last,model)}`}];}
