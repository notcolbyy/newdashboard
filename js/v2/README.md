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

## V2.1 production interface

The static, GitHub Pages-compatible interface is isolated at `/v2/`; V1 remains the root experience. Its seven implemented destinations are Overview, Cash Flow, Assets, Real Estate, Goals, Timeline, and Model. All analytical views read the same cached authoritative `simulateFinancialLife` result and the same global selected year. Navigation, slider movement, timeline focus, property/goal selection, disclosures, and cross-links do not simulate.

The setup workflow is: create or import a model, configure people and period, starting finances, careers, household, spending, assumptions, and supported future events, review structured validation, save through the production persistence adapter, then simulate once if readiness permits. Draft edits remain separate from the persisted model. Invalid drafts cannot overwrite a valid save; valid incomplete models may be resumed later. Imports are reviewed before confirmation, exports default to persisted state, and damaged saves are preserved with explicit backup recovery when available.

Readiness (`INVALID`, `INCOMPLETE_CONFIGURATION`, `READY`, or `READY_WITH_WARNINGS`) describes whether the document can simulate. Model health separately reports validation, provenance, projected fallbacks, unresolved choices, migrations, and simulation warnings. Financial difficulty and decision blockers are results rather than application errors. Material assumption origins retain the V2 provenance classifications.

The UI is presentational. It may format, group, sort, and draw coordinates from authoritative annual output, but it does not calculate taxes, FCF, NOI, mortgage activity, equity, affordability, home-price inflation, sale proceeds, goal shortfall, or strategy viability. KEEP/SELL displays consume `strategyComparison`; they are not ranked and no winner is inferred.

### Version matrix

| Boundary | Version |
| --- | --- |
| Engine | `v2.0.1` |
| Model | `2.0.0` |
| Schema | `2.0.0` |
| Output contract | `2.0.1` |
| Interface release | `V2.1` |

### Deployment verification

Serve the repository root over HTTP, open `/v2/`, and verify all seven hash routes, create/load/import/export, the shared period control, cross-links, and the browser console. After pushing, confirm remote `main`, then confirm the deployed HTML references matching `app.css?v=2.1.5` and `app.js?v=2.1.5`. A stale Pages response is a propagation state, not permission to mix asset revisions.

### Current limitations and deferred work

V2.1 does not model state income tax, Social Security retirement benefits, vehicles, advanced retirement withdrawals, deep retirement adequacy, or detailed VA behavior. V2.2 may add deterministic What If, stress testing, and sensitivity after separate approval. No scenarios, Monte Carlo analysis, optimization, or root-route cutover are part of V2.1.

Run `npm test` for deterministic fixtures. Run `npm run v2:fixture -- --year=2032` for the 2026–2038 golden-household summary. Run `npm run v2:property-fixture -- --year=2034` for the 2030–2039 property lifecycle. Run `npm run v2:goal-fixture -- --year=2040` for the 2036–2041 long-term-home lifecycle and generic goal-priority fixture. Run `npm run v2:financial-life -- 2039` for the authoritative 2026–2042 integrated fixture.

Milestone 6 freezes the V2.0 engine behind a production model-document boundary. `createBaselineModel` creates structure without inventing personal facts; `assessSimulationReadiness` distinguishes a valid document from a configured simulation. Canonical JSON, semantic fingerprints, sequential migrations, an injected persistence adapter, import/export, run manifests, replay, audit, and model-health APIs are all independent of the UI and browser storage implementation. Use `npm run v2:model -- <baseline|validate|export|import|run|manifest|replay>` for developer inspection.
