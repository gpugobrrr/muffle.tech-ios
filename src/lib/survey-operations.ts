import {
    applyFieldValue,
    findFieldDefinitionForOperationId,
    resolveFieldValue,
} from '@/lib/field-schema';
import type { InspectionBrief } from '@/types/workspace';

/**
 * Canonical Muffle operation. The visible SVYR path (including `prep`)
 * is discovery only — it is never encoded into the operation.
 */
export type SurveyOperation = {
  operationId: string;
  arguments: {
    value?: string;
  };
};

export const SURVEY_OPERATIONS = {
  setInstructingParty: 'survey.brief.instruction.party.set',
  readInstructingParty: 'survey.brief.instruction.party.read',
  setInstructionSource: 'survey.brief.instruction.source.set',
  readInstructionSource: 'survey.brief.instruction.source.read',
} as const;

/** Successful execution payload shared by both SVYR renderers. */
export type SurveyOperationResult = {
  operationId: string;
  brief: InspectionBrief;
  label: string;
  /** Display value — never empty; uses "Not recorded" when unset. */
  value: string;
};

const NOT_RECORDED = 'Not recorded';

function recordedOrPlaceholder(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : NOT_RECORDED;
}

function labelForField(fieldDefinition: ReturnType<typeof findFieldDefinitionForOperationId>): string {
  return fieldDefinition?.label ?? 'Field';
}

/**
 * Execute a canonical survey operation against the live brief.
 * Returns null when the operation is unrecognised or a write has no value.
 */
export function executeSurveyOperation(
  brief: InspectionBrief,
  operation: SurveyOperation,
): SurveyOperationResult | null {
  const fieldDefinition = findFieldDefinitionForOperationId(operation.operationId);
  if (!fieldDefinition) return null;

  if (operation.operationId === fieldDefinition.readOperationId) {
    const value = resolveFieldValue(brief, fieldDefinition.fieldId);
    return {
      operationId: operation.operationId,
      brief,
      label: labelForField(fieldDefinition),
      value: recordedOrPlaceholder(value),
    };
  }

  if (operation.operationId === fieldDefinition.operationId) {
    const value = operation.arguments.value?.trim() ?? '';
    if (!value) return null;
    return {
      operationId: operation.operationId,
      brief: applyFieldValue(brief, fieldDefinition.fieldId, value),
      label: labelForField(fieldDefinition),
      value,
    };
  }

  return null;
}
