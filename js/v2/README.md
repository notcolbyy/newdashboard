# V2.0 engine

This directory is an additive, headless financial-model layer. It has no dependency on the DOM, `window`, Chart.js, V1 cards, or V1 localStorage keys.

- `data/`: normalized official/researched values and provenance.
- `model/`: pure calendar, currency, tax, service, mortgage, event, decision, and simulation functions.
- `storage/`: versioned document validation and non-destructive migration foundation.
- `tests/`: deterministic fixtures and invariants. V1 regression checks are isolated.
- `dev/`: command-line fixture output; never loaded by production HTML.

Money is stored as integer cents. Intermediate rates use JavaScript numbers and every posted monetary transaction is rounded to the nearest cent. Reconciliation tolerance is one cent. Annual results are authoritative; monthly subperiods are used only where timing materially matters, currently mortgages and service eligibility.

Milestone 2 adds the engine-only household ledger. Career stages produce compensation records; the ledger then applies taxes, spending, retirement policies, reserves, investing, debt activity, and reconciled net-worth-change explanations. Opening balances receive a full year of configured growth and regular annual contributions receive half-year growth.

Milestone 3 adds a generic material-asset lifecycle and a specialized property engine. Property intents are evaluated before acquisition, failed optional purchases can be delayed and reevaluated, and every purchase, conversion, rental operation, reserve movement, sale, and transfer is represented by traceable cash postings, decisions, and realized events. Property mortgages reuse `model/mortgage.js`; there is no second amortization implementation.

The generic lifecycle already supports the state sequence required by a future vehicle module (`planned → acquired → held → sold/disposed`) with preserved ownership, linked liabilities, valuation rules, and status history. Vehicle-specific depreciation, financing choices, trade-in handling, and replacement policies remain intentionally deferred.

Milestone 4 adds reusable goal records, transparent priority allocation, goal-specific funding policies, status histories, deterministic blocker ranking, and a long-term-home feasibility engine. “Possible” means hard transaction and stability constraints pass; “comfortably affordable” additionally requires the configured housing-burden, free-cash-flow, discretionary-capacity, retirement, obligation, and liquidity rules to pass. Housing burden uses annual required housing costs divided by after-tax household income by default. This is a planning convention—not mortgage approval or underwriting.

Goal execution produces a normal Milestone 3 property intent, property asset, linked mortgage, decision, and realized event. Cash, dedicated goal funds, taxable investments, selected sale proceeds, reserves, and protected accounts remain explicit. The engine never sells rentals or optimizes terminal wealth without an enabled policy.

Milestone 5 establishes `simulateFinancialLife(modelInput, { data, taxTables })` as the sole integration contract for future V2 consumers. Earlier simulators remain tested calculation engines, but UI code must not merge their outputs independently. The orchestrator carries one authoritative account, liability, property, goal, event, and decision state across years. Properties reference authoritative linked mortgage liabilities instead of storing another balance.

The exported `WITHIN_YEAR_ORDER` documents the deterministic annual phases. Same-period events sort by effective date, phase, explicit priority, explicit sequence, then stable ID. Monthly calculations remain limited to career/service transitions, BRS eligibility, mortgage amortization, property transactions, and partial-year rental operations; integer-cent activity rolls into annual results.

Each unified annual result contains normalized ages/careers, income, taxes, spending, cash flow, account and liability activity, property operations, goal evaluations, decisions, events, warnings, an ownership-aware balance sheet, one net-worth decomposition, contribution-versus-growth data, year-over-year deltas, timeline items, narrator observations, and reconciliation invariants. `freeCashFlowCents` means cash remaining after taxes, modeled spending, required debt service, and required one-time expenses, before optional investing and goals. Net-worth definitions come only from `buildBalanceSheetSnapshot`.

Validation errors prevent simulation. Reconciliation failures are simulation failures. Warnings permit deterministic continuation with degraded/projected assumptions. Ordinary financial infeasibility is a decision result, not an exception. `needsUserChoice` leaves an action unexecuted unless a visible named fallback policy explicitly selects a baseline.

Run `npm test` for deterministic fixtures. Run `npm run v2:fixture -- --year=2032` for the 2026–2038 golden-household summary. Run `npm run v2:property-fixture -- --year=2034` for the 2030–2039 property lifecycle. Run `npm run v2:goal-fixture -- --year=2040` for the 2036–2041 long-term-home lifecycle and generic goal-priority fixture. Run `npm run v2:financial-life -- 2039` for the authoritative 2026–2042 integrated fixture.

Milestone 6 freezes the V2.0 engine behind a production model-document boundary. `createBaselineModel` creates structure without inventing personal facts; `assessSimulationReadiness` distinguishes a valid document from a configured simulation. Canonical JSON, semantic fingerprints, sequential migrations, an injected persistence adapter, import/export, run manifests, replay, audit, and model-health APIs are all independent of the UI and browser storage implementation. Use `npm run v2:model -- <baseline|validate|export|import|run|manifest|replay>` for developer inspection.
