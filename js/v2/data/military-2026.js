import { dollarsToCents } from '../model/money.js';

export const MILITARY_PAY_2026 = Object.freeze({
  year: 2026,
  provenanceId: 'dfas.officerPay.2026',
  serviceYearBreakpoints: [0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18],
  monthlyBasePayCents: {
    'O-2': [478200, 544620, 627240, 648450, 661770, 661770, 661770, 661770, 661770, 661770, 661770],
    'O-3': [553410, 627390, 677040, 738270, 773700, 812550, 837570, 878820, 900420, 900420, 900420]
  }
});

export const OFFICER_BAS = Object.freeze({
  2026: { monthlyCents: dollarsToCents(328.48), provenanceId: 'dfas.bas.2026', state: 'official' }
});

