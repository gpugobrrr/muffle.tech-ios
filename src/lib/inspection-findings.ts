import type { InspectionElementConceptId } from '@/lib/inspection-finding-elements';
import type { InspectionFinding, InspectionRecord } from '@/types/workspace';

/**
 * Compares two finding IDs with natural numeric ordering for trailing numeric suffixes.
 * Ensures `.2` precedes `.10`.
 */
export function compareFindingIds(left: string, right: string): number {
  const leftMatch = /^(.*)\.(\d+)$/.exec(left);
  const rightMatch = /^(.*)\.(\d+)$/.exec(right);

  if (leftMatch && rightMatch) {
    const prefixDiff = leftMatch[1].localeCompare(rightMatch[1]);
    if (prefixDiff !== 0) return prefixDiff;
    const leftNum = Number.parseInt(leftMatch[2], 10);
    const rightNum = Number.parseInt(rightMatch[2], 10);
    return leftNum - rightNum;
  }

  return left.localeCompare(right, undefined, { numeric: true });
}

export function sortFindingIds(ids: readonly string[]): string[] {
  return [...ids].sort(compareFindingIds);
}

export function sortFindings<T extends { id: string }>(
  findings: readonly T[],
): T[] {
  return [...findings].sort((left, right) => compareFindingIds(left.id, right.id));
}

/**
 * Returns all findings recorded for a specific inspection element concept,
 * sorted deterministically with natural numeric ordering (.1, .2, ... .10).
 */
export function listFindingsForElement(
  inspection:
    | InspectionRecord
    | Readonly<Record<string, InspectionFinding>>
    | readonly InspectionFinding[],
  elementConceptId: InspectionElementConceptId,
): readonly InspectionFinding[] {
  const findingsList = Array.isArray(inspection)
    ? inspection
    : 'findings' in inspection
      ? Object.values(inspection.findings)
      : Object.values(inspection);

  return findingsList
    .filter((finding) => finding.elementConceptId === elementConceptId)
    .sort((left, right) => compareFindingIds(left.id, right.id));
}

/**
 * Derives the base ID prefix by stripping any trailing numeric suffix.
 */
function extractFindingIdPrefix(baseFindingId: string): string {
  const match = /^(.*)\.(\d+)$/.exec(baseFindingId);
  return match ? match[1] : baseFindingId;
}

/**
 * Allocates the first unused numbered finding ID derived from the configured base finding ID.
 * Preserves `.1` convention for initial findings and reuses index gaps.
 */
export function allocateFindingId(
  inspection:
    | InspectionRecord
    | Readonly<Record<string, InspectionFinding>>
    | readonly InspectionFinding[],
  baseFindingId: string,
): string {
  const findingsList = Array.isArray(inspection)
    ? inspection
    : 'findings' in inspection
      ? Object.values(inspection.findings)
      : Object.values(inspection);

  const prefix = extractFindingIdPrefix(baseFindingId);
  const prefixDot = `${prefix}.`;

  const usedIndices = new Set<number>();
  for (const finding of findingsList) {
    if (finding.id.startsWith(prefixDot)) {
      const match = /^(.*)\.(\d+)$/.exec(finding.id);
      if (match && match[1] === prefix) {
        const num = Number.parseInt(match[2], 10);
        if (Number.isInteger(num) && num > 0) {
          usedIndices.add(num);
        }
      }
    }
  }

  let nextIndex = 1;
  while (usedIndices.has(nextIndex)) {
    nextIndex++;
  }

  return `${prefix}.${nextIndex}`;
}

export const allocateNextFindingId = allocateFindingId;
