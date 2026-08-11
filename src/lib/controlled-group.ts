import { labelForControlledStatus } from '@/lib/controlled-fact';
import type { FieldDefinition } from '@/lib/field-schema';
import {
  childSchemaDefinitions,
  resolveFieldSetValue,
  resolveFieldValue,
} from '@/lib/field-schema';
import type { InspectionBrief } from '@/types/workspace';

export type CompoundGroupRow = {
  path: string[];
  field: FieldDefinition;
  currentLabel: string;
  required: boolean;
};

export function labelForCompoundFieldValue(
  field: FieldDefinition,
  brief: InspectionBrief,
): string {
  if (field.valueType === 'multiSelect') {
    const values = resolveFieldSetValue(brief, field.fieldId);
    if (values.length === 0) return 'Not recorded';
    return values
      .map((value) => field.options?.find((option) => option.value === value)?.label ?? value)
      .join(', ');
  }

  const value = resolveFieldValue(brief, field.fieldId);
  if (!value) return 'Not recorded';

  if (field.valueType === 'singleSelect' || field.valueType === 'controlledStatus') {
    return labelForControlledStatus(field, value);
  }

  return value;
}

export function compoundGroupRows(
  groupPath: string[],
  brief: InspectionBrief,
): CompoundGroupRow[] {
  return childSchemaDefinitions(groupPath)
    .filter((definition): definition is FieldDefinition => definition.kind === 'field')
    .map((field) => ({
      path: field.path,
      field,
      currentLabel: labelForCompoundFieldValue(field, brief),
      required: Boolean(field.required && !field.optional),
    }));
}

/** @deprecated Use compoundGroupRows */
export const controlledGroupRows = compoundGroupRows;

export type ControlledGroupRow = CompoundGroupRow;
