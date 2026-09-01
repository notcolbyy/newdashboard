export const PROVENANCE_STATES = Object.freeze([
  'official', 'estimated', 'derived', 'projected', 'userEntered', 'scenarioAdjusted'
]);

export function validateProvenanceRecord(record) {
  const errors = [];
  if (!record?.id) errors.push('Provenance record requires id.');
  if (!PROVENANCE_STATES.includes(record?.classification)) errors.push(`Invalid provenance classification for ${record?.id ?? 'unknown'}.`);
  if (!record?.source?.title || !record?.source?.url) errors.push(`Provenance ${record?.id ?? 'unknown'} requires source title and URL.`);
  if (!record?.sourceType) errors.push(`Provenance ${record?.id ?? 'unknown'} requires sourceType.`);
  if (!record?.effectiveDate) errors.push(`Provenance ${record?.id ?? 'unknown'} requires effectiveDate.`);
  if (typeof record?.editable !== 'boolean') errors.push(`Provenance ${record?.id ?? 'unknown'} requires editable boolean.`);
  return errors;
}

export function createProvenanceRegistry(records) {
  const registry = {};
  for (const record of records) {
    const errors = validateProvenanceRecord(record);
    if (errors.length) throw new TypeError(errors.join(' '));
    if (registry[record.id]) throw new TypeError(`Duplicate provenance id: ${record.id}`);
    registry[record.id] = Object.freeze(structuredClone(record));
  }
  return Object.freeze(registry);
}
