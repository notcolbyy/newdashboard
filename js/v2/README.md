# V2.0 engine

This directory is an additive, headless financial-model layer. It has no dependency on the DOM, `window`, Chart.js, V1 cards, or V1 localStorage keys.

- `data/`: normalized official/researched values and provenance.
- `model/`: pure calendar, currency, tax, service, mortgage, event, decision, and simulation functions.
- `storage/`: versioned document validation and non-destructive migration foundation.
- `tests/`: deterministic fixtures and invariants. V1 regression checks are isolated.
- `dev/`: command-line fixture output; never loaded by production HTML.

Money is stored as integer cents. Intermediate rates use JavaScript numbers and every posted monetary transaction is rounded to the nearest cent. Reconciliation tolerance is one cent. Annual results are authoritative; monthly subperiods are used only where timing materially matters, currently mortgages and service eligibility.

Milestone 2 adds the engine-only household ledger. Career stages produce compensation records; the ledger then applies taxes, spending, retirement policies, reserves, investing, debt activity, and reconciled net-worth-change explanations. Opening balances receive a full year of configured growth and regular annual contributions receive half-year growth.

Run `npm test` for deterministic fixtures. Run `npm run v2:fixture -- --year=2032` for the 2026–2038 golden-household summary and a detailed selected-year ledger.
