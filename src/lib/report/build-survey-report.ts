import { EXTERNAL_FINDING_CONFIGS } from '@/lib/external-findings';
import type { FindingCaptureConfig } from '@/lib/finding-capture';
import { INTERNAL_FINDING_CONFIGS } from '@/lib/internal-findings';
import {
  SERVICES_FINDING_CONFIGS,
  SERVICES_GAS_FINDING_CONFIG,
} from '@/lib/services-findings';
import {
  findFieldDefinitionByFieldId,
  resolveFieldSetValue,
  resolveFieldValue,
  type FieldDefinition,
} from '@/lib/field-schema';
import { readActiveJobBrief } from '@/lib/job-persistence';
import { HEATING_FIELD_DEFINITIONS } from '@/lib/property-energy-heating';
import { MAINS_SERVICE_FIELD_DEFINITIONS } from '@/lib/property-energy-mains-services';
import { PROPERTY_DESCRIPTION_FIELD_DEFINITIONS } from '@/lib/property-description';
import {
  optionalReportText,
  projectFindingBlock,
  projectReportAddress,
} from '@/lib/report/project-canonical';
import type {
  ReportEvidenceItem,
  ReportFinding,
  ReportFindingGroup,
  ReportProjectedValue,
  SurveyReportModel,
  SurveyReportSummary,
} from '@/types/report';
import type {
  ActiveJob,
  InspectionBrief,
  InspectionEvidence,
  InspectionFinding,
  InspectionRecord,
} from '@/types/workspace';

const FINDING_CAPTURE_CONFIGS: readonly FindingCaptureConfig[] = [
  ...EXTERNAL_FINDING_CONFIGS,
  ...INTERNAL_FINDING_CONFIGS,
  ...SERVICES_FINDING_CONFIGS,
  SERVICES_GAS_FINDING_CONFIG,
];

const INSTRUCTION_FIELD_IDS = [
  'instruction.instructingParty',
  'instruction.client',
  'instruction.reference',
  'instruction.source',
  'purpose',
  'deliverable',
  'limitation',
] as const;

const FINDING_GROUPS: readonly ReportFindingGroup[] = [
  'external',
  'internal',
  'services',
];

function displayForFieldValue(
  field: FieldDefinition | null,
  value: string,
): string {
  const option = field?.options?.find((item) => item.value === value);
  return option?.label ?? value;
}

function projectScalarFact(
  brief: InspectionBrief,
  field: FieldDefinition,
): ReportProjectedValue | undefined {
  const raw = resolveFieldValue(brief, field.fieldId);
  if (raw === null) return undefined;
  const value = optionalReportText(raw);
  if (!value) return undefined;
  return {
    fieldId: field.fieldId,
    label: field.label,
    value,
    display: displayForFieldValue(field, value),
  };
}

function projectMultiFact(
  brief: InspectionBrief,
  field: FieldDefinition,
): ReportProjectedValue | undefined {
  const values = resolveFieldSetValue(brief, field.fieldId);
  if (values.length === 0) return undefined;
  return {
    fieldId: field.fieldId,
    label: field.label,
    value: values,
    display: values.map((value) => displayForFieldValue(field, value)).join(', '),
  };
}

function projectFacts(
  brief: InspectionBrief,
  fields: readonly FieldDefinition[],
): readonly ReportProjectedValue[] {
  return fields.flatMap((field) => {
    const projected =
      field.valueType === 'multiSelect'
        ? projectMultiFact(brief, field)
        : projectScalarFact(brief, field);
    return projected ? [projected] : [];
  });
}

function groupForConfig(config: FindingCaptureConfig): ReportFindingGroup {
  const section = config.route[0];
  if (section === 'external' || section === 'internal' || section === 'services') {
    return section;
  }
  return 'external';
}

function groupForFinding(finding: InspectionFinding): ReportFindingGroup {
  const config = FINDING_CAPTURE_CONFIGS.find(
    (item) =>
      item.findingId === finding.id ||
      item.elementConceptId === finding.elementConceptId,
  );
  if (config) return groupForConfig(config);
  if (finding.elementConceptId.startsWith('service_system.')) return 'services';
  if (finding.elementConceptId === 'building_element.ceiling') return 'internal';
  return 'external';
}

function evidenceItemFor(
  id: string,
  record: InspectionEvidence | undefined,
  findingIds: readonly string[],
): ReportEvidenceItem {
  return {
    id,
    ...(record?.kind ? { kind: record.kind } : {}),
    ...(optionalReportText(record?.uri) ? { uri: record!.uri.trim() } : {}),
    findingIds,
  };
}

function projectReportFinding(
  finding: InspectionFinding,
  inspection: InspectionRecord,
): ReportFinding {
  const block = projectFindingBlock(finding);
  const evidenceIds = block.evidenceIds ?? [];
  const evidence = evidenceIds.map((id) =>
    evidenceItemFor(id, inspection.evidence?.[id], [finding.id]),
  );
  return {
    ...block,
    group: groupForFinding(finding),
    evidence,
  };
}

function orderedFindings(inspection: InspectionRecord): InspectionFinding[] {
  const byId = inspection.findings;
  const seen = new Set<string>();
  const ordered: InspectionFinding[] = [];
  for (const config of FINDING_CAPTURE_CONFIGS) {
    const finding = byId[config.findingId];
    if (!finding) continue;
    seen.add(finding.id);
    ordered.push(finding);
  }
  const remainder = Object.values(byId)
    .filter((finding) => !seen.has(finding.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  return [...ordered, ...remainder];
}

function buildEvidenceSummary(
  inspection: InspectionRecord,
  findings: readonly ReportFinding[],
): SurveyReportModel['evidenceSummary'] {
  const findingIdsByEvidence = new Map<string, string[]>();
  for (const finding of findings) {
    for (const id of finding.evidenceIds ?? []) {
      findingIdsByEvidence.set(id, [
        ...(findingIdsByEvidence.get(id) ?? []),
        finding.findingId,
      ]);
    }
  }
  const registryIds = Object.keys(inspection.evidence ?? {}).sort();
  const referencedIds = [...findingIdsByEvidence.keys()].sort();
  const ids = [...new Set([...registryIds, ...referencedIds])];
  const items = ids.map((id) =>
    evidenceItemFor(
      id,
      inspection.evidence?.[id],
      findingIdsByEvidence.get(id) ?? [],
    ),
  );
  return {
    count: registryIds.length,
    items,
  };
}

function buildSummary(
  job: ActiveJob,
  findings: readonly ReportFinding[],
  evidenceCount: number,
): SurveyReportSummary {
  const sectionsWithFindings = FINDING_GROUPS.filter((group) =>
    findings.some((finding) => finding.group === group),
  );
  const displayAddress = optionalReportText(job.property?.displayAddress);
  return {
    jobId: job.id,
    ...(displayAddress ? { displayAddress } : {}),
    findingCount: findings.length,
    defectCount: findings.filter((finding) => Boolean(finding.defect)).length,
    recommendationCount: findings.filter((finding) =>
      Boolean(finding.recommendation),
    ).length,
    riskCount: findings.filter((finding) => Boolean(finding.risk)).length,
    evidenceCount,
    sectionsWithFindings,
  };
}

/**
 * Pure ActiveJob → semantic report projection. Does not mutate the job and
 * does not persist. Throw-away: regenerating from the same job is the source
 * of truth.
 */
export function buildSurveyReport(activeJob: ActiveJob): SurveyReportModel {
  const brief = readActiveJobBrief(activeJob);
  const inspection = activeJob.inspection;
  const projectedFindings = orderedFindings(inspection).map((finding) =>
    projectReportFinding(finding, inspection),
  );
  const grouped = {
    external: projectedFindings.filter((finding) => finding.group === 'external'),
    internal: projectedFindings.filter((finding) => finding.group === 'internal'),
    services: projectedFindings.filter((finding) => finding.group === 'services'),
  };
  const evidenceSummary = buildEvidenceSummary(inspection, projectedFindings);
  const displayAddress = optionalReportText(activeJob.property?.displayAddress);
  const instructionType = optionalReportText(
    activeJob.property?.instructionType,
  );
  const address = activeJob.property?.address
    ? projectReportAddress(activeJob.property.address)
    : undefined;

  return {
    schemaVersion: 1,
    identity: {
      jobId: activeJob.id,
      ...(displayAddress ? { displayAddress } : {}),
      ...(instructionType ? { instructionType } : {}),
      ...(address ? { address } : {}),
    },
    instruction: INSTRUCTION_FIELD_IDS.flatMap((fieldId) => {
      const field = findFieldDefinitionByFieldId(fieldId);
      if (!field) return [];
      const projected = projectScalarFact(brief, field);
      return projected ? [projected] : [];
    }),
    propertyDescription: projectFacts(
      brief,
      PROPERTY_DESCRIPTION_FIELD_DEFINITIONS,
    ),
    propertyEnergy: projectFacts(brief, [
      ...HEATING_FIELD_DEFINITIONS,
      ...MAINS_SERVICE_FIELD_DEFINITIONS,
    ]),
    findings: grouped,
    evidenceSummary,
    summary: buildSummary(activeJob, projectedFindings, evidenceSummary.count),
  };
}
