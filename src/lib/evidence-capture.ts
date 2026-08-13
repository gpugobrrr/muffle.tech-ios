import type {
  CommandNode,
  InspectionEvidenceCaptureTarget,
} from '@/lib/command-registry';
import type { InspectionElementConceptId } from '@/lib/inspection-finding-elements';
import type { LocalMediaSource } from '@/core/local-media-store';
import type { EvidenceFileStore } from '@/lib/evidence-files';
import {
  executeInspectionOperation,
  SURVEY_OPERATIONS,
  type InspectionOperationResult,
} from '@/lib/survey-operations';
import type { InspectionEvidence, InspectionRecord } from '@/types/workspace';

export const SURVEY_EVIDENCE_ADD = SURVEY_OPERATIONS.addInspectionEvidence;

export type EvidencePhotoCommitResult =
  | { ok: true; result: InspectionOperationResult; evidence: InspectionEvidence }
  | { ok: false; message: string };

export function isEvidenceCaptureNode(
  node: Pick<CommandNode, 'evidenceCaptureTarget'> | null | undefined,
): node is CommandNode & { evidenceCaptureTarget: InspectionEvidenceCaptureTarget } {
  return Boolean(node?.evidenceCaptureTarget);
}

export function createEvidencePhotoId(now = Date.now()): string {
  const suffix =
    globalThis.crypto?.randomUUID?.() ?? `local-${now}-${Math.random().toString(36).slice(2, 10)}`;
  return `evidence.photo.${suffix}`;
}

export function buildEvidenceCaptureLeaf(
  token: string,
  label: string,
  description: string,
  findingId: string,
  elementConceptId: InspectionElementConceptId,
  requirement: string,
): CommandNode {
  return {
    token,
    label,
    learnerLabel: label,
    description,
    evidenceCaptureTarget: {
      findingId,
      elementConceptId,
    },
    coverage: {
      requirement,
      status: 'interactive',
      canonicalConceptId: 'evidence',
      engineBinding: SURVEY_EVIDENCE_ADD,
      recommendedLaterWork:
        'Add evidence deletion, gallery review, and report image embedding separately.',
    },
  };
}

export function resolveEvidenceRecord(
  inspection: InspectionRecord,
  evidenceId: string,
): InspectionEvidence | null {
  return inspection.evidence?.[evidenceId] ?? null;
}

export function findingEvidenceIds(
  inspection: InspectionRecord,
  findingId: string,
): readonly string[] {
  const finding = inspection.findings[findingId];
  if (!finding?.evidence?.length) return [];
  return finding.evidence.map(({ id }) => id).filter(Boolean);
}

export function findingPhotoEvidenceRecords(
  inspection: InspectionRecord,
  findingId: string,
): InspectionEvidence[] {
  return findingEvidenceIds(inspection, findingId).flatMap((evidenceId) => {
    const record = resolveEvidenceRecord(inspection, evidenceId);
    return record?.kind === 'photo' ? [record] : [];
  });
}

export function countFindingPhotoEvidence(
  inspection: InspectionRecord,
  findingId: string,
): number {
  return findingPhotoEvidenceRecords(inspection, findingId).length;
}

export function commitInspectionEvidencePhoto(
  inspection: InspectionRecord,
  target: InspectionEvidenceCaptureTarget,
  evidence: InspectionEvidence,
): EvidencePhotoCommitResult {
  const result = executeInspectionOperation(inspection, {
    operationId: SURVEY_EVIDENCE_ADD,
    arguments: {
      findingId: target.findingId,
      evidence,
    },
  });
  if (!result) {
    const message = inspection.findings[target.findingId]
      ? 'Evidence could not be recorded'
      : 'Record observation first';
    console.error('[evidence-photo] Evidence commit rejected', {
      message,
      targetFindingId: target.findingId,
      evidenceId: evidence.id,
    });
    return { ok: false, message };
  }

  return { ok: true, result, evidence };
}

export async function captureAndCommitInspectionEvidencePhoto(input: {
  inspection: InspectionRecord;
  target: InspectionEvidenceCaptureTarget;
  jobId: string;
  temporaryUri: string;
  file?: Blob;
  fileStore: EvidenceFileStore;
  createId?: () => string;
}): Promise<EvidencePhotoCommitResult> {
  const evidenceId = (input.createId ?? createEvidencePhotoId)();
  let persistentUri: string | null = null;
  const source: LocalMediaSource = {
    uri: input.temporaryUri,
    ...(input.file ? { file: input.file } : {}),
  };

  try {
    persistentUri = await input.fileStore.copyPhotoToEvidenceDirectory(
      input.jobId,
      evidenceId,
      source,
    );
  } catch (error) {
    console.error('[evidence-photo] Failed to save photo', error);
    return { ok: false, message: 'Photo could not be saved' };
  }

  const committed = commitInspectionEvidencePhoto(input.inspection, input.target, {
    id: evidenceId,
    kind: 'photo',
    uri: persistentUri,
  });

  if (!committed.ok) {
    await input.fileStore.deleteEvidenceFile(persistentUri);
    return committed;
  }

  return committed;
}
