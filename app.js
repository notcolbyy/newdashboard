const BASE = {
  startingProperty: 200000,
  homeGoal: 1500000,
  jagStart: 82000,
  jagGrowth: 3.2,
  physicianIncome: 210000,
  physicianStartAge: 29,
  savingsRate: 30,
  investmentReturn: 6.0,
  firstRentalAge: 25,
  rentalInterval: 4,
  rentalPrice: 340000,
  appreciation: 3.0,
  cashFlowPerRental: 250,
  cashFlowGrowth: 2.5,
  retirementAge: 49,
  retirementIncome: 85000
};

const scenarioMultipliers = {
  conservative: { income: .92, savings: .80, returns: .70, appreciation: .70, cashFlow: .72, interval: 1 },
  realistic: { income: 1, savings: 1, returns: 1, appreciation: 1, cashFlow: 1, interval: 0 },
  ambitious: { income: 1.08, savings: 1.16, returns: 1.15, appreciation: 1.15, cashFlow: 1.25, interval: -1 }
};

let selectedScenario = 'realistic';
let charts = {};
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

function getInputs() {
  const values = {};
  Object.keys(BASE).forEach(key => values[key] = Number(document.getElementById(key).value));
  return values;
}

function effectiveInputs(raw) {
  const m = scenarioMultipliers[selectedScenario];
  return {
    ...raw,
    jagStart: raw.jagStart * m.income,
    physicianIncome: raw.physicianIncome * m.income,
    savingsRate: Math.min(65, raw.savingsRate * m.savings),
    investmentReturn: raw.investmentReturn * m.returns,
    appreciation: raw.appreciation * m.appreciation,
    cashFlowPerRental: raw.cashFlowPerRental * m.cashFlow,
    rentalInterval: Math.max(2, raw.rentalInterval + m.interval)
  };
}

function project(raw) {
  const a = effectiveInputs(raw);
  const rows = [];
  let investments = 0;
  let cash = 0;
  const properties = [{ purchaseAge: 16, purchasePrice: a.startingProperty, debt: 0, isStarting: true }];

  for (let age = 25; age <= 50; age++) {
    const yearsInJag = age - 25;
    let jagIncome = age < a.retirementAge
      ? a.jagStart * Math.pow(1 + a.jagGrowth / 100, yearsInJag)
      : a.retirementIncome;
    const physicianIncome = age >= a.physicianStartAge
      ? a.physicianIncome * Math.pow(1.025, age - a.physicianStartAge)
      : 0;

    if (age >= a.firstRentalAge && (age - a.firstRentalAge) % a.rentalInterval === 0) {
      const already = properties.some(p => p.purchaseAge === age && !p.isStarting);
      if (!already) properties.push({ purchaseAge: age, purchasePrice: a.rentalPrice * Math.pow(1.025, age - a.firstRentalAge), debt: .94, isStarting: false });
    }

    let propertyValue = 0;
    let propertyDebt = 0;
    let rentalCashFlowMonthly = 0;
    properties.forEach(p => {
      const held = Math.max(0, age - p.purchaseAge);
      const value = p.purchasePrice * Math.pow(1 + a.appreciation / 100, held);
      propertyValue += value;
      if (!p.isStarting) {
        const originalLoan = p.purchasePrice * p.debt;
        const payoffFactor = Math.max(.22, 1 - held / 38);
        propertyDebt += originalLoan * payoffFactor;
        rentalCashFlowMonthly += a.cashFlowPerRental * Math.pow(1 + a.cashFlowGrowth / 100, held);
      } else {
        rentalCashFlowMonthly += a.cashFlowPerRental * .75 * Math.pow(1 + a.cashFlowGrowth / 100, held);
      }
    });

    const grossCareer = jagIncome + physicianIncome;
    const annualRentalCash = rentalCashFlowMonthly * 12;
    const annualSavings = grossCareer * (a.savingsRate / 100) + annualRentalCash * .65;
    const reserveContribution = annualSavings * .18;
    const investmentContribution = annualSavings * .82;
    investments = investments * (1 + a.investmentReturn / 100) + investmentContribution;
    cash = cash * 1.035 + reserveContribution;

    const equity = propertyValue - propertyDebt;
    const netWorth = equity + investments + cash;
    rows.push({ age, jagIncome, physicianIncome, grossCareer, annualRentalCash, rentalCashFlowMonthly, propertyValue, propertyDebt, equity, investments, cash, netWorth, propertyCount: properties.length });
  }
  return rows;
}

function chartOptions(yMoney = true) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#a7a7af', boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: { backgroundColor: 'rgba(12,12,14,.94)', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1, padding: 12, callbacks: yMoney ? { label: ctx => `${ctx.dataset.label}: ${money.format(ctx.raw)}` } : {} }
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,.035)' }, ticks: { color: '#777780', maxTicksLimit: 9 } },
      y: { grid: { color: 'rgba(255,255,255,.045)' }, ticks: { color: '#777780', callback: v => yMoney ? compactMoney.format(v) : v } }
    }
  };
}

function lineChart(id, labels, datasets, options = chartOptions()) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  charts[id] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: datasets.map((d, i) => ({
      ...d,
      borderColor: d.borderColor || (i === 0 ? '#ff3d58' : '#f4a3af'),
      backgroundColor: d.backgroundColor || (i === 0 ? 'rgba(255,61,88,.12)' : 'rgba(244,163,175,.08)'),
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: .35,
      fill: d.fill ?? false
    })) },
    options
  });
}

function updateDashboard() {
  const raw = getInputs();
  localStorage.setItem('lifeDashboardAssumptions', JSON.stringify(raw));
  const rows = project(raw);
  const labels = rows.map(r => r.age);
  const age35 = rows.find(r => r.age === 35);
  const age50 = rows.at(-1);

  document.getElementById('homeGoalHero').textContent = compactMoney.format(raw.homeGoal);
  document.getElementById('metricNetWorth').textContent = compactMoney.format(age50.netWorth);
  document.getElementById('metricIncome35').textContent = compactMoney.format(age35.grossCareer);
  document.getElementById('metricPortfolio').textContent = compactMoney.format(age50.propertyValue);
  document.getElementById('metricCashFlow').textContent = `${money.format(age50.rentalCashFlowMonthly)}/mo`;

  lineChart('netWorthChart', labels, [
    { label: 'Total net worth', data: rows.map(r => r.netWorth), fill: true },
    { label: 'Real-estate equity', data: rows.map(r => r.equity), borderColor: '#ff9bac' },
    { label: 'Investments + cash', data: rows.map(r => r.investments + r.cash), borderColor: '#c8c8ce' }
  ]);
  lineChart('incomeChart', labels, [
    { label: 'Household career income', data: rows.map(r => r.grossCareer), fill: true },
    { label: 'Rental cash flow (annual)', data: rows.map(r => r.annualRentalCash), borderColor: '#ff9bac' }
  ]);
  lineChart('portfolioChart', labels, [
    { label: 'Property value', data: rows.map(r => r.propertyValue), fill: true },
    { label: 'Estimated debt', data: rows.map(r => r.propertyDebt), borderColor: '#9d9da6' }
  ]);
  lineChart('cashFlowChart', labels, [
    { label: 'Monthly rental surplus', data: rows.map(r => r.rentalCashFlowMonthly), fill: true }
  ]);

  if (charts.assetsChart) charts.assetsChart.destroy();
  charts.assetsChart = new Chart(document.getElementById('assetsChart'), {
    type: 'doughnut',
    data: {
      labels: ['Real-estate equity', 'Investments', 'Cash / reserves'],
      datasets: [{ data: [age50.equity, age50.investments, age50.cash], backgroundColor: ['#ff3d58', '#b71d38', '#d0d0d5'], borderColor: '#111114', borderWidth: 4 }]
    },
    options: { responsive:true, maintainAspectRatio:false, cutout:'72%', plugins:{ legend:{ position:'bottom', labels:{ color:'#a7a7af', padding:18, usePointStyle:true } }, tooltip:{ callbacks:{ label:ctx=>`${ctx.label}: ${money.format(ctx.raw)}` } } } }
  });

  const first = raw.firstRentalAge;
  const milestones = [
    ['Age 18', 'Graduate high school; begin four-year undergraduate path.'],
    ['Age 22', 'Finish undergraduate degree; begin law school.'],
    ['Age 25', 'Graduate law school and target entry into Air Force JAG.'],
    [`Age ${first}`, 'First duty-station home / rental strategy begins when financially viable.'],
    [`Age ${raw.physicianStartAge}`, 'Modeled start of attending-level physician income.'],
    [`Age ${raw.retirementAge}`, 'Modeled military retirement window; evaluate Texas home and rental consolidation.']
  ];
  document.getElementById('timeline').innerHTML = milestones.map(([title, text]) => `<div class="timeline-item"><strong>${title}</strong><span>${text}</span></div>`).join('');
}

function populateInputs(values) {
  Object.entries(values).forEach(([key, value]) => { const el = document.getElementById(key); if (el) el.value = value; });
}

const saved = JSON.parse(localStorage.getItem('lifeDashboardAssumptions') || 'null');
populateInputs(saved || BASE);
updateDashboard();

document.querySelectorAll('[data-scenario]').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('[data-scenario]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedScenario = btn.dataset.scenario;
  updateDashboard();
}));

const drawer = document.getElementById('assumptionsPanel');
function setDrawer(open) { drawer.classList.toggle('open', open); drawer.setAttribute('aria-hidden', String(!open)); }
document.getElementById('openAssumptions').onclick = () => setDrawer(true);
document.getElementById('closeAssumptions').onclick = () => setDrawer(false);
document.getElementById('closeBackdrop').onclick = () => setDrawer(false);
document.getElementById('assumptionsForm').addEventListener('submit', e => { e.preventDefault(); updateDashboard(); setDrawer(false); });
document.getElementById('resetAssumptions').onclick = () => { populateInputs(BASE); localStorage.removeItem('lifeDashboardAssumptions'); updateDashboard(); };
