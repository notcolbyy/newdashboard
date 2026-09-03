import { escapeHtml, formatCurrency, formatSignedCurrency, titleCase } from './formatting.js';
import { referenceAge } from './app-state.js';
import { periodExplorerMarkup, financialRows, reconciliationBadge, modelScopeNote } from './analysis-shared.js';

const incomeRows=income=>[
  ['Military taxable compensation',income.militaryTaxableCents],['Military non-taxable allowances',income.militaryNontaxableCents],['Physician income',income.physicianCents],['Other employment',income.otherEmploymentCents],['Pension income',income.pensionCents],['Rental distributions',income.rentalDistributionsCents],['Other recurring income',income.otherRecurringCents],['One-time income',income.oneTimeIncomeCents]
].map(([label,value])=>({label,value}));
const taxRows=taxes=>[
  ['Federal income tax',taxes.federalIncomeTaxCents],['Social Security payroll tax',taxes.socialSecurityTaxCents],['Medicare tax',taxes.medicareTaxCents],['Additional Medicare tax',taxes.additionalMedicareTaxCents]
].map(([label,value])=>({label,value}));
const spendingRows=spending=>[
  ['Essential spending',spending.essentialCents],['Discretionary spending',spending.discretionaryCents],['One-time spending',spending.oneTimeCents]
].map(([label,value])=>({label,value}));
const allocationRows=allocation=>[
  {label:'Household reserve restoration',value:allocation.reserveRestorationCents,detail:'Cash allocation, not consumption'},
  {label:'Employee retirement contributions',value:allocation.employeeRetirementCents,detail:'Household compensation allocated to retirement'},
  {label:'Taxable investing',value:allocation.taxableInvestingCents,detail:'Asset transfer, not an expense'},
  {label:'Goal funding',value:allocation.goalFundingCents,detail:'Dedicated transfer, not consumption'},
  {label:'Retained cash',value:allocation.retainedCashCents,detail:'Left in general cash'},
  {label:'Employer / government retirement',value:allocation.employerGovernmentRetirementCents,detail:'External wealth inflow; not funded from household FCF'}
];

export function cashFlowViewModel(row){
  return {year:row.year,income:row.cashFlow.income,taxes:row.cashFlow.taxes,spending:row.cashFlow.spending,debt:row.cashFlow.debt,allocation:row.cashFlow.allocation,assetTransactions:row.cashFlow.assetTransactions,freeCashFlowCents:row.cashFlow.freeCashFlowCents,deltas:row.deltas,reconciliation:row.reconciliation.cash,warnings:row.warnings??[]};
}

export function cashFlowMarkup({row,simulation,model}){
  const data=cashFlowViewModel(row),age=referenceAge(row,model),context=row.careers?.map(stage=>stage.role).join(' · ')||'No active career stage';
  return `<section class="view analysis-view" aria-labelledby="cash-flow-title">${periodExplorerMarkup({row,simulation,model,title:'Cash flow period'})}
    <header class="analysis-heading"><div><p class="eyebrow">Annual household statement</p><h1 id="cash-flow-title">Cash Flow</h1><p>Age ${age} · ${row.year} · ${escapeHtml(context)}</p></div><div class="hero-number"><span>Free cash flow</span><strong class="${data.freeCashFlowCents<0?'negative':''}">${formatCurrency(data.freeCashFlowCents)}</strong><small>Before optional investing and goals</small></div></header>
    <section class="cash-hero" aria-label="Selected-year cash flow summary">
      ${summaryMetric('Cash income',data.income.totalCashIncomeCents,'Authoritative modeled cash sources')}
      ${summaryMetric('Taxes',data.taxes.totalTaxCents,'Federal and payroll')}
      ${summaryMetric('Modeled spending',data.spending.totalHouseholdSpendingCents,'Essential, discretionary, and one-time')}
      ${summaryMetric('Required debt service',data.debt.debtServiceCents,'Interest plus principal')}
    </section>
    <section class="analysis-grid cash-grid">
      <section class="panel panel-pad cash-bridge-panel"><div class="panel-header"><div><p class="section-label">Selected-year movement</p><h2>Money through the household</h2><p>Authoritative totals; bar length is presentation only.</p></div>${reconciliationBadge(data.reconciliation,'Cash reconciled')}</div>${cashBridgeSvg(data)}<div class="bridge-equation"><span>Income</span><i>−</i><span>Taxes</span><i>−</i><span>Spending</span><i>−</i><span>Debt service</span><i>−</i><span>Protected retirement</span><i>=</i><strong>FCF</strong></div></section>
      <section class="panel panel-pad"><div class="panel-header"><div><p class="section-label">Year over year</p><h2>Cash-flow changes</h2></div></div>${cashDeltas(data.deltas)}</section>
      <section class="panel panel-pad statement-card"><div class="panel-header"><div><p class="section-label">Sources</p><h2>Income</h2></div><strong>${formatCurrency(data.income.totalCashIncomeCents)}</strong></div>${financialRows(incomeRows(data.income))}</section>
      <section class="panel panel-pad statement-card"><div class="panel-header"><div><p class="section-label">Taxes</p><h2>Federal & payroll</h2></div><strong>${formatCurrency(data.taxes.totalTaxCents)}</strong></div>${financialRows(taxRows(data.taxes))}<p class="definition-note">Pre-tax retirement deductions: ${formatCurrency(data.taxes.pretaxRetirementCents)}. This is not an additional tax.</p></section>
      <section class="panel panel-pad statement-card"><div class="panel-header"><div><p class="section-label">Household uses</p><h2>Spending</h2></div><strong>${formatCurrency(data.spending.totalHouseholdSpendingCents)}</strong></div>${financialRows(spendingRows(data.spending))}${propertyCashRows(data.spending,data.income)}</section>
      <section class="panel panel-pad statement-card"><div class="panel-header"><div><p class="section-label">Required payments</p><h2>Debt service</h2></div><strong>${formatCurrency(data.debt.debtServiceCents)}</strong></div>${financialRows([{label:'Interest',value:data.debt.interestCents,detail:'Economic borrowing cost'},{label:'Principal',value:data.debt.principalCents,detail:'Cash outflow and balance-sheet transfer—not consumption'}],{empty:'No required modeled debt service this year.'})}</section>
      <section class="panel panel-pad allocation-card"><div class="panel-header"><div><p class="section-label">After required cash flow</p><h2>Allocation</h2><p>Investing and reserve movements remain separate from spending.</p></div></div>${financialRows(allocationRows(data.allocation),{empty:'No optional allocation activity this year.'})}</section>
      <section class="panel panel-pad audit-card"><div class="panel-header"><div><p class="section-label">Audit</p><h2>Cash reconciliation</h2></div>${reconciliationBadge(data.reconciliation)}</div><dl class="recon-list"><div><dt>Opening cash</dt><dd>${formatCurrency(data.reconciliation.openingCashCents)}</dd></div><div><dt>Sources</dt><dd>${formatCurrency(data.reconciliation.sourcesCents)}</dd></div><div><dt>Uses</dt><dd>${formatCurrency(data.reconciliation.usesCents)}</dd></div><div><dt>Closing cash</dt><dd>${formatCurrency(data.reconciliation.actualClosingCashCents)}</dd></div><div><dt>Difference</dt><dd>${formatCurrency(data.reconciliation.differenceCents)}</dd></div></dl></section>
    </section>${row.properties?.length?`<div class="analysis-actions"><button type="button" class="context-link" data-view-link="real-estate">View selected-year property operations</button></div>`:''}${modelScopeNote(data.warnings)}</section>`;
}

const summaryMetric=(label,value,detail)=>`<article><span>${escapeHtml(label)}</span><strong>${formatCurrency(value,{compact:true})}</strong><small>${escapeHtml(detail)}</small></article>`;
function propertyCashRows(spending,income){const rows=[{label:'Owner-occupied property costs',value:spending.ownerOccupiedPropertyCents},{label:'Rental/property costs',value:spending.rentalPropertyCents},{label:'Rental distribution included in income',value:income.rentalDistributionsCents}].filter(x=>x.value);return rows.length?`<details class="inline-details"><summary>Property cash-flow context</summary>${financialRows(rows)}</details>`:'';}
function cashDeltas(deltas){if(!deltas)return '<p class="muted">No prior-year comparison exists.</p>';return `<div class="delta-list">${[['Income',deltas.incomeCents],['Spending',deltas.spendingCents],['Free cash flow',deltas.freeCashFlowCents]].map(([label,value])=>`<div class="delta-item"><span>${label}</span><strong>${formatSignedCurrency(value)}</strong></div>`).join('')}</div>`;}

export function cashBridgeSvg(data){
  const items=[['Income',data.income.totalCashIncomeCents,'inflow'],['Taxes',data.taxes.totalTaxCents,'outflow'],['Spending',data.spending.totalHouseholdSpendingCents,'outflow'],['Debt',data.debt.debtServiceCents,'outflow'],['Protected retirement',data.allocation.employeeRetirementCents,'outflow'],['FCF',data.freeCashFlowCents,data.freeCashFlowCents<0?'negative':'result']],max=Math.max(1,...items.map(x=>Math.abs(x[1]))),width=780,left=112,right=104,barWidth=width-left-right;
  return `<figure class="cash-bridge"><svg viewBox="0 0 ${width} 273" role="img" aria-labelledby="cash-bridge-title cash-bridge-desc"><title id="cash-bridge-title">Annual cash flow bridge</title><desc id="cash-bridge-desc">Income ${formatCurrency(items[0][1])}, taxes ${formatCurrency(items[1][1])}, spending ${formatCurrency(items[2][1])}, debt service ${formatCurrency(items[3][1])}, protected employee retirement ${formatCurrency(items[4][1])}, and free cash flow ${formatCurrency(items[5][1])}.</desc>${items.map(([label,value,kind],i)=>{const y=10+i*43,w=Math.max(value===0?0:3,Math.abs(value)/max*barWidth);return`<text x="0" y="${y+19}" class="bridge-label">${label}</text><rect x="${left}" y="${y}" width="${w}" height="26" rx="5" class="bridge-bar ${kind}"/><text x="${width-2}" y="${y+19}" text-anchor="end" class="bridge-value">${escapeHtml(formatCurrency(value,{compact:true}))}</text>`;}).join('')}</svg><figcaption>Protected employee retirement is included because the authoritative FCF calculation deducts it. Principal remains a cash use here, but the wealth explanation treats it as a transfer rather than a loss.</figcaption></figure>`;
}

export function freeCashFlowTrendSvg(years,selectedYear){
  const width=780,height=160,pad=18,values=years.map(row=>row.cashFlow.freeCashFlowCents),min=Math.min(0,...values),max=Math.max(0,...values),range=max-min||1,x=i=>pad+i*(width-pad*2)/Math.max(1,years.length-1),y=v=>pad+(max-v)*(height-pad*2)/range,index=Math.max(0,years.findIndex(row=>row.year===selectedYear)),path=years.map((row,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(row.cashFlow.freeCashFlowCents).toFixed(1)}`).join(' ');
  return `<svg class="fcf-trend" viewBox="0 0 ${width} ${height}" role="img" aria-label="Free cash flow trend with ${selectedYear} selected"><line x1="${pad}" y1="${y(0)}" x2="${width-pad}" y2="${y(0)}"/><path d="${path}"/><circle cx="${x(index)}" cy="${y(values[index])}" r="5"/></svg>`;
}
