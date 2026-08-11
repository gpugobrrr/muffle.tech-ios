import type { InspectionElementConceptId } from '@/lib/inspection-finding-elements';

export type BriefInstruction = {
  instructingParty: string | null;
  client: string | null;
  reference: string | null;
  source: string | null;
};

/**
 * Per-field flags that affect completion counts. Keys are slash paths such as
 * `prep/brief/instr/party`. Values never invent registry structure — they only
 * annotate the live job record.
 */
export type FieldCompletionMeta = {
  notApplicable?: boolean;
  /** Populated but not acceptable — counts toward total, not completed. */
  invalid?: boolean;
};

export type InspectionBrief = {
  instruction: BriefInstruction;
  purpose: string | null;
  deliverable: string | null;
  limitation: string | null;
  fieldMeta?: Record<string, FieldCompletionMeta>;
  /**
   * Registered scalar controlled facts keyed by canonical field ID.
   * Values are validated option IDs — never presentation labels.
   */
  controlledFacts?: Readonly<Record<string, string>>;
  /**
   * Registered set-valued controlled facts keyed by canonical field ID.
   * Values are schema-ordered canonical option IDs.
   */
  controlledFactSets?: Readonly<Record<string, readonly string[]>>;
};

/** Active survey site shown in the workspace header — never product branding. */
export type StructuredAddress = {
  placeId?: string;
  formattedAddress: string;
  /** Normalized first address line, when supplied by the address provider. */
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
  latitude?: number;
  longitude?: number;
};

export type ActiveProperty = {
  displayAddress: string;
  address?: StructuredAddress;
  instructionType?: string;
};

/** @deprecated Use InspectionElementConceptId */
export type BuildingElementConceptId = InspectionElementConceptId;

/** Stable reference only; media storage and metadata remain out of scope. */
export type InspectionEvidenceReference = {
  id: string;
};

export type InspectionEvidenceKind = 'photo';

/** Canonical evidence asset metadata — image bytes live on disk, not in JSON. */
export type InspectionEvidence = {
  id: string;
  kind: InspectionEvidenceKind;
  /** Persistent local file URI resolved by the evidence file helper. */
  uri: string;
};

/**
 * Canonical inspection content. Presentation labels and report layout never
 * belong here; `elementConceptId` is the stable semantic anchor.
 */
export type InspectionFinding = {
  id: string;
  elementConceptId: InspectionElementConceptId;
  observation: string;
  condition?: string;
  defect?: string;
  recommendation?: string;
  evidence?: readonly InspectionEvidenceReference[];
};

export type InspectionRecord = {
  findings: Readonly<Record<string, InspectionFinding>>;
  /** Canonical evidence assets keyed by stable evidence ID. */
  evidence?: Readonly<Record<string, InspectionEvidence>>;
};

export type ActiveJob = {
  /** Stable job identity used for on-device evidence file paths. */
  id: string;
  property: ActiveProperty | null;
  inspection: InspectionRecord;
};

/** Typed terminal response model */
export type TerminalMessage =
  | {
      type: 'error';
      primary: string;
      secondary?: string;
    }
  | {
      type: 'info';
      primary: string;
      secondary?: string;
    }
  | null;
