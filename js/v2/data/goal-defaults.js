export const GOAL_PLANNING_DEFAULTS=Object.freeze({
  provenanceId:'planning.goals.defaults.m4',
  longTermHome:{downPaymentRate:.20,buyerClosingCostRate:.02,maintenanceRate:.01,maxComfortHousingBurden:.27,housingBurdenDenominator:'afterTaxIncome',minimumPostPurchaseLiquidityCents:5_000_000},
  priorityPolicy:{id:'priorityAndUrgency',samePriorityDefault:'proportional',unallocatedCashBehavior:'retainAsCash'}
});

