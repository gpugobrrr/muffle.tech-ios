import { findCommandNode } from '@/lib/command-registry';
import type { CommandNode } from '@/lib/command-registry';
import { resolveDirectoryCompletion } from '@/lib/completion';
import { labelForControlledFactScalar } from '@/lib/controlled-fact';
import {
  resolveSvyrDataEntryType,
  type SvyrDataEntryType,
  usesSingleChoicePresentation,
} from '@/lib/data-entry-types';
import type { FieldDefinition } from '@/lib/field-schema';
import {
  childSchemaDefinitions,
  resolveFieldSetValue,
  resolveFieldValue,
} from '@/lib/field-schema';
import type { InspectionBrief } from '@/types/workspace';

/** Typed child descriptor for compound / grouped capture rows. */
export type CompoundCaptureChild = {
  /** Stable child identity — the canonical field ID. */
  id: string;
  label: string;
  path: string[];
  fieldId: string;
  field: FieldDefinition;
  dataEntryType: SvyrDataEntryType;
  currentLabel: string;
  required: boolean;
  completed: boolean;
};

/** Orchestration-only grouped capture surface — no canonical group value. */
export type CompoundCaptureGroup = {
  path: string[];
  label: string;
  children: CompoundCaptureChild[];
  completed: number;
  total: number;
};

/** @deprecated Use CompoundCaptureChild */
export type CompoundGroupRow = CompoundCaptureChild;

export function isCompoundCaptureNode(
  node: Pick<CommandNode, 'compoundCapture'> | null | undefined,
): node is CommandNode & { compoundCapture: true } {
  return Boolean(node?.compoundCapture);
}

export function labelForCompoundFieldValue(
  field: FieldDefinition,
  brief: InspectionBrief,
): string {
  if (field.valueType === 'multiSelect') {
    const values = resolveFieldSetValue(brief, field.fieldId);
    if (values.length === 0) return 'Not recorded';
    return values
      .map(
        (value) =>
          field.options?.find((option) => option.value === value)?.label ??
          value,
      )
      .join(', ');
  }

  const value = resolveFieldValue(brief, field.fieldId);
  if (!value) return 'Not recorded';

  if (usesSingleChoicePresentation(field)) {
    return labelForControlledFactScalar(field, value);
  }

  return value;
}

function childIsComplete(field: FieldDefinition, brief: InspectionBrief): boolean {
  if (field.valueType === 'multiSelect') {
    return resolveFieldSetValue(brief, field.fieldId).length > 0;
  }
  const value = resolveFieldValue(brief, field.fieldId);
  return Boolean(value?.trim());
}

/** Build typed child rows from schema definitions beneath a compound group path. */
export function compoundCaptureChildren(
  groupPath: string[],
  brief: InspectionBrief,
): CompoundCaptureChild[] {
  return childSchemaDefinitions(groupPath)
    .filter((definition): definition is FieldDefinition => definition.kind === 'field')
    .map((field) => ({
      id: field.fieldId,
      label: field.label,
      path: field.path,
      fieldId: field.fieldId,
      field,
      dataEntryType: resolveSvyrDataEntryType(field),
      currentLabel: labelForCompoundFieldValue(field, brief),
      required: Boolean(field.required && !field.optional),
      completed: childIsComplete(field, brief),
    }));
}

/** Resolve a compound capture group with aggregate completion from its children. */
export function resolveCompoundCaptureGroup(
  groupPath: string[],
  brief: InspectionBrief,
): CompoundCaptureGroup | null {
  const node = findCommandNode(groupPath);
  if (!isCompoundCaptureNode(node)) return null;

  const completion = resolveDirectoryCompletion(groupPath, brief);
  const children = compoundCaptureChildren(groupPath, brief);

  return {
    path: groupPath,
    label: node.learnerLabel ?? node.label,
    children,
    completed: completion?.completed ?? 0,
    total: completion?.total ?? 0,
  };
}

/** @deprecated Use compoundCaptureChildren */
export function compoundGroupRows(
  groupPath: string[],
  brief: InspectionBrief,
): CompoundCaptureChild[] {
  return compoundCaptureChildren(groupPath, brief);
}

/** @deprecated Use compoundGroupRows */
export const controlledGroupRows = compoundGroupRows;

/** @deprecated Use CompoundCaptureChild */
export type ControlledGroupRow = CompoundCaptureChild;
