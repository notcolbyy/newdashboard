export const COMPENSATION_TYPES=Object.freeze(['military','physician','pension','employment','other']);

export function createCompensationRecord(input){
  if(!input.id||!input.personId||!COMPENSATION_TYPES.includes(input.type))throw new TypeError('Compensation requires id, personId, and supported type.');
  if(!Number.isSafeInteger(input.taxableCents??0)||!Number.isSafeInteger(input.nontaxableCents??0))throw new TypeError('Compensation amounts must be integer cents.');
  return Object.freeze({id:input.id,personId:input.personId,type:input.type,period:input.period,taxableCents:input.taxableCents??0,nontaxableCents:input.nontaxableCents??0,payrollWagesCents:input.payrollWagesCents??input.taxableCents??0,retirementEligibleCents:input.retirementEligibleCents??0,provenanceIds:Object.freeze([...(input.provenanceIds??[])]),metadata:Object.freeze({...input.metadata})});
}

export function compensationToIncomeEntries(records){return records.flatMap(record=>[{id:`${record.id}:taxable`,ownerId:record.personId,type:`${record.type}.taxable`,amountCents:record.taxableCents,taxable:true,startYear:Number(record.period.slice(0,4))},{id:`${record.id}:nontaxable`,ownerId:record.personId,type:`${record.type}.nontaxable`,amountCents:record.nontaxableCents,taxable:false,startYear:Number(record.period.slice(0,4))}].filter(item=>item.amountCents!==0));}
