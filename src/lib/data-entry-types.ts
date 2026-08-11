import {
  isControlledScalarField,
  isControlledStatusField,
} from '@/lib/controlled-fact';
import type { FieldDefinition } from '@/lib/field-schema';

/** Conceptual SVYR capture kinds — UI primitives may be reused across domain types. */
export const SVYR_DATA_ENTRY_TYPES = {
  freeText: 1,
  singleChoice: 2,
  multiChoice: 3,
  controlledFact: 4,
  compoundGroup: 5,
  findingCapture: 6,
} as const;

export type SvyrDataEntryType =
  (typeof SVYR_DATA_ENTRY_TYPES)[keyof typeof SVYR_DATA_ENTRY_TYPES];

/**
 * Resolve the conceptual data-entry type declared by a field schema.
 * `controlledStatus` is a domain type (type 4) that reuses single-choice UI.
 */
export function resolveSvyrDataEntryType(
  field: FieldDefinition,
): SvyrDataEntryType {
  if (isControlledStatusField(field)) {
    return SVYR_DATA_ENTRY_TYPES.controlledFact;
  }

  switch (field.valueType) {
    case 'singleSelect':
      return isControlledScalarField(field)
        ? SVYR_DATA_ENTRY_TYPES.controlledFact
        : SVYR_DATA_ENTRY_TYPES.singleChoice;
    case 'multiSelect':
      return SVYR_DATA_ENTRY_TYPES.multiChoice;
    case 'number':
    case 'text':
      return isControlledScalarField(field)
        ? SVYR_DATA_ENTRY_TYPES.controlledFact
        : SVYR_DATA_ENTRY_TYPES.freeText;
    case 'controlledStatus':
      return SVYR_DATA_ENTRY_TYPES.controlledFact;
    default:
      return SVYR_DATA_ENTRY_TYPES.freeText;
  }
}

/** Fields that share the single-choice capture primitive. */
export function usesSingleChoicePresentation(
  field: FieldDefinition | null | undefined,
): boolean {
  if (!field) return false;
  return field.valueType === 'singleSelect' || field.valueType === 'controlledStatus';
}
