import { labelForControlledStatus } from '@/lib/controlled-fact';
import { isInspectionElementConceptId } from '@/lib/inspection-finding-elements';
import {
  applyFieldSetValue,
  applyFieldValue,
  findFieldDefinitionByFieldId,
  findFieldDefinitionForOperationId,
  normalizeFieldInputValue,
  resolveFieldSetValue,
  resolveFieldValue,
} from '@/lib/field-schema';
import {
  normalizeMultiChoiceValues,
} from '@/lib/multi-choice';
import type {
  InspectionBrief,
  InspectionFinding,
  InspectionRecord,
} from '@/types/workspace';

/**
 * Canonical Muffle operation. The visible SVYR path (including `prep`)
 * is discovery only — it is never encoded into the operation.
 */
export type SurveyOperation = {
  operationId: string;
  arguments: {
    value?: string;
    values?: readonly string[];
    fieldId?: string;
    findingId?: string;
    finding?: InspectionFinding;
  };
};

export const SURVEY_OPERATIONS = {
  setInstructingParty: 'survey.brief.instruction.party.set',
  readInstructingParty: 'survey.brief.instruction.party.read',
  setInstructionClient: 'survey.brief.instruction.client.set',
  readInstructionClient: 'survey.brief.instruction.client.read',
  setInstructionReference: 'survey.brief.instruction.reference.set',
  readInstructionReference: 'survey.brief.instruction.reference.read',
  setInstructionSource: 'survey.brief.instruction.source.set',
  readInstructionSource: 'survey.brief.instruction.source.read',
  setPurpose: 'survey.brief.purpose.set',
  readPurpose: 'survey.brief.purpose.read',
  setDeliverable: 'survey.brief.deliverable.set',
  readDeliverable: 'survey.brief.deliverable.read',
  setLimitation: 'survey.brief.limitation.set',
  readLimitation: 'survey.brief.limitation.read',
  setControlledFact: 'survey.controlled_fact.set',
  readControlledFact: 'survey.controlled_fact.read',
  setControlledFactSet: 'survey.controlled_fact_set.set',
  readControlledFactSet: 'survey.controlled_fact_set.read',
  upsertInspectionFinding: 'survey.inspection.finding.upsert',
  readInspectionFinding: 'survey.inspection.finding.read',
} as const;

/** Successful execution payload shared by both SVYR renderers. */
export type SurveyOperationResult = {
  operationId: string;
  brief: InspectionBrief;
  label: string;
  /** Display value — never empty; uses "Not recorded" when unset. */
  value: string;
};

export type InspectionOperationResult = {
  operationId: string;
  inspection: InspectionRecord;
  finding: InspectionFinding;
};

const NOT_RECORDED = 'Not recorded';

function recordedOrPlaceholder(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : NOT_RECORDED;
}

function labelForField(
  fieldDefinition: ReturnType<typeof findFieldDefinitionForOperationId>,
): string {
  return fieldDefinition?.label ?? 'Field';
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeFinding(
  finding: InspectionFinding,
): InspectionFinding | null {
  const id = finding.id.trim();
  const observation = finding.observation.trim();
  if (
    !id ||
    !observation ||
    !isInspectionElementConceptId(finding.elementConceptId)
  ) {
    return null;
  }

  const evidenceIds = [
    ...new Set(
      (finding.evidence ?? [])
        .map((reference) => reference.id.trim())
        .filter(Boolean),
    ),
  ];
  const location = optionalText(finding.location);
  const condition = optionalText(finding.condition);
  const defect = optionalText(finding.defect);
  const recommendation = optionalText(finding.recommendation);

  return {
    id,
    elementConceptId: finding.elementConceptId,
    ...(location ? { location } : {}),
    observation,
    ...(condition ? { condition } : {}),
    ...(defect ? { defect } : {}),
    ...(recommendation ? { recommendation } : {}),
    ...(evidenceIds.length > 0
      ? { evidence: evidenceIds.map((evidenceId) => ({ id: evidenceId })) }
      : {}),
  };
}

function displayValueForField(
  fieldDefinition: NonNullable<ReturnType<typeof findFieldDefinitionByFieldId>>,
  brief: InspectionBrief,
): string {
  if (fieldDefinition.valueType === 'multiSelect') {
    const values = resolveFieldSetValue(brief, fieldDefinition.fieldId);
    if (values.length === 0) return NOT_RECORDED;
    return values
      .map((value) => {
        const option = fieldDefinition.options?.find(
          (item) => item.value === value,
        );
        return option?.label ?? value;
      })
      .join(', ');
  }

  const value = resolveFieldValue(brief, fieldDefinition.fieldId);
  if (fieldDefinition.valueType === 'controlledStatus') {
    return labelForControlledStatus(fieldDefinition, value);
  }
  return recordedOrPlaceholder(value);
}

function executeControlledFactWrite(
  brief: InspectionBrief,
  operation: SurveyOperation,
): SurveyOperationResult | null {
  const fieldId = operation.arguments.fieldId?.trim();
  if (!fieldId) return null;

  const fieldDefinition = findFieldDefinitionByFieldId(fieldId);
  if (!fieldDefinition) return null;

  const value = normalizeFieldInputValue(
    fieldDefinition,
    operation.arguments.value ?? '',
  );
  if (!value) return null;

  const nextBrief = applyFieldValue(brief, fieldId, value);
  return {
    operationId: operation.operationId,
    brief: nextBrief,
    label: fieldDefinition.label,
    value: displayValueForField(fieldDefinition, nextBrief),
  };
}

function executeControlledFactRead(
  brief: InspectionBrief,
  operation: SurveyOperation,
): SurveyOperationResult | null {
  const fieldId = operation.arguments.fieldId?.trim();
  if (!fieldId) return null;

  const fieldDefinition = findFieldDefinitionByFieldId(fieldId);
  if (!fieldDefinition) return null;

  return {
    operationId: operation.operationId,
    brief,
    label: fieldDefinition.label,
    value: displayValueForField(fieldDefinition, brief),
  };
}

function executeControlledFactSetWrite(
  brief: InspectionBrief,
  operation: SurveyOperation,
): SurveyOperationResult | null {
  const fieldId = operation.arguments.fieldId?.trim();
  if (!fieldId) return null;

  const fieldDefinition = findFieldDefinitionByFieldId(fieldId);
  if (!fieldDefinition || fieldDefinition.valueType !== 'multiSelect') {
    return null;
  }

  const values = normalizeMultiChoiceValues(
    fieldDefinition,
    operation.arguments.values ?? [],
  );
  if (!values) return null;

  const nextBrief = applyFieldSetValue(brief, fieldId, values);
  return {
    operationId: operation.operationId,
    brief: nextBrief,
    label: fieldDefinition.label,
    value: displayValueForField(fieldDefinition, nextBrief),
  };
}

function executeControlledFactSetRead(
  brief: InspectionBrief,
  operation: SurveyOperation,
): SurveyOperationResult | null {
  const fieldId = operation.arguments.fieldId?.trim();
  if (!fieldId) return null;

  const fieldDefinition = findFieldDefinitionByFieldId(fieldId);
  if (!fieldDefinition || fieldDefinition.valueType !== 'multiSelect') {
    return null;
  }

  return {
    operationId: operation.operationId,
    brief,
    label: fieldDefinition.label,
    value: displayValueForField(fieldDefinition, brief),
  };
}

/**
 * Execute a canonical survey operation against the live brief.
 * Returns null when the operation is unrecognised or a write has no value.
 */
export function executeSurveyOperation(
  brief: InspectionBrief,
  operation: SurveyOperation,
): SurveyOperationResult | null {
  if (operation.operationId === SURVEY_OPERATIONS.setControlledFact) {
    return executeControlledFactWrite(brief, operation);
  }
  if (operation.operationId === SURVEY_OPERATIONS.readControlledFact) {
    return executeControlledFactRead(brief, operation);
  }
  if (operation.operationId === SURVEY_OPERATIONS.setControlledFactSet) {
    return executeControlledFactSetWrite(brief, operation);
  }
  if (operation.operationId === SURVEY_OPERATIONS.readControlledFactSet) {
    return executeControlledFactSetRead(brief, operation);
  }

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
    const value = normalizeFieldInputValue(
      fieldDefinition,
      operation.arguments.value ?? '',
    );
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

/**
 * Execute canonical finding operations against the inspection record.
 * Upsert replaces one stable ID and therefore cannot duplicate an edited
 * finding. Notes and report presentation are intentionally absent.
 */
export function executeInspectionOperation(
  inspection: InspectionRecord,
  operation: SurveyOperation,
): InspectionOperationResult | null {
  if (
    operation.operationId === SURVEY_OPERATIONS.upsertInspectionFinding
  ) {
    const finding = operation.arguments.finding
      ? normalizeFinding(operation.arguments.finding)
      : null;
    if (!finding) return null;

    return {
      operationId: operation.operationId,
      inspection: {
        findings: {
          ...inspection.findings,
          [finding.id]: finding,
        },
      },
      finding,
    };
  }

  if (operation.operationId === SURVEY_OPERATIONS.readInspectionFinding) {
    const findingId = operation.arguments.findingId?.trim();
    const finding = findingId ? inspection.findings[findingId] : undefined;
    if (!finding) return null;
    return {
      operationId: operation.operationId,
      inspection,
      finding,
    };
  }

  return null;
}
