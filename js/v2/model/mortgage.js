import { assertCents } from './money.js';

export function monthlyPaymentCents(principalCents,annualRate,termMonths){
  assertCents(principalCents,'Principal');
  if(!Number.isInteger(termMonths)||termMonths<=0) throw new TypeError('Term months must be positive integer.');
  if(!Number.isFinite(annualRate)||annualRate<0) throw new TypeError('Annual rate must be nonnegative.');
  if(annualRate===0)return Math.round(principalCents/termMonths);
  const r=annualRate/12,factor=(1+r)**termMonths;
  return Math.round(principalCents*r*factor/(factor-1));
}

export function amortizeMortgage({principalCents,annualRate,termMonths,startDate,throughYear,extraPrincipalByMonth={},payoffDate=null}){
  const scheduledPaymentCents=monthlyPaymentCents(principalCents,annualRate,termMonths);
  let balance=principalCents,month=String(startDate).slice(0,7),paymentNumber=0;
  const rows=[];
  while(balance>0&&paymentNumber<termMonths&&Number(month.slice(0,4))<=throughYear){
    const [yearValue,monthValue]=month.split('-').map(Number);
    const nextMonth=monthValue===12?`${yearValue+1}-01`:`${yearValue}-${String(monthValue+1).padStart(2,'0')}`;
    month=nextMonth; paymentNumber++;
    if(Number(month.slice(0,4))>throughYear)break;
    if(payoffDate&&`${month}-01`>payoffDate)break;
    const interestCents=Math.round(balance*(annualRate/12));
    const scheduledPrincipalCents=Math.min(balance,Math.max(0,scheduledPaymentCents-interestCents));
    const extraCents=Math.min(balance-scheduledPrincipalCents,extraPrincipalByMonth[month]??0);
    const principalPaidCents=scheduledPrincipalCents+extraCents;
    const paymentCents=interestCents+principalPaidCents;
    const openingBalanceCents=balance;balance-=principalPaidCents;
    rows.push({month,openingBalanceCents,paymentCents,interestCents,principalPaidCents,extraPrincipalCents:extraCents,closingBalanceCents:balance});
  }
  if(payoffDate&&balance>0){rows.push({month:payoffDate.slice(0,7),openingBalanceCents:balance,paymentCents:balance,interestCents:0,principalPaidCents:balance,extraPrincipalCents:balance,closingBalanceCents:0,payoff:true});balance=0;}
  return {scheduledPaymentCents,rows,closingBalanceCents:balance};
}

export function aggregateMortgageYear(rows,year){const selected=rows.filter(r=>Number(r.month.slice(0,4))===year);return{interestCents:selected.reduce((s,r)=>s+r.interestCents,0),principalPaidCents:selected.reduce((s,r)=>s+r.principalPaidCents,0),extraPrincipalCents:selected.reduce((s,r)=>s+r.extraPrincipalCents,0),paymentsCents:selected.reduce((s,r)=>s+r.paymentCents,0),closingBalanceCents:selected.at(-1)?.closingBalanceCents};}
