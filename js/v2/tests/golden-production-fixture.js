import { goldenIntegratedFixture } from './golden-integrated-fixture.js';
import { FINAL_MODEL_VERSION } from '../storage/schema.js';
import { FEDERAL_TAX_2026, projectFederalTaxTable } from '../data/official-2026.js';

export function goldenProductionFixture({throughAge95=false}={}){
  const fixture=goldenIntegratedFixture(),model=structuredClone(fixture.model);model.modelVersion=FINAL_MODEL_VERSION;
  if(throughAge95){const endYear=2099;model.household.simulationEndYear=endYear;for(const stage of model.careers)if(stage.endDate==='2043-01-01')stage.endDate='2100-01-01';for(const schedule of model.spendingSchedules)if(schedule.endYear===2042)schedule.endYear=endYear;for(const adjustment of model.spendingAdjustments)if(adjustment.endYear===2042)adjustment.endYear=endYear;for(let year=2043;year<=endYear;year++)fixture.taxTables[year]=projectFederalTaxTable(FEDERAL_TAX_2026,year,.025);}
  return{model,data:fixture.data,taxTables:fixture.taxTables};
}

export const priorSchemaFixture=()=>{
  const {model}=goldenProductionFixture();const prior=structuredClone(model);prior.schemaVersion='1.5.0';delete prior.properties;delete prior.goals;delete prior.serviceHistories;prior.futurePreservedField={keep:true};return prior;
};
