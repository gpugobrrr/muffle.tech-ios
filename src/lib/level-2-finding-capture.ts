import type {
  CommandNode,
  InspectionFindingCaptureTarget,
  Level2CaptureCoverage,
} from '@/lib/command-registry';
import type {
  InspectionElementConceptId,
  InspectionFindingField,
} from '@/lib/inspection-finding-elements';
import {
  executeInspectionOperation,
  SURVEY_OPERATIONS,
  type InspectionOperationResult,
} from '@/lib/survey-operations';
import type { InspectionFinding, InspectionRecord } from '@/types/workspace';

export type FindingFieldCommitResult =
  | { ok: true; result: InspectionOperationResult }
  | { ok: false; message: string };

export type FindingCaptureFieldLeafDefinition = {
  kind: 'finding';
  token: string;
  label: string;
  description: string;
  field: InspectionFindingField;
};

export type FindingWorkflowLeafDefinition = {
  kind: 'workflow';
  token: string;
  label: string;
  description: string;
  coverage: Level2CaptureCoverage;
};

export type FindingLeafDefinition =
  | FindingCaptureFieldLeafDefinition
  | FindingWorkflowLeafDefinition;

export function buildFindingLeaf(
  leaf: FindingLeafDefinition,
  findingContext: {
    findingId: string;
    elementConceptId: InspectionElementConceptId;
    subjectLabel: string;
  },
): CommandNode {
  if (leaf.kind === 'workflow') {
    return {
      token: leaf.token,
      label: leaf.label,
      learnerLabel: leaf.label,
      description: leaf.description,
      workflowOnly: true,
      coverage: leaf.coverage,
    };
  }

  return buildFindingCaptureLeaf(
    leaf.token,
    leaf.label,
    leaf.description,
    findingContext.findingId,
    findingContext.elementConceptId,
    leaf.field,
    `${findingContext.subjectLabel} ${leaf.label.toLowerCase()}`,
  );
}

export function buildFindingCaptureLeaf(
  token: string,
  label: string,
  description: string,
  findingId: string,
  elementConceptId: InspectionElementConceptId,
  field: InspectionFindingField,
  requirement: string,
): CommandNode {
  return {
    token,
    label,
    learnerLabel: label,
    description,
    requiresValue: true,
    optional: true,
    valuePrompt: `ENTER ${label.toUpperCase()}`,
    entryLabel: label.toUpperCase(),
    findingTarget: {
      findingId,
      elementConceptId,
      field,
    },
    coverage: {
      requirement,
      status: 'interactive',
      canonicalConceptId: field === 'evidence' ? 'evidence' : field,
      engineBinding: 'survey.inspection.finding.upsert',
      recommendedLaterWork:
        'Retain the existing finding operation and add richer repeated-finding UX separately.',
    },
  };
}

export function resolveFindingFieldValue(
  inspection: InspectionRecord,
  target: InspectionFindingCaptureTarget,
): string | null {
  const finding = inspection.findings[target.findingId];
  if (!finding) return null;

  if (target.field === 'evidence') {
    const evidenceIds = (finding.evidence ?? []).map(({ id }) => id).filter(Boolean);
    return evidenceIds.length > 0 ? evidenceIds.join(', ') : null;
  }

  const value = finding[target.field];
  return value?.trim() ? value : null;
}

function findingWithFieldValue(
  existing: InspectionFinding | undefined,
  target: InspectionFindingCaptureTarget,
  value: string,
): InspectionFinding | null {
  if (target.field === 'observation') {
    return {
      ...(existing ?? {
        id: target.findingId,
        elementConceptId: target.elementConceptId,
      }),
      observation: value,
    };
  }

  if (!existing) return null;

  if (target.field === 'evidence') {
    const evidenceIds = [
      ...new Set([...(existing.evidence ?? []).map(({ id }) => id), value]),
    ];
    return {
      ...existing,
      evidence: evidenceIds.map((id) => ({ id })),
    };
  }

  return {
    ...existing,
    [target.field]: value,
  };
}

/**
 * Commits one supported Level 2 leaf through the existing whole-finding
 * operation. No new operation, field, relationship or completion state is
 * introduced. Optional finding fields require the observation to exist first.
 */
export function commitInspectionFindingField(
  inspection: InspectionRecord,
  target: InspectionFindingCaptureTarget,
  input: string,
): FindingFieldCommitResult {
  const value = input.trim();
  if (!value) return { ok: false, message: 'Value is required' };

  const finding = findingWithFieldValue(
    inspection.findings[target.findingId],
    target,
    value,
  );
  if (!finding) {
    return {
      ok: false,
      message: 'Record observation first',
    };
  }

  const result = executeInspectionOperation(inspection, {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: { finding },
  });
  if (!result) {
    return {
      ok: false,
      message: 'Finding could not be recorded',
    };
  }

  return { ok: true, result };
}
