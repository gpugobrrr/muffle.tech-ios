import type { InspectionElementConceptId } from '@/lib/inspection-finding-elements';
import type { FindingLeafDefinition } from '@/lib/level-2-finding-capture';
import { buildFindingLeaf } from '@/lib/level-2-finding-capture';
import {
  allocateFindingId,
  listFindingsForElement,
} from '@/lib/inspection-findings';
import type { CommandNode } from '@/lib/command-registry';
import type { InspectionFinding, InspectionRecord } from '@/types/workspace';

const LABEL_MAX_LENGTH = 48;
const OBSERVATION_PREVIEW_MAX = 32;

/**
 * Human-readable label for a finding in the hub list.
 * Uses `Location · Observation preview…` when location is present,
 * otherwise `Location not recorded · Observation preview…`.
 * Internal finding IDs are never shown.
 */
export function humanLabelForFinding(finding: InspectionFinding): string {
  const location = finding.location?.trim();
  const observation = finding.observation?.trim() ?? '';

  const locationPart = location || 'Location not recorded';
  const observationPreview = truncatePreview(observation, OBSERVATION_PREVIEW_MAX);

  const full = `${locationPart} · ${observationPreview}`;
  return truncatePreview(full, LABEL_MAX_LENGTH);
}

function truncatePreview(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export type FindingHubItem = {
  kind: 'new-finding';
} | {
  kind: 'existing-finding';
  findingId: string;
  humanLabel: string;
};

/**
 * Build the ordered list of hub items for a finding-hub page.
 * Returns `NEW FINDING` followed by existing findings in natural order.
 */
export function buildFindingHubItems(
  inspection: InspectionRecord,
  elementConceptId: InspectionElementConceptId,
): readonly FindingHubItem[] {
  const existing = listFindingsForElement(inspection, elementConceptId);
  const items: FindingHubItem[] = [{ kind: 'new-finding' }];

  for (const finding of existing) {
    items.push({
      kind: 'existing-finding',
      findingId: finding.id,
      humanLabel: humanLabelForFinding(finding),
    });
  }

  return items;
}

/**
 * Build command-registry children for a selected finding's field menu.
 * Each leaf gets its `findingTarget.findingId` resolved to the dynamic finding.
 */
export function buildFindingFieldMenu(
  findingId: string,
  elementConceptId: InspectionElementConceptId,
  subjectLabel: string,
  leafDefinitions: readonly FindingLeafDefinition[],
): CommandNode[] {
  return leafDefinitions.map((leaf) =>
    buildFindingLeaf(leaf, {
      findingId,
      elementConceptId,
      subjectLabel,
    }),
  );
}

/**
 * Allocate a prospective finding ID for a new finding.
 * No record is created — the ID is only committed when a valid observation
 * is submitted through `commitInspectionFindingField`.
 */
export function allocateProspectiveFindingId(
  inspection: InspectionRecord,
  baseFindingId: string,
): string {
  return allocateFindingId(inspection, baseFindingId);
}
