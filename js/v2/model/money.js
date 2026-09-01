export const CENTS_PER_DOLLAR = 100;
export const MONEY_TOLERANCE_CENTS = 1;

export function dollarsToCents(value) {
  if (!Number.isFinite(value)) throw new TypeError('Money value must be finite.');
  return Math.round(value * CENTS_PER_DOLLAR);
}

export function centsToDollars(value) {
  assertCents(value);
  return value / CENTS_PER_DOLLAR;
}

export function assertCents(value, label = 'Money') {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be integer cents.`);
}

export function sumCents(values) {
  return values.reduce((total, value) => {
    assertCents(value);
    return total + value;
  }, 0);
}

export function applyRate(cents, annualRate) {
  assertCents(cents);
  if (!Number.isFinite(annualRate)) throw new TypeError('Rate must be finite.');
  return Math.round(cents * annualRate);
}

export function withinTolerance(actual, expected, tolerance = MONEY_TOLERANCE_CENTS) {
  return Math.abs(actual - expected) <= tolerance;
}
