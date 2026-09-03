import { resolveEventDate, resolvePeople } from './calendar.js';

export function resolvePlannedEvents(events,people){
  const resolvedPeople=resolvePeople(people);
  return events.filter(event=>event.enabled!==false).map(event=>Object.freeze({...structuredClone(event),resolvedDate:resolveEventDate(event,resolvedPeople)})).sort((a,b)=>a.resolvedDate.localeCompare(b.resolvedDate)||String(a.id).localeCompare(String(b.id)));
}

export function realizeEvent(planned,actualDate,result='executed',reason='Scheduled event occurred.',financialEffects=[]){
  return Object.freeze({id:`realized:${planned.id}`,plannedEventId:planned.id,type:planned.type,target:planned.target??null,plannedDate:planned.resolvedDate,actualDate,result,reason,financialEffects:structuredClone(financialEffects)});
}
