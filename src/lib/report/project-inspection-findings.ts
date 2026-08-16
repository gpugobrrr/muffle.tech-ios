import {
  labelForInspectionElement,
} from '@/lib/inspection-finding-elements';
import { sortFindings } from '@/lib/inspection-findings';
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
  const location = optionalText(finding.location);
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
    ...(location ? { location } : {}),
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
  return sortFindings(Object.values(inspection.findings)).map(projectFinding);
}
