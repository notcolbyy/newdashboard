const allowedViews=new Set(['overview','cash-flow','assets','timeline','model']);

export function createAppStore(initial={}){
  let state={activeView:'overview',model:null,editor:null,setupSection:'setup',loadState:'NO_MODEL',validation:null,readiness:null,health:null,audit:null,simulation:null,manifest:null,selectedYear:null,selectedTimelineItemId:null,timelineCategory:'all',importCandidate:null,importResult:null,error:null,...structuredClone(initial)};
  const listeners=new Set();
  const getState=()=>state;
  const setState=patch=>{state={...state,...(typeof patch==='function'?patch(state):patch)};for(const listener of listeners)listener(state);return state;};
  return{getState,setState,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},setView(view){return setState({activeView:allowedViews.has(view)?view:'overview'});},setSelectedYear(year,{notify=true}={}){const years=state.simulation?.years??[];if(!years.length)return state;const bounded=Math.min(years.at(-1).year,Math.max(years[0].year,Number(year)));if(notify)return setState({selectedYear:bounded});state={...state,selectedYear:bounded};return state;},selectTimeline(item){const date=item?.realizedDate??item?.plannedDate,year=Number(String(date??'').slice(0,4));return setState({selectedTimelineItemId:item?.id??null,...(Number.isInteger(year)?{selectedYear:year}:{})});}};
}

export function selectedAnnualResult(state){return state.simulation?.years?.find(row=>row.year===state.selectedYear)??state.simulation?.years?.[0]??null;}

export function referenceAge(row,model){if(!row)return null;const reference=model?.people?.find(person=>person.isReference)??model?.people?.[0];return reference?row.ages?.[reference.id]??null:Object.values(row.ages??{})[0]??null;}
