import { realToNominal } from './currency.js';

const ACTIVE = (s, year) => year >= (s.startYear ?? -Infinity) && year <= (s.endYear ?? Infinity);
export function spendingForYear({ schedules, adjustments = [], year, priceIndex, baseCurrencyYear }) {
  const values = new Map();
  for (const schedule of schedules.filter(s => ACTIVE(s, year))) {
    let amount = schedule.amountCents;
    if (schedule.valueBasis === 'real') amount = realToNominal(amount, schedule.baseYear ?? baseCurrencyYear, year, priceIndex);
    else if (schedule.inflationRate != null) amount = Math.round(amount * (1 + schedule.inflationRate) ** (year - (schedule.baseYear ?? year)));
    values.set(schedule.id, { ...schedule, amountCents: amount });
  }
  for (const adjustment of adjustments.filter(a => ACTIVE(a, year))) {
    for (const [id, item] of values) if (item.category === adjustment.category) {
      if (adjustment.operation === 'replace') values.set(id, { ...item, amountCents: adjustment.amountCents });
      if (adjustment.operation === 'increase') values.set(id, { ...item, amountCents: item.amountCents + adjustment.amountCents });
      if (adjustment.operation === 'multiply') values.set(id, { ...item, amountCents: Math.round(item.amountCents * adjustment.factor) });
      if (adjustment.operation === 'end') values.delete(id);
    }
    if (adjustment.operation === 'start') values.set(adjustment.id, { ...adjustment, amountCents: adjustment.amountCents });
  }
  const entries = [...values.values()];
  return { entries, essentialCents: entries.filter(e => e.classification === 'essential').reduce((s,e)=>s+e.amountCents,0), discretionaryCents: entries.filter(e => e.classification === 'discretionary').reduce((s,e)=>s+e.amountCents,0), oneTimeCents: entries.filter(e => e.oneTime).reduce((s,e)=>s+e.amountCents,0), totalCents: entries.reduce((s,e)=>s+e.amountCents,0) };
}
export function emergencyReserveStatus({ annualEssentialSpendingCents, actualReserveCents, reserveMonths = 6 }) {
  const requiredCents = Math.round(annualEssentialSpendingCents * reserveMonths / 12), differenceCents = actualReserveCents - requiredCents;
  return { reserveMonths, requiredCents, actualCents: actualReserveCents, surplusCents: Math.max(0,differenceCents), shortfallCents: Math.max(0,-differenceCents), status: differenceCents >= 0 ? 'adequate' : 'shortfall' };
}

