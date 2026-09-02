export const BASELINE_ALLOCATION_POLICY = Object.freeze({ id:'stabilityFirst', name:'Stability first', description:'Pay obligations, restore emergency reserves, fund protected retirement, invest the configured amount, then retain remaining cash.' });

export function householdStateForYear({ year, plannedEvents, defaultFilingStatus='single' }) {
  const combination=plannedEvents.filter(e=>e.type==='household.combine'&&Number((e.date??`${e.year}-01-01`).slice(0,4))<=year).sort((a,b)=>(a.date??'').localeCompare(b.date??'')).at(-1);
  const filing=plannedEvents.filter(e=>e.type==='tax.filingStatus.change'&&Number((e.date??`${e.year}-01-01`).slice(0,4))<=year).sort((a,b)=>(a.date??'').localeCompare(b.date??'')).at(-1);
  return { combined:Boolean(combination), combinationEventId:combination?.id??null, filingStatus:filing?.filingStatus??defaultFilingStatus, filingEventId:filing?.id??null };
}

