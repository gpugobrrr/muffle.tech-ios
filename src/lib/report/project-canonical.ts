import { labelForInspectionElement } from '@/lib/inspection-finding-elements';
import type {
  FindingBlock,
  ReportAddress,
} from '@/types/report';
import type {
  InspectionFinding,
  StructuredAddress,
} from '@/types/workspace';

export function optionalReportText(
  value: string | null | undefined,
): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function projectReportAddress(
  address: StructuredAddress,
): ReportAddress {
  return {
    formattedAddress: address.formattedAddress,
    line1: optionalReportText(address.line1),
    line2: optionalReportText(address.line2),
    line3: optionalReportText(address.line3),
    line4: optionalReportText(address.line4),
    streetNumber: optionalReportText(address.streetNumber),
    buildingName: optionalReportText(address.buildingName),
    subBuildingName: optionalReportText(address.subBuildingName),
    subBuildingNumber: optionalReportText(address.subBuildingNumber),
    route: optionalReportText(address.route),
    locality: optionalReportText(address.locality),
    townOrCity: optionalReportText(address.townOrCity),
    administrativeArea: optionalReportText(address.administrativeArea),
    district: optionalReportText(address.district),
    postalCode: optionalReportText(address.postalCode),
    country: optionalReportText(address.country),
    countryCode: optionalReportText(address.countryCode),
  };
}

export function projectFindingBlock(finding: InspectionFinding): FindingBlock {
  const condition = optionalReportText(finding.condition);
  const defect = optionalReportText(finding.defect);
  const recommendation = optionalReportText(finding.recommendation);
  const limitation = optionalReportText(finding.limitation);
  const furtherInvestigation = optionalReportText(finding.furtherInvestigation);
  const risk = optionalReportText(finding.risk);
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
    ...(limitation ? { limitation } : {}),
    ...(furtherInvestigation ? { furtherInvestigation } : {}),
    ...(risk ? { risk } : {}),
    ...(evidenceIds.length > 0 ? { evidenceIds } : {}),
  };
}
