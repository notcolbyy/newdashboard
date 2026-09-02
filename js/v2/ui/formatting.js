const currencyFull=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const numberCompact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
export const formatCurrency=(cents,{compact=false,unavailable='—'}={})=>Number.isSafeInteger(cents)?(compact?`${cents<0?'-':''}$${numberCompact.format(Math.abs(cents)/100)}`:currencyFull.format(cents/100)):unavailable;
export const formatSignedCurrency=cents=>Number.isSafeInteger(cents)?`${cents>0?'+':''}${formatCurrency(cents,{compact:true})}`:'—';
export const formatPercent=value=>Number.isFinite(value)?new Intl.NumberFormat('en-US',{style:'percent',maximumFractionDigits:1}).format(value):'—';
export const titleCase=value=>String(value??'').replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
export const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
export const formatDate=value=>value?new Intl.DateTimeFormat('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`)):'Not scheduled';
