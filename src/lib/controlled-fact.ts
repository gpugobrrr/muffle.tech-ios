import type { FieldDefinition } from '@/lib/field-schema';

/** Reusable controlled presence/status vocabulary for survey facts. */
export const CONTROLLED_PRESENCE_STATUSES = [
  'present',
  'not_present',
  'unknown',
  'not_inspected',
] as const;

export type ControlledPresenceStatus =
  (typeof CONTROLLED_PRESENCE_STATUSES)[number];

export const CONTROLLED_PRESENCE_STATUS_OPTIONS: readonly {
  value: ControlledPresenceStatus;
  label: string;
}[] = [
  { value: 'present', label: 'Present' },
  { value: 'not_present', label: 'Not present' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'not_inspected', label: 'Not inspected' },
];

export type ControlledSurveyFactValue = {
  /** Canonical option ID validated against the field schema. */
  value: string;
};

export type ControlledSurveyFactSetValue = {
  /** Schema-ordered canonical option IDs. */
  values: readonly string[];
};

export function isControlledPresenceStatus(
  value: string,
): value is ControlledPresenceStatus {
  return (CONTROLLED_PRESENCE_STATUSES as readonly string[]).includes(value);
}

export function isControlledStatusField(
  field: FieldDefinition | null | undefined,
): field is FieldDefinition & { valueType: 'controlledStatus' } {
  return field?.valueType === 'controlledStatus';
}

export function isControlledSetField(
  field: FieldDefinition | null | undefined,
): field is FieldDefinition & { valueType: 'multiSelect' } {
  return field?.valueType === 'multiSelect' && Boolean(field.operationId);
}

/**
 * Validate a scalar controlled fact against the field's declared options.
 * Rejects unknown IDs and presentation labels that are not canonical values.
 */
export function normalizeControlledStatusInput(
  field: FieldDefinition,
  input: string,
): string | null {
  if (field.valueType !== 'controlledStatus') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const normalizedInput = trimmed.toLowerCase().replace(/\s+/g, '_');
  const matchedOption = field.options?.find((option) => {
    if (option.available === false) return false;
    const normalizedValue = option.value.toLowerCase();
    const normalizedLabel = option.label.toLowerCase().replace(/\s+/g, ' ');
    return (
      trimmed.toLowerCase() === normalizedValue ||
      trimmed.toLowerCase() === normalizedLabel ||
      normalizedInput === normalizedValue
    );
  });

  return matchedOption?.value ?? null;
}

/** Resolve a stored controlled scalar for display. */
export function labelForControlledStatus(
  field: FieldDefinition,
  canonicalValue: string | null | undefined,
): string {
  if (!canonicalValue) return 'Not recorded';
  const option = field.options?.find((item) => item.value === canonicalValue);
  return option?.label ?? canonicalValue;
}
