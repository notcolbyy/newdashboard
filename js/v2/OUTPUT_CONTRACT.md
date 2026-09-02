# V2 authoritative output contract

Contract version: **2.0.0**

V2.0 fields documented here are stable for UI consumers. Additive fields may be introduced without changing the major contract version. Renames, removals, unit changes, or semantic changes require a breaking contract version, calculation `modelVersion` review, regression tests, and migration review when persisted input is affected.

`simulateFinancialLife(modelInput, { data, taxTables })` is the supported integration boundary for future UI work. Internal helper and fixture shapes are not UI contracts.

## Top-level result

- `metadata`: validity, schema/calculation version, base currency year, deterministic timing policy, and unresolved-choice policy.
- `years`: ordered annual results.
- `timeline`: normalized planned, realized, delayed, decision, transition, and goal items.
- `timelineDeltas`: planned-versus-realized date differences.
- `realizedEvents`: immutable event outcomes.
- `decisions`: normalized property, goal, conversion, sale, and allocation decisions.
- `goalResults`: year-keyed normalized goal evaluations.
- `goals`: final goal records with full status histories.
- `warnings`: normalized model-health records.
- `errors`: validation or simulation errors. Ordinary infeasibility is a decision, not an error.
- `invariants`: aggregate cash, balance-sheet, net-worth, property-equity, and goal-funding checks.

## Annual result

Each `years[]` row has a stable `id` (`annual:<year>`) and includes:

- `year`, `ages`, `careers`, `householdState`
- `income`, `taxes`, `spending`, `cashFlow`
- `accounts.items`, `accounts.activity`
- `liabilities.items`, `liabilities.activity`
- `properties`, `propertyPortfolio`
- `goals`, `decisions`, `events`, `warnings`
- `balanceSheet`, `netWorthDecomposition`, `contributionVsGrowth`
- `timeline`, `nextMajorMilestone`, `deltas`, `narrator`
- `reconciliation`

All monetary fields use integer cents. Rates are decimals. Calendar dates use ISO `YYYY-MM-DD` strings.

## Balance sheet

`balanceSheet.assets.items` is the itemized source of gross assets. Each record preserves ownership shares and carries an account/asset/property category. `balanceSheet.liabilities.items` is the itemized source of liabilities and carries owner and linked-asset references.

Canonical totals are:

- `grossAssetsCents`
- `totalLiabilitiesCents`
- `totalNetWorthCents`
- `liquidNetWorthCents`
- `investableNetWorthCents`
- `realEstateEquityCents`
- `ownership.household` and `ownership.entities`

Joint assets appear once in household totals and are apportioned only in ownership views.

## Cash flow

`cashFlow` exposes normalized `income`, `taxes`, `spending`, `debt`, `allocation`, and `assetTransactions`. Property-sale proceeds are asset transactions—not income. Employer/government contributions are wealth inflows—not earned household cash.

`freeCashFlowCents` means cash remaining after taxes, modeled spending, required debt service, and required one-time expenses, before optional investing and goals. Goal-specific analyses may additionally report pre/post-goal FCF without redefining the base metric.

## Accounts and contribution-versus-growth

Account activity contains opening/closing balance, employee contributions, employer/government contributions, growth, withdrawals, and zero-economic-effect transfers in/out. The contribution-versus-growth summary aggregates these without treating transfers as returns.

## Properties

Each property row carries status, ownership, status history, valuation, authoritative linked-debt opening/closing activity, equity, primary-residence costs, rental statement, reserve status, PCS decision, and sale result. Mortgage balances live in the liability state; property equity always resolves as market value minus linked liability.

## Goals and decisions

Goal rows expose status, real/nominal target, funded/permitted amounts, shortfall, possible/comfortable flags, blockers, funding plan, and next reevaluation. Decisions contain stable IDs, rules, actuals, thresholds, shortfalls, primary/secondary blockers, explanations, and resulting entity/event references when executed.

An unresolved `needsUserChoice` remains unexecuted unless `metadata.unresolvedChoicePolicy` names an explicit baseline fallback. The engine never chooses by maximizing terminal wealth.

## Timeline and explanations

Timeline items include ID, type/category, target, planned/realized dates, status, summary/reason, financial effects, source event, related decision/entity IDs, and provenance IDs. `timelineDeltas` provides timing difference and blocker context.

Narrator observations contain a deterministic type/priority, rendered text, deduplication signature, and trace object. Trace fields point to calculation, component, event, decision, rule, warning, timeline, or entity IDs. Consumers should use these references for expandable “Why?” views.

## Warnings and provenance

Warnings contain code, severity, year/date, affected entity, explanation, provenance IDs, and trace references. Projected year-keyed fallbacks remain distinguishable from official observations. Warnings do not silently change decisions or balances.

## Reconciliation

Every annual result reports:

- general-cash reconciliation
- balance-sheet reconciliation
- economic net-worth-change reconciliation
- property-equity reconciliation
- goal-funding reconciliation

The top-level `invariants.passes` is true only when every annual invariant passes.

## Reproducibility boundary

`simulateReproducibly` wraps the authoritative simulation with a run manifest containing engine, model, schema, output-contract, input, assumption, and normalized-data identities. `schemaVersion` describes persisted structure; `modelVersion` describes calculation behavior. Replay is guaranteed only while the matching engine/model version and normalized datasets remain supported.
