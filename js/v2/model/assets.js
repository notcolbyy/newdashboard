export const ASSET_STATUSES=Object.freeze(['planned','acquired','held','primaryResidence','rental','vacantTransition','pendingSale','sold','disposed','other']);
export const WEALTH_ROLES=Object.freeze(['productive','reserve','personal-use']);
export const LIQUIDITY_CLASSES=Object.freeze(['immediate','marketable','restricted','illiquid']);

export function validateOwnership(ownership){
  if(!Array.isArray(ownership)||!ownership.length)throw new TypeError('Asset ownership requires at least one owner.');
  const total=ownership.reduce((sum,o)=>sum+o.share,0);if(ownership.some(o=>!o.ownerId||!Number.isFinite(o.share)||o.share<=0)||Math.abs(total-1)>1e-9)throw new TypeError('Ownership shares must be positive and total 1.');return true;
}

export function createAssetRecord(input){
  validateOwnership(input.ownership);if(!input.id||!input.name||!input.type)throw new TypeError('Asset requires id, name, and type.');if(!ASSET_STATUSES.includes(input.status))throw new TypeError(`Unsupported asset status: ${input.status}`);
  return structuredClone({id:input.id,name:input.name,type:input.type,ownership:input.ownership,acquisitionDate:input.acquisitionDate??null,acquisitionBasisCents:input.acquisitionBasisCents??0,currentValueCents:input.currentValueCents??0,liquidity:input.liquidity??'illiquid',wealthRole:input.wealthRole??'personal-use',linkedLiabilityIds:input.linkedLiabilityIds??[],status:input.status,statusHistory:input.statusHistory??[],valuationRule:input.valuationRule??null,dispositionPlan:input.dispositionPlan??null,provenanceIds:input.provenanceIds??[],metadata:input.metadata??{}});
}

export function transitionAsset(asset,{effectiveDate,newStatus,triggeringPlannedEventId=null,realizedEventId=null,explanation}){
  if(!ASSET_STATUSES.includes(newStatus))throw new TypeError(`Unsupported asset status: ${newStatus}`);const next=structuredClone(asset),previousStatus=next.status;next.status=newStatus;next.statusHistory.push({effectiveDate,previousStatus,newStatus,triggeringPlannedEventId,realizedEventId,explanation});return next;
}

export function disposeAsset(asset,input){return transitionAsset(asset,{...input,newStatus:input.newStatus??'disposed'});}

