import { resolveFieldValue } from '@/lib/field-schema';
import type {
  FindingBlock,
  IdentityBlock,
  ReportAddress,
  ReportDocument,
} from '@/types/report';
import type {
  ActiveJob,
  InspectionBrief,
  InspectionFinding,
  StructuredAddress,
} from '@/types/workspace';

export type ReportBuildInput = {
  activeJob: ActiveJob;
  inspectionBrief: InspectionBrief;
};

export class ReportBuildError extends Error {
  readonly code = 'MISSING_PROPERTY';

  constructor() {
    super('A structured selected property is required to build a report.');
    this.name = 'ReportBuildError';
  }
}

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function projectAddress(address: StructuredAddress): ReportAddress {
  return {
    formattedAddress: address.formattedAddress,
    line1: optionalText(address.line1),
    line2: optionalText(address.line2),
    line3: optionalText(address.line3),
    line4: optionalText(address.line4),
    streetNumber: optionalText(address.streetNumber),
    buildingName: optionalText(address.buildingName),
    subBuildingName: optionalText(address.subBuildingName),
    subBuildingNumber: optionalText(address.subBuildingNumber),
    route: optionalText(address.route),
    locality: optionalText(address.locality),
    townOrCity: optionalText(address.townOrCity),
    administrativeArea: optionalText(address.administrativeArea),
    district: optionalText(address.district),
    postalCode: optionalText(address.postalCode),
    country: optionalText(address.country),
    countryCode: optionalText(address.countryCode),
  };
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
    elementLabel: 'External wall',
    observation: finding.observation,
    ...(condition ? { condition } : {}),
    ...(defect ? { defect } : {}),
    ...(recommendation ? { recommendation } : {}),
    ...(evidenceIds.length > 0 ? { evidenceIds } : {}),
  };
}

/**
 * Pure projection from committed job records into a renderer-neutral report.
 * Draft entry, notes, completion, suggestions, and UI state are not accepted.
 */
export function buildReportDocument({
  activeJob,
  inspectionBrief,
}: ReportBuildInput): ReportDocument {
  const property = activeJob.property;
  if (!property?.address) {
    throw new ReportBuildError();
  }

  const instructingParty = optionalText(
    resolveFieldValue(
      inspectionBrief,
      'instruction.instructingParty',
    ),
  );
  const identity: IdentityBlock = {
    kind: 'identity',
    property: {
      displayAddress: property.displayAddress,
      address: projectAddress(property.address),
    },
    ...(instructingParty ? { instructingParty } : {}),
  };
  const findings = Object.values(activeJob.inspection.findings)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(projectFinding);

  return {
    schemaVersion: 1,
    blocks: [identity, ...findings],
  };
}
