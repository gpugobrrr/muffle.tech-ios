import type {
  CommandNode,
  InspectionFindingCaptureTarget,
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

/** Generic Engine operation for all finding field commits. */
export const SURVEY_FINDING_UPSERT = SURVEY_OPERATIONS.upsertInspectionFinding;
export const SURVEY_FINDING_READ = SURVEY_OPERATIONS.readInspectionFinding;

/** Supported semantic fields on a canonical `InspectionFinding`. */
export const FINDING_CAPTURE_FIELDS = [
  'observation',
  'condition',
  'defect',
  'recommendation',
  'evidence',
] as const satisfies readonly InspectionFindingField[];

/**
 * Route-level finding identity configuration.
 * Current architecture: one stable finding ID per inspection element concept.
 */
export type FindingCaptureConfig = {
  route: readonly string[];
  elementConceptId: InspectionElementConceptId;
  findingId: string;
  label: string;
};

export type FindingFieldCommitResult =
  | { ok: true; result: InspectionOperationResult }
  | { ok: false; message: string };

export function isFindingCaptureNode(
  node: Pick<CommandNode, 'findingTarget'> | null | undefined,
): node is CommandNode & { findingTarget: InspectionFindingCaptureTarget } {
  return Boolean(node?.findingTarget);
}

export function isFindingCaptureTarget(
  target: InspectionFindingCaptureTarget | null | undefined,
): target is InspectionFindingCaptureTarget {
  return Boolean(
    target?.findingId?.trim() &&
      target?.elementConceptId &&
      FINDING_CAPTURE_FIELDS.includes(target.field),
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
      engineBinding: SURVEY_FINDING_UPSERT,
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
 * Commits one finding field through the generic upsert operation.
 * Optional fields require an observation on the same stable finding ID first.
 */
export function commitInspectionFindingField(
  inspection: InspectionRecord,
  target: InspectionFindingCaptureTarget,
  input: string,
): FindingFieldCommitResult {
  const value = input.trim();
  if (!value) return { ok: false, message: 'Value is required' };

  const existing = inspection.findings[target.findingId];
  const finding = findingWithFieldValue(existing, target, value);
  if (!finding) {
    // TEMP DIAGNOSTIC — observation must never hit this branch.
    console.error('[finding-debug:obs-gate]', {
      reason: 'findingWithFieldValue returned null',
      targetField: target.field,
      targetFieldStrictEqObservation: target.field === 'observation',
      targetFindingId: target.findingId,
      targetElementConceptId: target.elementConceptId,
      existingFinding: existing ?? null,
      availableFindingIds: Object.keys(inspection.findings),
      value,
    });
    return {
      ok: false,
      message: 'Record observation first',
    };
  }

  const result = executeInspectionOperation(inspection, {
    operationId: SURVEY_FINDING_UPSERT,
    arguments: { finding },
  });
  if (!result) {
    console.error('[finding-debug:obs-gate]', {
      reason: 'executeInspectionOperation returned null',
      target,
      finding,
      value,
    });
    return {
      ok: false,
      message: 'Finding could not be recorded',
    };
  }

  return { ok: true, result };
}
