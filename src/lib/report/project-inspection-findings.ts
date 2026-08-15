import {
  labelForInspectionElement,
} from '@/lib/inspection-finding-elements';
import type { FindingBlock } from '@/types/report';
import type {
  InspectionFinding,
  InspectionRecord,
} from '@/types/workspace';

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function projectFinding(finding: InspectionFinding): FindingBlock {
  const condition = optionalText(finding.condition);
  const defect = optionalText(finding.defect);
  const recommendation = optionalText(finding.recommendation);
  const evidenceIds = [
    ...new Set(
      (finding.evidence ?? [])
        .map((reference) => reference.id.trim())
        .filter(Boolean),
    ),
  ];

  return {
    kind: 'finding',
    findingId: finding.id,
    elementConceptId: finding.elementConceptId,
    elementLabel: labelForInspectionElement(finding.elementConceptId),
    observation: finding.observation,
    ...(condition ? { condition } : {}),
    ...(defect ? { defect } : {}),
    ...(recommendation ? { recommendation } : {}),
    ...(evidenceIds.length > 0 ? { evidenceIds } : {}),
  };
}

export function projectInspectionFindings(
  inspection: InspectionRecord,
): readonly FindingBlock[] {
  return Object.values(inspection.findings)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(projectFinding);
}
