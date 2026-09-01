const BASE={startingProperty:200000,homeGoal:1500000,jagStart:82000,jagGrowth:3.2,physicianIncome:210000,physicianStartAge:29,savingsRate:30,investmentReturn:6,firstRentalAge:25,rentalInterval:4,rentalPrice:340000,appreciation:3,cashFlowPerRental:250,cashFlowGrowth:2.5,retirementAge:49,retirementIncome:85000};
const scenarioMultipliers={conservative:{income:.92,savings:.80,returns:.70,appreciation:.70,cashFlow:.72,interval:1},realistic:{income:1,savings:1,returns:1,appreciation:1,cashFlow:1,interval:0},ambitious:{income:1.08,savings:1.16,returns:1.15,appreciation:1.15,cashFlow:1.25,interval:-1}};
const scenarioCopy={conservative:{title:'Conservative buffer',description:'Adds more friction: lower income, slower investing and appreciation, lower rental surplus, and more time between property purchases.'},realistic:{title:'Realistic baseline',description:'A middle-of-the-road model using your editable assumptions without extra upside or downside multipliers.'},ambitious:{title:'Ambitious upside',description:'Models stronger income, savings, returns, appreciation, rental performance, and a somewhat faster acquisition pace.'}};

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const compactMoney=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
const clampAge=value=>Math.min(50,Math.max(25,Number(value)||35));
let selectedScenario=localStorage.getItem('lifeDashboardScenario')||'realistic';
let selectedAge=clampAge(localStorage.getItem('lifeDashboardSelectedAge')||35);
let currentRows=[];
let charts={};

Chart.defaults.font.family='Inter, system-ui, sans-serif';
Chart.defaults.color='#9898a1';

const selectedAgeMarkerPlugin={
  id:'selectedAgeMarker',
  afterDatasetsDraw(chart){
    if(!chart.$selectedAge||!chart.chartArea||!chart.scales.x)return;
    const index=chart.data.labels.indexOf(chart.$selectedAge);
    if(index<0)return;
    const x=chart.scales.x.getPixelForValue(index);
    const {top,bottom,left,right}=chart.chartArea;
    if(x<left||x>right)return;
    const ctx=chart.ctx;
    ctx.save();
    ctx.strokeStyle='rgba(255,92,115,.72)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();ctx.setLineDash([]);
    const label=`Age ${chart.$selectedAge}`;
    ctx.font='600 10px Inter, system-ui, sans-serif';
    const width=ctx.measureText(label).width+14;
    const labelX=Math.min(Math.max(x-width/2,left),right-width);
    ctx.fillStyle='rgba(18,18,22,.94)';ctx.strokeStyle='rgba(255,92,115,.42)';ctx.beginPath();ctx.roundRect(labelX,top+5,width,22,7);ctx.fill();ctx.stroke();
    ctx.fillStyle='#f4f4f6';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,labelX+width/2,top+16);ctx.restore();
  }
};
Chart.register(selectedAgeMarkerPlugin);

function getInputs(){const values={};Object.keys(BASE).forEach(key=>values[key]=Number(document.getElementById(key).value));return values}
function effectiveInputs(raw){const m=scenarioMultipliers[selectedScenario];return{...raw,jagStart:raw.jagStart*m.income,physicianIncome:raw.physicianIncome*m.income,savingsRate:Math.min(65,raw.savingsRate*m.savings),investmentReturn:raw.investmentReturn*m.returns,appreciation:raw.appreciation*m.appreciation,cashFlowPerRental:raw.cashFlowPerRental*m.cashFlow,rentalInterval:Math.max(2,raw.rentalInterval+m.interval)}}

function project(raw){
  const a=effectiveInputs(raw),rows=[];let investments=0,cash=0;
  const properties=[{purchaseAge:16,purchasePrice:a.startingProperty,debt:0,isStarting:true}];
  for(let age=25;age<=50;age++){
    const yearsInJag=age-25;
    const jagIncome=age<a.retirementAge?a.jagStart*Math.pow(1+a.jagGrowth/100,yearsInJag):a.retirementIncome;
    const physicianIncome=age>=a.physicianStartAge?a.physicianIncome*Math.pow(1.025,age-a.physicianStartAge):0;
    if(age>=a.firstRentalAge&&(age-a.firstRentalAge)%a.rentalInterval===0){
      const already=properties.some(property=>property.purchaseAge===age&&!property.isStarting);
      if(!already)properties.push({purchaseAge:age,purchasePrice:a.rentalPrice*Math.pow(1.025,age-a.firstRentalAge),debt:.94,isStarting:false});
    }
    let propertyValue=0,propertyDebt=0,rentalCashFlowMonthly=0;
    properties.forEach(property=>{
      const held=Math.max(0,age-property.purchaseAge),value=property.purchasePrice*Math.pow(1+a.appreciation/100,held);propertyValue+=value;
      if(!property.isStarting){const originalLoan=property.purchasePrice*property.debt,payoffFactor=Math.max(.22,1-held/38);propertyDebt+=originalLoan*payoffFactor;rentalCashFlowMonthly+=a.cashFlowPerRental*Math.pow(1+a.cashFlowGrowth/100,held)}
      else rentalCashFlowMonthly+=a.cashFlowPerRental*.75*Math.pow(1+a.cashFlowGrowth/100,held);
    });
    const grossCareer=jagIncome+physicianIncome,annualRentalCash=rentalCashFlowMonthly*12,annualSavings=grossCareer*(a.savingsRate/100)+annualRentalCash*.65;
    const reserveContribution=annualSavings*.18,investmentContribution=annualSavings*.82;
    investments=investments*(1+a.investmentReturn/100)+investmentContribution;cash=cash*1.035+reserveContribution;
    const equity=propertyValue-propertyDebt,netWorth=equity+investments+cash;
    rows.push({age,jagIncome,physicianIncome,grossCareer,annualRentalCash,rentalCashFlowMonthly,propertyValue,propertyDebt,equity,investments,cash,netWorth,propertyCount:properties.length});
  }
  return rows;
}

function chartOptions({stacked=false}={}){
  const mobile=window.innerWidth<=680;
  return{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},animation:{duration:320,easing:'easeOutQuart'},plugins:{legend:{labels:{color:'#a7a7af',boxWidth:9,boxHeight:9,usePointStyle:true,pointStyle:'circle',padding:mobile?12:18,font:{size:mobile?9:11}}},tooltip:{backgroundColor:'rgba(10,10,13,.96)',titleColor:'#fff',bodyColor:'#c8c8ce',borderColor:'rgba(255,255,255,.09)',borderWidth:1,padding:12,displayColors:true,callbacks:{label:context=>`${context.dataset.label}: ${money.format(context.raw)}`}}},scales:{x:{stacked,border:{display:false},grid:{color:'rgba(255,255,255,.025)'},ticks:{color:'#777780',maxTicksLimit:mobile?6:9,font:{size:mobile?9:10}}},y:{stacked,border:{display:false},grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#777780',font:{size:mobile?9:10},callback:value=>compactMoney.format(value)}}}};
}

function buildLineChart(id,labels,datasets,options=chartOptions()){
  if(charts[id])charts[id].destroy();
  charts[id]=new Chart(document.getElementById(id),{type:'line',data:{labels,datasets:datasets.map(dataset=>({borderWidth:1.8,pointRadius:0,pointHoverRadius:4,pointHoverBorderWidth:0,tension:.32,...dataset}))},options});
  charts[id].$selectedAge=selectedAge;
}
function setText(id,text){const element=document.getElementById(id);if(element)element.textContent=text}

function updateScenarioUI(a){
  const copy=scenarioCopy[selectedScenario],m=scenarioMultipliers[selectedScenario],label=selectedScenario[0].toUpperCase()+selectedScenario.slice(1);
  setText('scenarioLabel',`${label} scenario`);setText('snapshotScenario',label);setText('scenarioTitle',copy.title);setText('scenarioDescription',copy.description);
  document.querySelectorAll('[data-scenario]').forEach(button=>{const active=button.dataset.scenario===selectedScenario;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
  const factors=[['Income',`${Math.round(m.income*100)}% of baseline`],['Savings',`${a.savingsRate.toFixed(0)}% modeled rate`],['Investment return',`${a.investmentReturn.toFixed(1)}% / year`],['Appreciation',`${a.appreciation.toFixed(1)}% / year`],['Rental cash flow',`${Math.round(m.cashFlow*100)}% of baseline`],['Purchase cadence',`Every ${a.rentalInterval} years`]];
  document.getElementById('scenarioFactors').innerHTML=factors.map(([key,value])=>`<div class="scenario-factor"><span>${key}</span><strong>${value}</strong></div>`).join('');
}

function updateSliderProgress(){document.getElementById('ageSlider').style.setProperty('--age-progress',`${(selectedAge-25)/25*100}%`)}
function updateSelectedAgeMetrics(age,commitCharts=false){
  selectedAge=clampAge(age);localStorage.setItem('lifeDashboardSelectedAge',String(selectedAge));
  const row=currentRows.find(item=>item.age===selectedAge);if(!row)return;
  document.getElementById('ageSlider').value=selectedAge;
  setText('selectedAgeDisplay',selectedAge);setText('ageNetWorth',compactMoney.format(row.netWorth));setText('ageGrossIncome',compactMoney.format(row.grossCareer));setText('ageProperties',row.propertyCount);setText('ageEquity',compactMoney.format(row.equity));setText('ageInvestmentsCash',compactMoney.format(row.investments+row.cash));setText('ageRentalSurplus',`${money.format(row.rentalCashFlowMonthly)}/mo`);
  const total=row.equity+row.investments+row.cash,pct=value=>total>0?Math.round(value/total*100):0;
  setText('selectedComposition',`${pct(row.equity)}% equity · ${pct(row.investments)}% investments · ${pct(row.cash)}% reserves`);updateSliderProgress();
  document.querySelectorAll('[data-jump-age]').forEach(button=>button.classList.toggle('active',Number(button.dataset.jumpAge)===selectedAge));
  document.querySelectorAll('.acquisition-marker').forEach(button=>button.classList.toggle('active',Number(button.dataset.age)===selectedAge));
  if(commitCharts)commitSelectedAgeToCharts();
}
function commitSelectedAgeToCharts(){Object.values(charts).forEach(chart=>{chart.$selectedAge=selectedAge;chart.draw()})}

function acquisitionDescription(row){return`Age ${row.age}: portfolio ${money.format(row.propertyValue)}, debt ${money.format(row.propertyDebt)}, equity ${money.format(row.equity)}, rental surplus ${money.format(row.rentalCashFlowMonthly)} per month.`}
function renderAcquisitionRail(rows){
  const rail=document.getElementById('acquisitionRail'),detail=document.getElementById('acquisitionDetail');rail.innerHTML='';let previousCount=1;
  rows.forEach(row=>{
    if(row.propertyCount<=previousCount)return;
    for(let propertyNumber=previousCount+1;propertyNumber<=row.propertyCount;propertyNumber++){
      const button=document.createElement('button');button.type='button';button.className='acquisition-marker';button.dataset.age=row.age;button.setAttribute('aria-label',`Property ${propertyNumber}, purchased at age ${row.age}. ${acquisitionDescription(row)}`);button.title=acquisitionDescription(row);button.innerHTML=`<span>Age ${row.age}</span><strong>Property ${propertyNumber}</strong>`;
      const showDetail=()=>detail.textContent=acquisitionDescription(row);button.addEventListener('mouseenter',showDetail);button.addEventListener('focus',showDetail);button.addEventListener('click',()=>updateSelectedAgeMetrics(row.age,true));rail.appendChild(button);
    }
    previousCount=row.propertyCount;
  });
  if(!rail.children.length)detail.textContent='No modeled property acquisitions occur between ages 25 and 50.';
}

function buildCharts(rows){
  const labels=rows.map(row=>row.age);
  buildLineChart('netWorthChart',labels,[{label:'Total net worth',data:rows.map(row=>row.netWorth),borderColor:'#ff405c',backgroundColor:'rgba(255,64,92,.10)',fill:true,borderWidth:2.3},{label:'Real-estate equity',data:rows.map(row=>row.equity),borderColor:'#ff91a2',backgroundColor:'transparent',fill:false},{label:'Investments + cash',data:rows.map(row=>row.investments+row.cash),borderColor:'#c9c9cf',backgroundColor:'transparent',fill:false}]);
  buildLineChart('incomeChart',labels,[{label:'JAG / retirement income',data:rows.map(row=>row.jagIncome),borderColor:'#ff405c',backgroundColor:'rgba(255,64,92,.34)',fill:true,stack:'income'},{label:'Physician income',data:rows.map(row=>row.physicianIncome),borderColor:'#c51c3b',backgroundColor:'rgba(197,28,59,.30)',fill:true,stack:'income'},{label:'Rental cash flow',data:rows.map(row=>row.annualRentalCash),borderColor:'#d0d0d5',backgroundColor:'rgba(208,208,213,.20)',fill:true,stack:'income'}],chartOptions({stacked:true}));
  buildLineChart('portfolioChart',labels,[{label:'Property value',data:rows.map(row=>row.propertyValue),borderColor:'#ff405c',backgroundColor:'rgba(255,64,92,.10)',fill:true,borderWidth:2.2},{label:'Estimated debt',data:rows.map(row=>row.propertyDebt),borderColor:'#898993',backgroundColor:'transparent',fill:false}]);
  buildLineChart('cashFlowChart',labels,[{label:'Monthly rental surplus',data:rows.map(row=>row.rentalCashFlowMonthly),borderColor:'#ff405c',backgroundColor:'rgba(255,64,92,.10)',fill:true,borderWidth:2.2}]);
  buildLineChart('wealthCompositionChart',labels,[{label:'Real-estate equity',data:rows.map(row=>row.equity),borderColor:'#ff405c',backgroundColor:'rgba(255,64,92,.34)',fill:true,stack:'wealth'},{label:'Investments',data:rows.map(row=>row.investments),borderColor:'#9e1730',backgroundColor:'rgba(158,23,48,.30)',fill:true,stack:'wealth'},{label:'Cash / reserves',data:rows.map(row=>row.cash),borderColor:'#d0d0d5',backgroundColor:'rgba(208,208,213,.20)',fill:true,stack:'wealth'}],chartOptions({stacked:true}));
}

function updateDashboard(){
  const raw=getInputs(),effective=effectiveInputs(raw);localStorage.setItem('lifeDashboardAssumptions',JSON.stringify(raw));localStorage.setItem('lifeDashboardScenario',selectedScenario);currentRows=project(raw);
  const age35=currentRows.find(row=>row.age===35),age50=currentRows.at(-1);
  setText('homeGoalHero',compactMoney.format(raw.homeGoal));setText('heroRetirementAge',`Age ${raw.retirementAge}`);setText('metricNetWorth',compactMoney.format(age50.netWorth));setText('metricIncome35',compactMoney.format(age35.grossCareer));setText('metricPortfolio',compactMoney.format(age50.propertyValue));setText('metricCashFlow',`${money.format(age50.rentalCashFlowMonthly)}/mo`);setText('snapshotProperties',age50.propertyCount);setText('snapshotMonthlyIncome',money.format(age35.grossCareer/12));setText('snapshotSavings',`${effective.savingsRate.toFixed(0)}% / year`);
  const progress=Math.min(100,Math.max(0,age50.netWorth/raw.homeGoal*100));setText('goalProgress',`${progress.toFixed(0)}%`);document.getElementById('goalRing').style.setProperty('--progress',`${progress}%`);updateScenarioUI(effective);
  const retirementJump=document.getElementById('retirementAgeJump');retirementJump.textContent=`Retire ${raw.retirementAge}`;retirementJump.dataset.jumpAge=raw.retirementAge;retirementJump.disabled=raw.retirementAge>50;retirementJump.title=raw.retirementAge>50?'Retirement falls outside the age 25–50 projection.':`Jump to retirement age ${raw.retirementAge}`;
  buildCharts(currentRows);renderAcquisitionRail(currentRows);updateSelectedAgeMetrics(selectedAge,true);
  const milestones=[['Now','Build the academic, savings, and planning foundation for the long-range path.'],['Next school year','Strengthen the college profile and keep major education decisions visible.'],['Age 18','Graduate high school; begin four-year undergraduate path.'],['Age 22','Finish undergraduate degree; begin law school.'],['Age 25','Graduate law school and target entry into Air Force JAG.'],[`Age ${raw.firstRentalAge}`,'First duty-station home / rental strategy begins when financially viable.'],[`Age ${raw.physicianStartAge}`,'Modeled start of attending-level physician income.'],[`Age ${raw.retirementAge}`,'Modeled military retirement window; evaluate Texas home and rental consolidation.']];
  document.getElementById('timeline').innerHTML=milestones.map(([title,text])=>`<div class="timeline-item"><strong>${title}</strong><span>${text}</span></div>`).join('');
}

function populateInputs(values){Object.entries(values).forEach(([key,value])=>{const element=document.getElementById(key);if(element)element.value=value})}
let saved=null;try{saved=JSON.parse(localStorage.getItem('lifeDashboardAssumptions')||'null')}catch{}
populateInputs(saved||BASE);

document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>{selectedScenario=button.dataset.scenario;updateDashboard()}));
const ageSlider=document.getElementById('ageSlider');
ageSlider.addEventListener('input',event=>updateSelectedAgeMetrics(event.target.value,false));
ageSlider.addEventListener('change',commitSelectedAgeToCharts);ageSlider.addEventListener('pointerup',commitSelectedAgeToCharts);
ageSlider.addEventListener('keyup',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))commitSelectedAgeToCharts()});
document.querySelector('.age-jumps').addEventListener('click',event=>{const button=event.target.closest('[data-jump-age]');if(button&&!button.disabled)updateSelectedAgeMetrics(button.dataset.jumpAge,true)});

const drawer=document.getElementById('assumptionsPanel');
function setDrawer(open){drawer.classList.toggle('open',open);drawer.setAttribute('aria-hidden',String(!open));document.body.style.overflow=open?'hidden':''}
document.getElementById('openAssumptions').onclick=()=>setDrawer(true);document.getElementById('heroEditAssumptions').onclick=()=>setDrawer(true);document.getElementById('closeAssumptions').onclick=()=>setDrawer(false);document.getElementById('closeBackdrop').onclick=()=>setDrawer(false);document.addEventListener('keydown',event=>{if(event.key==='Escape')setDrawer(false)});
document.getElementById('assumptionsForm').addEventListener('submit',event=>{event.preventDefault();updateDashboard();setDrawer(false)});
document.getElementById('resetAssumptions').onclick=()=>{populateInputs(BASE);localStorage.removeItem('lifeDashboardAssumptions');updateDashboard()};
updateDashboard();
