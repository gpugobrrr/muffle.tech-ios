import {
  frozenEditSessionPathKey,
  openFrozenEditSession,
  resolveFrozenCommitTarget,
} from '@/core/frozen-edit-session';
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
  token: string;
  findingTarget: InspectionFindingCaptureTarget;
};

export function openFindingEntrySession(
  path: readonly string[],
  findingTarget: InspectionFindingCaptureTarget,
  token?: string,
): FindingEntrySession {
  const frozen = openFrozenEditSession(
    path,
    {
      findingId: findingTarget.findingId,
      elementConceptId: findingTarget.elementConceptId,
      field: findingTarget.field,
    },
    token ?? path[path.length - 1] ?? findingTarget.field,
  );
  return {
    path: frozen.path,
    token: frozen.token,
    findingTarget: frozen.target,
  };
}

export function findingEntrySessionPathKey(
  session: FindingEntrySession | null | undefined,
): string | null {
  return frozenEditSessionPathKey(
    session
      ? {
          path: session.path,
          token: session.token,
          target: session.findingTarget,
        }
      : null,
  );
}

/**
 * Prefer the frozen entry-session target over any later live selection.
 */
export function resolveFindingEntryCommitTarget(
  session: FindingEntrySession | null | undefined,
  fallback?: InspectionFindingCaptureTarget | null,
): InspectionFindingCaptureTarget | null {
  return resolveFrozenCommitTarget(
    session
      ? {
          path: session.path,
          token: session.token,
          target: session.findingTarget,
        }
      : null,
    fallback,
  );
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
