/**
 * Structured address data suitable for publication. Provider identifiers and
 * map coordinates intentionally remain outside the report model.
 */
import type { InspectionElementConceptId } from '@/lib/inspection-finding-elements';

export type ReportAddress = {
  formattedAddress: string;
  line1?: string;
  line2?: string;
  line3?: string;
  line4?: string;
  streetNumber?: string;
  buildingName?: string;
  subBuildingName?: string;
  subBuildingNumber?: string;
  route?: string;
  locality?: string;
  townOrCity?: string;
  administrativeArea?: string;
  district?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
};

export type IdentityBlock = {
  kind: 'identity';
  property: {
    displayAddress: string;
    address: ReportAddress;
  };
  /** Present only when committed through the canonical brief operation. */
  instructingParty?: string;
};

export type FindingBlock = {
  kind: 'finding';
  findingId: string;
  /** Stable canonical semantic ID; firm adapters must preserve this value. */
  elementConceptId: InspectionElementConceptId;
  /** Neutral ontology label, before any firm terminology is applied. */
  elementLabel: string;
  observation: string;
  condition?: string;
  defect?: string;
  recommendation?: string;
  limitation?: string;
  furtherInvestigation?: string;
  risk?: string;
  evidenceIds?: readonly string[];
};

/** Canonical machine value plus schema/ontology display label. */
export type ReportProjectedValue = {
  fieldId: string;
  label: string;
  /** Canonical stored value, or ordered option IDs for multi-select facts. */
  value: string | readonly string[];
  display: string;
};

export type ReportFindingGroup = 'external' | 'internal' | 'services';

export type SurveySectionLimitations = {
  external?: string;
  internal?: string;
  services?: string;
};

export type ReportEvidenceItem = {
  id: string;
  kind?: 'photo';
  /** Canonical registry URI when present. Never contains image bytes. */
  uri?: string;
  findingIds: readonly string[];
};

export type ReportFinding = FindingBlock & {
  group: ReportFindingGroup;
  evidence: readonly ReportEvidenceItem[];
};

export type SurveyReportSummary = {
  jobId: string;
  displayAddress?: string;
  findingCount: number;
  defectCount: number;
  recommendationCount: number;
  riskCount: number;
  evidenceCount: number;
  sectionsWithFindings: readonly ReportFindingGroup[];
};

/**
 * Deterministic survey-domain projection. Regenerated from ActiveJob; never
 * stored as independent canonical truth.
 */
export type SurveyReportModel = {
  schemaVersion: 1;
  identity: {
    jobId: string;
    displayAddress?: string;
    instructionType?: string;
    address?: ReportAddress;
  };
  instruction: readonly ReportProjectedValue[];
  propertyDescription: readonly ReportProjectedValue[];
  propertyEnergy: readonly ReportProjectedValue[];
  sectionLimitations: SurveySectionLimitations;
  findings: {
    external: readonly ReportFinding[];
    internal: readonly ReportFinding[];
    services: readonly ReportFinding[];
  };
  evidenceSummary: {
    count: number;
    items: readonly ReportEvidenceItem[];
  };
  summary: SurveyReportSummary;
};

export type FactsBlock = {
  kind: 'facts';
  section:
    | 'summary'
    | 'instruction'
    | 'property-description'
    | 'property-energy'
    | 'evidence-summary';
  title: string;
  rows: readonly { label: string; value: string }[];
};

export type SectionBlock = {
  kind: 'section';
  section: ReportFindingGroup;
  title: string;
};

/**
 * Semantic blocks are ordered independently of pages. Renderers own layout
 * and pagination as more block kinds are introduced.
 */
export type ReportBlock =
  | IdentityBlock
  | FactsBlock
  | SectionBlock
  | FindingBlock;

export type ReportDocument = {
  schemaVersion: 1;
  blocks: readonly ReportBlock[];
};
