import { applyRate } from './money.js';

export function calculateLiabilityYear({
  id,
  ownerId,
  type = 'generic',
  originalPrincipalCents,
  openingBalanceCents,
  annualRate = 0,
  scheduledPaymentCents = 0,
  extraPrincipalCents = 0
}) {
  if (!Number.isInteger(openingBalanceCents) || openingBalanceCents < 0) throw new TypeError('openingBalanceCents must be a non-negative integer.');
  if (!Number.isFinite(annualRate) || annualRate < 0) throw new TypeError('annualRate must be a non-negative number.');
  if (!Number.isFinite(scheduledPaymentCents) || scheduledPaymentCents < 0 || !Number.isFinite(extraPrincipalCents) || extraPrincipalCents < 0) throw new TypeError('Payments must be non-negative numbers.');
  const interestCents = applyRate(openingBalanceCents, annualRate);
  const amountDueCents = openingBalanceCents + interestCents;
  const scheduledPaidCents = Math.min(Math.round(scheduledPaymentCents), amountDueCents);
  const interestPaidCents = Math.min(scheduledPaidCents, interestCents);
  const scheduledPrincipalCents = scheduledPaidCents - interestPaidCents;
  const balanceAfterScheduledCents = amountDueCents - scheduledPaidCents;
  const extraPaidCents = Math.min(Math.round(extraPrincipalCents), balanceAfterScheduledCents);
  const principalPaidCents = scheduledPrincipalCents + extraPaidCents;
  const closingBalanceCents = balanceAfterScheduledCents - extraPaidCents;
  return {
    id,
    ownerId,
    type,
    originalPrincipalCents: originalPrincipalCents ?? openingBalanceCents,
    openingBalanceCents,
    interestCents,
    scheduledPaymentCents: scheduledPaidCents,
    principalPaidCents,
    extraPrincipalCents: extraPaidCents,
    totalPaymentCents: scheduledPaidCents + extraPaidCents,
    closingBalanceCents
  };
}
