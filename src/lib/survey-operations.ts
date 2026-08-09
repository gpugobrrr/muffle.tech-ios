import {
    applyFieldValue,
    findFieldDefinitionForOperationId,
    resolveFieldValue,
} from '@/lib/field-schema';
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
    findingId?: string;
    finding?: InspectionFinding;
  };
};

export const SURVEY_OPERATIONS = {
  setInstructingParty: 'survey.brief.instruction.party.set',
  readInstructingParty: 'survey.brief.instruction.party.read',
  setInstructionSource: 'survey.brief.instruction.source.set',
  readInstructionSource: 'survey.brief.instruction.source.read',
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

function labelForField(fieldDefinition: ReturnType<typeof findFieldDefinitionForOperationId>): string {
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
    finding.elementConceptId !== 'building_element.external_wall'
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
  const condition = optionalText(finding.condition);
  const defect = optionalText(finding.defect);
  const recommendation = optionalText(finding.recommendation);

  return {
    id,
    elementConceptId: finding.elementConceptId,
    observation,
    ...(condition ? { condition } : {}),
    ...(defect ? { defect } : {}),
    ...(recommendation ? { recommendation } : {}),
    ...(evidenceIds.length > 0
      ? { evidence: evidenceIds.map((evidenceId) => ({ id: evidenceId })) }
      : {}),
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
