# Military readiness correction

Classification: service history is both a template-factory omission and an authoritative readiness gap; BAH is an authoritative readiness gap. Neither investigation demonstrated a data-resolution defect or required a change to compensation semantics.

Minimal reproduction: a one-year 2026 production baseline with a dated reference person, single filing status, four explicit zero balances, and one military career. Without history, the previously READY model throws in serviceSnapshot (model/service.js), called by militaryCompensationForPeriod (model/military.js). Supplying periods and an effective supported pay grade allows basic pay; removing the allowance fallback then throws in lookupBah (model/military.js).

Service is required for every active military compensation period, not only JAG, retirement, or later service years. No production derivation creates missing history from career dates. Dates/grades are explicit model inputs; planned future service can be populated as an identified planning structure without fabricating historical service. BRS contribution policies separately read the first service-period start. Public tables supply pay rates, not personal service history.

BAH is called unconditionally for active military compensation; this contract has no allowance-disabled switch. Resolution order is explicit override (including zero), exact official year/location/grade/dependency key, then positive planning fallback. The normal UI runtime supplies an empty official BAH table. There is no national default. Official records may be supplied to readiness via its optional data context, matching direct simulation inputs; default UI readiness requires explicit allowance inputs.

New structured codes identify military timing, service timeline, pay-grade timeline, and housing allowance. Issues carry career paths, entity IDs, and Careers setup routing. Requirements apply only to enabled people with military compensation during the projection period. Generic/physician and out-of-period careers do not acquire military requirements. The existing engine does not provide a separate career-enabled switch; person disabling is honored.

Existing schema represents these structures. No migration, financial calculation, output shape, engine version, or contract version changes. Model/schema remain 2.0.0, engine v2.0.2, output contract 2.0.2. Eight focused regressions pass alongside the full 304-test suite. Production UI returns before simulation on incomplete readiness; this is not exception relabeling.
