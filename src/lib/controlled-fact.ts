import type { FieldDefinition, FieldOption } from '@/lib/field-schema';

/** Generic Engine operation IDs for schema-governed controlled facts. */
export const SURVEY_CONTROLLED_FACT_SET = 'survey.controlled_fact.set' as const;
export const SURVEY_CONTROLLED_FACT_READ = 'survey.controlled_fact.read' as const;

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

export type ControlledStatusFieldConfig = {
  path: string[];
  token: string;
  label: string;
  description: string;
  fieldId: string;
  options: readonly FieldOption[];
  required?: boolean;
  optional?: boolean;
  valuePrompt?: string;
  entryLabel?: string;
  notesEnabled?: boolean;
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

export function isControlledScalarField(
  field: FieldDefinition | null | undefined,
): field is FieldDefinition {
  return field?.operationId === SURVEY_CONTROLLED_FACT_SET;
}

export function isControlledSetField(
  field: FieldDefinition | null | undefined,
): field is FieldDefinition & { valueType: 'multiSelect' } {
  return field?.valueType === 'multiSelect' && Boolean(field.operationId);
}

/**
 * Register a schema-governed controlled-status field.
 * Reuses single-choice presentation and the generic controlled-fact Engine path.
 */
export function defineControlledStatusField(
  config: ControlledStatusFieldConfig,
): FieldDefinition & { valueType: 'controlledStatus' } {
  return {
    kind: 'field',
    path: config.path,
    pathKey: config.path.join('/'),
    token: config.token,
    label: config.label,
    description: config.description,
    fieldId: config.fieldId,
    required: config.required,
    optional: config.optional,
    valueType: 'controlledStatus',
    options: [...config.options],
    valuePrompt: config.valuePrompt ?? `ENTER ${config.label.toUpperCase()} STATUS`,
    entryLabel: config.entryLabel ?? config.label.toUpperCase(),
    operationId: SURVEY_CONTROLLED_FACT_SET,
    readOperationId: SURVEY_CONTROLLED_FACT_READ,
    notesEnabled: config.notesEnabled ?? false,
  };
}

/**
 * Validate a schema-governed scalar option against the field's declared options.
 * Rejects unknown IDs and presentation labels that are not canonical values.
 */
export function normalizeControlledFactScalarInput(
  field: FieldDefinition,
  input: string,
): string | null {
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

/** @deprecated Use normalizeControlledFactScalarInput */
export function normalizeControlledStatusInput(
  field: FieldDefinition,
  input: string,
): string | null {
  if (!isControlledStatusField(field)) return null;
  return normalizeControlledFactScalarInput(field, input);
}

/** Resolve a stored controlled scalar option for display. */
export function labelForControlledFactScalar(
  field: FieldDefinition,
  canonicalValue: string | null | undefined,
): string {
  if (!canonicalValue) return 'Not recorded';
  const option = field.options?.find((item) => item.value === canonicalValue);
  return option?.label ?? canonicalValue;
}

/** @deprecated Use labelForControlledFactScalar */
export function labelForControlledStatus(
  field: FieldDefinition,
  canonicalValue: string | null | undefined,
): string {
  return labelForControlledFactScalar(field, canonicalValue);
}
