import { realToNominal } from './currency.js';
import { sumCents } from './money.js';

export const GOAL_PRIORITIES=Object.freeze(['hard','protected','important','optional']);
export const GOAL_STATUSES=Object.freeze(['planned','funding','possible','comfortablyAffordable','delayed','executed','rejected','needsUserChoice','completed']);
export const GOAL_PRIORITY_RANK=Object.freeze({hard:0,protected:1,important:2,optional:3});

const integer=n=>Number.isSafeInteger(n)&&n>=0;

export function validateGoalRecord(goal){
  const errors=[];
  if(!goal?.id)errors.push('Goal id is required.');
  if(!goal?.name)errors.push('Goal name is required.');
  if(!goal?.type)errors.push('Goal type is required.');
  if(!GOAL_PRIORITIES.includes(goal?.priority))errors.push(`Invalid goal priority: ${goal?.priority}.`);
  if(goal?.target?.basis&&!['real','nominal'].includes(goal.target.basis))errors.push('Goal target basis must be real or nominal.');
  if(goal?.target?.amountCents!=null&&!integer(goal.target.amountCents))errors.push('Goal target amount must be non-negative integer cents.');
  const policy=goal?.fundingPolicy;
  if(!policy||!Array.isArray(policy.permittedSources)||!policy.permittedSources.length)errors.push('Goal funding policy requires permittedSources.');
  if(policy?.permittedSources?.includes('retirement'))errors.push('Retirement accounts are protected unless a future explicit exception rule is implemented.');
  return{valid:errors.length===0,errors};
}

export function createGoalRecord(input){
  const goal={id:input.id,name:input.name,type:input.type,scope:input.scope??'household',ownerIds:structuredClone(input.ownerIds??[]),enabled:input.enabled!==false,earliestDesiredDate:input.earliestDesiredDate??null,preferredWindow:structuredClone(input.preferredWindow??null),latestAcceptableDate:input.latestAcceptableDate??null,plannedTiming:structuredClone(input.plannedTiming??null),realizedTiming:null,target:structuredClone(input.target),priority:input.priority,priorityOrder:input.priorityOrder??null,samePriorityPolicy:input.samePriorityPolicy??'proportional',fundingPolicy:structuredClone(input.fundingPolicy),constraints:structuredClone(input.constraints??{}),home:structuredClone(input.home??null),status:'planned',statusHistory:[],provenanceIds:structuredClone(input.provenanceIds??[]),metadata:structuredClone(input.metadata??{})};
  const validation=validateGoalRecord(goal);if(!validation.valid)throw new TypeError(validation.errors.join(' '));return structuredClone(goal);
}

export function goalTargetForYear(goal,year,index){
  const amount=goal.target.amountCents,baseYear=goal.target.baseYear;
  if(goal.target.basis==='nominal')return{realAmountCents:baseYear===year?amount:null,nominalAmountCents:amount,baseYear,year,state:'entered'};
  const nominalAmountCents=realToNominal(amount,baseYear,year,index);return{realAmountCents:amount,nominalAmountCents,baseYear,year,state:index[year]?.state==='official'?'derived':'projected',provenanceId:index[year]?.provenanceId};
}

export function goalFundingProgress({requiredCents,dedicatedCents=0,permittedSources=[]}){
  const sourceComposition=permittedSources.map(s=>({sourceId:s.sourceId,type:s.type,availableCents:Math.max(0,s.availableCents??0)})),permittedFundingCents=sumCents(sourceComposition.map(s=>s.availableCents)),remainingShortfallCents=Math.max(0,requiredCents-permittedFundingCents),dedicatedFundingCents=Math.min(requiredCents,Math.max(0,dedicatedCents));
  return{requiredCents,permittedFundingCents,dedicatedFundingCents,remainingShortfallCents,percentFunded:requiredCents>0?Math.min(1,permittedFundingCents/requiredCents):1,sourceComposition};
}

function allocateProportionally(group,available){
  const total=sumCents(group.map(g=>g.remainingCents)),budget=Math.min(available,total),sorted=[...group].sort((a,b)=>String(a.id).localeCompare(String(b.id)));let used=0;
  const out=sorted.map((goal,index)=>{const allocation=index===sorted.length-1?Math.min(goal.remainingCents,budget-used):Math.min(goal.remainingCents,Math.floor(budget*goal.remainingCents/total));used+=allocation;return{goalId:goal.id,allocatedCents:allocation,remainingCents:goal.remainingCents-allocation};});
  let leftover=budget-used;for(const row of out){if(!leftover)break;const add=Math.min(leftover,row.remainingCents);row.allocatedCents+=add;row.remainingCents-=add;leftover-=add;}return out;
}

export function allocateGoalFunding({availableCashCents,preallocations=[],goals,samePriorityPolicy='proportional'}){
  let available=availableCashCents;const preallocationResults=[];
  for(const item of [...preallocations].sort((a,b)=>(a.rank??0)-(b.rank??0)||String(a.id).localeCompare(String(b.id)))){const allocation=Math.min(available,item.requiredCents);available-=allocation;preallocationResults.push({...item,allocatedCents:allocation,shortfallCents:item.requiredCents-allocation,pass:allocation===item.requiredCents});}
  const allocations=[],conflicts=[];
  for(const priority of GOAL_PRIORITIES){const group=goals.filter(g=>g.enabled!==false&&g.priority===priority&&g.remainingCents>0);if(!group.length)continue;const policy=group.some(g=>g.samePriorityPolicy==='ordered')?'ordered':samePriorityPolicy;
    const rows=policy==='ordered'?[...group].sort((a,b)=>(a.priorityOrder??Number.MAX_SAFE_INTEGER)-(b.priorityOrder??Number.MAX_SAFE_INTEGER)||String(a.id).localeCompare(String(b.id))).map(goal=>{const amount=Math.min(available,goal.remainingCents);available-=amount;return{goalId:goal.id,allocatedCents:amount,remainingCents:goal.remainingCents-amount};}):allocateProportionally(group,available);
    if(policy==='proportional')available-=sumCents(rows.map(r=>r.allocatedCents));
    for(const row of rows){const goal=group.find(g=>g.id===row.goalId),status=row.remainingCents===0?'funded':row.allocatedCents>0?'funding':'delayed';allocations.push({...row,priority,policy,status});if(status==='delayed'||row.remainingCents>0)conflicts.push({goalId:row.goalId,status:'delayed',reason:`${goal.name} cannot receive full funding after higher-priority allocations.`,blockedBy:allocations.filter(a=>GOAL_PRIORITY_RANK[a.priority]<GOAL_PRIORITY_RANK[priority]&&a.allocatedCents>0).map(a=>a.goalId)});}
  }
  return{policy:{id:'priorityAndUrgency',description:'Fund obligations and reserves first, then goals by priority; same-priority goals are proportional unless explicitly ordered.'},openingAvailableCents:availableCashCents,preallocations:preallocationResults,allocations,conflicts,unallocatedCashCents:available};
}

export function appendGoalStatus(goal,{date,status,reason,decisionId=null,blockerIds=[],metrics={}}){if(!GOAL_STATUSES.includes(status))throw new TypeError(`Invalid goal status: ${status}`);const next=structuredClone(goal);next.status=status;next.statusHistory.push({date,status,reason,decisionId,blockerIds:structuredClone(blockerIds),metrics:structuredClone(metrics)});if(status==='executed')next.realizedTiming={date};return next;}
