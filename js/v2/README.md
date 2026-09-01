# V2.0 Milestone 1 kernel

This directory is an additive, headless financial-model layer. It has no dependency on the DOM, `window`, Chart.js, V1 cards, or V1 localStorage keys.

- `data/`: normalized official/researched values and provenance.
- `model/`: pure calendar, currency, tax, service, mortgage, event, decision, and simulation functions.
- `storage/`: versioned document validation and non-destructive migration foundation.
- `tests/`: deterministic fixtures and invariants. V1 regression checks are isolated.
- `dev/`: command-line fixture output; never loaded by production HTML.

Money is stored as integer cents. Intermediate rates use JavaScript numbers and every posted monetary transaction is rounded to the nearest cent. Reconciliation tolerance is one cent. Annual results are authoritative; monthly subperiods are used only where timing materially matters, currently mortgages and service eligibility.
