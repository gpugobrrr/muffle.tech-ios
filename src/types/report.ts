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
  evidenceIds?: readonly string[];
};

/**
 * Semantic blocks are ordered independently of pages. Renderers own layout
 * and pagination as more block kinds are introduced.
 */
export type ReportBlock = IdentityBlock | FindingBlock;

export type ReportDocument = {
  schemaVersion: 1;
  blocks: readonly ReportBlock[];
};
