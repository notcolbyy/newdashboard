# V2.0 model document and replay contract

The persisted model is JSON-compatible input, not a cached simulation. `schemaVersion` identifies storage structure; `modelVersion` identifies calculation behavior; `outputContractVersion` identifies the stable result API. They change independently.

## Production baseline

`createBaselineModel()` supplies entity structure, named policies, editable planning conventions, and provenance. Unknown personal facts remain `null` with an explicit `intentionallyUnset` state. A baseline can be structurally valid while `assessSimulationReadiness()` reports `INCOMPLETE_CONFIGURATION`.

## Canonical form and identity

Serialization sorts object keys and preserves array order so round trips are lossless. The semantic model fingerprint additionally sorts identity-based collections (`people`, `accounts`, `liabilities`, `assets`, `properties`, `propertyIntents`, `careers`, `serviceHistories`, `plannedEvents`, and `goals`) by ID. Ordered calculation arrays remain ordered. Save timestamps and presentation-only extensions are excluded from financial identity.

Fingerprints use a browser-compatible deterministic FNV-1a 64-bit checksum. This is a reproducibility identifier, not a cryptographic security control.

## Persistence and recovery

The adapter receives a storage implementation; model code never accesses browser storage. `lifeWealth:v2:model` is isolated from V1. A candidate is validated and serialized before writing. A previously valid save is copied to `lifeWealth:v2:model:backup`. Parse, envelope, migration, and validation failures preserve the original data and return structured recovery metadata.

## Migration and replay

Migrations are sequential, immutable, deterministic, preserve unknown fields, and report introduced defaults. Unknown future schemas fail closed. Import never writes storage.

Replay is guaranteed only with the same supported engine/model version and the same normalized-data fingerprint. The manifest records model, assumption, data, and output fingerprints. A future build that no longer ships the historical engine reports `UNSUPPORTED_VERSION` instead of approximating the old result.

