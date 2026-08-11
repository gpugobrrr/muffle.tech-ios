import {
  isControlledScalarField,
  isControlledStatusField,
} from '@/lib/controlled-fact';
import type { CommandNode } from '@/lib/command-registry';
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

/**
 * Resolve the conceptual data-entry type for a registry route node.
 * Compound groups and finding leaves are identifiable without field schema.
 */
export function resolveSvyrNodeDataEntryType(
  node: Pick<CommandNode, 'compoundCapture' | 'findingTarget' | 'requiresValue'>,
): SvyrDataEntryType | null {
  if (node.compoundCapture) {
    return SVYR_DATA_ENTRY_TYPES.compoundGroup;
  }
  if (node.findingTarget) {
    return SVYR_DATA_ENTRY_TYPES.findingCapture;
  }
  if (node.requiresValue) {
    return null;
  }
  return null;
}
