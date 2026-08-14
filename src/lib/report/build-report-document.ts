import { resolveFieldValue } from '@/lib/field-schema';
import {
  optionalReportText,
  projectFindingBlock,
  projectReportAddress,
} from '@/lib/report/project-canonical';
import type {
  IdentityBlock,
  ReportDocument,
} from '@/types/report';
import type {
  ActiveJob,
  InspectionBrief,
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

  const instructingParty = optionalReportText(
    resolveFieldValue(
      inspectionBrief,
      'instruction.instructingParty',
    ),
  );
  const identity: IdentityBlock = {
    kind: 'identity',
    property: {
      displayAddress: property.displayAddress,
      address: projectReportAddress(property.address),
    },
    ...(instructingParty ? { instructingParty } : {}),
  };
  const findings = Object.values(activeJob.inspection.findings)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(projectFindingBlock);

  return {
    schemaVersion: 1,
    blocks: [identity, ...findings],
  };
}
