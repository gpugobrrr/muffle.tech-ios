import { ReportBuildError } from '@/lib/report/report-build-error';
import type {
  FactsBlock,
  FindingBlock,
  IdentityBlock,
  ReportBlock,
  ReportDocument,
  ReportFinding,
  ReportFindingGroup,
  ReportProjectedValue,
  SectionBlock,
  SectionLimitationBlock,
  SurveyReportModel,
} from '@/types/report';

const INSTRUCTING_PARTY_FIELD_ID = 'instruction.instructingParty';

const SECTION_TITLES: Readonly<Record<ReportFindingGroup, string>> = {
  external: 'External findings',
  internal: 'Internal findings',
  services: 'Services findings',
};

const SECTION_LIMITATION_TITLES: Readonly<Record<ReportFindingGroup, string>> = {
  external: 'External limitation',
  internal: 'Internal limitation',
  services: 'Services limitation',
};

function factRows(
  facts: readonly ReportProjectedValue[],
  excludeFieldIds: readonly string[] = [],
): FactsBlock['rows'] {
  const excluded = new Set(excludeFieldIds);
  return facts
    .filter((fact) => !excluded.has(fact.fieldId))
    .map((fact) => ({
      label: fact.label,
      value: fact.display,
    }));
}

function toFindingBlock(finding: ReportFinding): FindingBlock {
  const { group: _group, evidence: _evidence, ...block } = finding;
  return block;
}

function summaryFactsBlock(report: SurveyReportModel): FactsBlock | null {
  const { summary } = report;
  const rows = [
    { label: 'Findings', value: String(summary.findingCount) },
    { label: 'Defects', value: String(summary.defectCount) },
    { label: 'Recommendations', value: String(summary.recommendationCount) },
    { label: 'Risks', value: String(summary.riskCount) },
    { label: 'Evidence items', value: String(summary.evidenceCount) },
    ...(summary.sectionsWithFindings.length > 0
      ? [
          {
            label: 'Sections with findings',
            value: summary.sectionsWithFindings.join(', '),
          },
        ]
      : []),
  ];
  return {
    kind: 'facts',
    section: 'summary',
    title: 'Overview',
    rows,
  };
}

function factsBlock(
  section: FactsBlock['section'],
  title: string,
  facts: readonly ReportProjectedValue[],
  excludeFieldIds: readonly string[] = [],
): FactsBlock | null {
  const rows = factRows(facts, excludeFieldIds);
  if (rows.length === 0) return null;
  return { kind: 'facts', section, title, rows };
}

function evidenceSummaryBlock(
  report: SurveyReportModel,
): FactsBlock | null {
  if (report.evidenceSummary.count === 0) return null;
  const rows = report.evidenceSummary.items.map((item) => ({
    label: item.id,
    value: item.kind ? item.kind : 'evidence',
  }));
  return {
    kind: 'facts',
    section: 'evidence-summary',
    title: 'Evidence',
    rows,
  };
}

function sectionGroupBlocks(
  section: ReportFindingGroup,
  limitation: string | undefined,
  findings: readonly ReportFinding[],
): ReportBlock[] {
  if (!limitation && findings.length === 0) return [];

  const blocks: ReportBlock[] = [
    {
      kind: 'section',
      section,
      title: SECTION_TITLES[section],
    },
  ];

  if (limitation) {
    const limitationBlock: SectionLimitationBlock = {
      kind: 'section-limitation',
      section,
      title: SECTION_LIMITATION_TITLES[section],
      text: limitation,
    };
    blocks.push(limitationBlock);
  }

  blocks.push(...findings.map(toFindingBlock));
  return blocks;
}

/**
 * Pure SurveyReportModel → renderer-neutral ReportDocument adapter.
 * Does not reinterpret ActiveJob survey data.
 */
export function projectSurveyReportDocument(
  report: SurveyReportModel,
): ReportDocument {
  const address = report.identity.address;
  if (!address) {
    throw new ReportBuildError();
  }

  const displayAddress =
    report.identity.displayAddress?.trim() || address.formattedAddress;
  const instructingParty = report.instruction.find(
    (fact) => fact.fieldId === INSTRUCTING_PARTY_FIELD_ID,
  )?.display;

  const identity: IdentityBlock = {
    kind: 'identity',
    property: {
      displayAddress,
      address,
    },
    ...(instructingParty ? { instructingParty } : {}),
  };

  const blocks: ReportBlock[] = [identity];

  const summary = summaryFactsBlock(report);
  if (summary) blocks.push(summary);

  const instruction = factsBlock(
    'instruction',
    'Instruction',
    report.instruction,
    [INSTRUCTING_PARTY_FIELD_ID],
  );
  if (instruction) blocks.push(instruction);

  const propertyDescription = factsBlock(
    'property-description',
    'Property description',
    report.propertyDescription,
  );
  if (propertyDescription) blocks.push(propertyDescription);

  const propertyEnergy = factsBlock(
    'property-energy',
    'Property energy',
    report.propertyEnergy,
  );
  if (propertyEnergy) blocks.push(propertyEnergy);

  for (const section of ['external', 'internal', 'services'] as const) {
    blocks.push(
      ...sectionGroupBlocks(
        section,
        report.sectionLimitations[section],
        report.findings[section],
      ),
    );
  }

  const evidenceSummary = evidenceSummaryBlock(report);
  if (evidenceSummary) blocks.push(evidenceSummary);

  return {
    schemaVersion: 1,
    blocks,
  };
}
