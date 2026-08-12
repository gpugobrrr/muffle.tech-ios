import type { InspectionFindingCaptureTarget } from '@/lib/command-registry';
import {
  commitInspectionFindingField,
  type FindingFieldCommitResult,
} from '@/lib/finding-capture';
import type { InspectionRecord } from '@/types/workspace';

/**
 * UI interaction identity for the finding data-entry screen currently open.
 * Frozen when the entry opens. Commit must use this snapshot — never a sibling
 * that becomes highlighted/selected after the surveyor finishes typing.
 */
export type FindingEntrySession = {
  path: readonly string[];
  findingTarget: InspectionFindingCaptureTarget;
};

export function openFindingEntrySession(
  path: readonly string[],
  findingTarget: InspectionFindingCaptureTarget,
): FindingEntrySession {
  return {
    path: [...path],
    findingTarget: {
      findingId: findingTarget.findingId,
      elementConceptId: findingTarget.elementConceptId,
      field: findingTarget.field,
    },
  };
}

export function findingEntrySessionPathKey(
  session: FindingEntrySession | null | undefined,
): string | null {
  if (!session?.path.length) return null;
  return session.path.join('/');
}

/**
 * Prefer the frozen entry-session target over any later live selection.
 */
export function resolveFindingEntryCommitTarget(
  session: FindingEntrySession | null | undefined,
  fallback?: InspectionFindingCaptureTarget | null,
): InspectionFindingCaptureTarget | null {
  if (session?.findingTarget) return session.findingTarget;
  return fallback ?? null;
}

/**
 * Commit against the entry the surveyor was editing, even if a sibling leaf
 * (e.g. defect) became the live selection before the commit callback ran.
 */
export function commitFindingEntrySession(
  inspection: InspectionRecord,
  session: FindingEntrySession | null | undefined,
  value: string,
  fallbackTarget?: InspectionFindingCaptureTarget | null,
): FindingFieldCommitResult {
  const target = resolveFindingEntryCommitTarget(session, fallbackTarget);
  if (!target) {
    return { ok: false, message: 'Finding could not be recorded' };
  }
  return commitInspectionFindingField(inspection, target, value);
}
