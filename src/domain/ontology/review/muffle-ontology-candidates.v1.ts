import type {
  OntologyConceptKind,
  OntologyMaturity,
  OntologyOwnership,
  OntologyValueType,
} from '@/domain/ontology/muffle-ontology.v1';

export type OntologyCandidateClassification =
  | 'existing-canonical-concept'
  | 'proposed-canonical-concept'
  | 'attribute-or-value'
  | 'alias'
  | 'relationship'
  | 'workflow'
  | 'publication'
  | 'adjunct'
  | 'uncertain';

export type OntologyCandidateConfidence = 'high' | 'medium' | 'low';
export type OntologyCandidateReviewStatus =
  | 'unreviewed'
  | 'approved'
  | 'rejected'
  | 'needs-revision';

export type OntologyCandidateSourceType =
  | 'existing-muffle-ontology'
  | 'current-report-architecture'
  | 'semantic-mapping-fixture'
  | 'rics-level-2-terminology'
  | 'project-design-direction'
  | 'general-domain-inference';

export type OntologyCandidateSource = {
  type: OntologyCandidateSourceType;
  id: string;
};

/**
 * Review-only draft data. It is deliberately separate from MUFFLE_ONTOLOGY_V1
 * and does not add runtime schema, operations, or report behavior.
 */
export type OntologyCandidateProposal = {
  id: string;
  sourceTerm: string;
  sourceContext?: string;
  sources: readonly OntologyCandidateSource[];
  classification: OntologyCandidateClassification;
  proposedConceptId?: string;
  mapsToExistingConceptId?: string;
  label?: string;
  description?: string;
  aliases?: readonly string[];
  parentId?: string;
  canonical: boolean;
  ownership?: OntologyOwnership;
  maturity?: OntologyMaturity;
  kind?: OntologyConceptKind;
  valueType?: {
    kind: OntologyValueType;
    nullable?: boolean;
  };
  rationale: string;
  confidence: OntologyCandidateConfidence;
  expertReviewRequired: boolean;
  reviewStatus: OntologyCandidateReviewStatus;
  notes?: string;
};

export type OntologyCandidateRelationship = {
  id: string;
  subjectId: string;
  predicate:
    | 'concerns'
    | 'belongs_to'
    | 'supports'
    | 'is_supported_by'
    | 'explains'
    | 'results_from'
    | 'arises_from'
    | 'addresses'
    | 'investigates'
    | 'constrains';
  objectId: string;
  rationale: string;
  confidence: OntologyCandidateConfidence;
  expertReviewRequired: boolean;
  reviewStatus: OntologyCandidateReviewStatus;
  sources: readonly OntologyCandidateSource[];
};

const EXISTING = [{ type: 'existing-muffle-ontology', id: 'v1.1.0' }] as const;
const REPORT = [
  { type: 'current-report-architecture', id: 'FirmAdapter:Main Walls' },
] as const;
const RICS = [{ type: 'rics-level-2-terminology', id: 'project-context' }] as const;
const DESIGN = [{ type: 'project-design-direction', id: 'finding-semantics' }] as const;
const FIXTURE = [
  { type: 'semantic-mapping-fixture', id: 'external-wall-terminology' },
] as const;
const INFERENCE = [
  { type: 'general-domain-inference', id: 'residential-surveying-review-draft' },
] as const;

function existing(
  id: string,
  sourceTerm: string,
  mapsToExistingConceptId: string,
  rationale: string,
): OntologyCandidateProposal {
  return {
    id,
    sourceTerm,
    sources: EXISTING,
    classification: 'existing-canonical-concept',
    mapsToExistingConceptId,
    canonical: true,
    rationale,
    confidence: 'high',
    expertReviewRequired: false,
    reviewStatus: 'unreviewed',
  };
}

function proposedElement(
  id: string,
  label: string,
  aliases: readonly string[] = [],
  confidence: OntologyCandidateConfidence = 'medium',
): OntologyCandidateProposal {
  const proposedConceptId = `building_element.${id}`;
  return {
    id: `candidate.${proposedConceptId}`,
    sourceTerm: label,
    sourceContext: 'Residential surveying element candidate.',
    sources: INFERENCE,
    classification: 'proposed-canonical-concept',
    proposedConceptId,
    label,
    description: `An inspectable residential building element: ${label.toLowerCase()}.`,
    aliases,
    parentId: 'building_element',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    kind: 'value',
    valueType: { kind: 'text' },
    rationale:
      'Candidate is intended as stable pre-publication property meaning; engine support requires separate approval and implementation.',
    confidence,
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
  };
}

function proposedFindingField(
  id: string,
  label: string,
  rationale: string,
  confidence: OntologyCandidateConfidence = 'medium',
): OntologyCandidateProposal {
  return {
    id: `candidate.${id}`,
    sourceTerm: label,
    sourceContext: 'Future inspection finding semantic chain.',
    sources: DESIGN,
    classification: 'proposed-canonical-concept',
    proposedConceptId: id,
    label,
    description: `A finding-level ${label.toLowerCase()} semantic.`,
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    kind: 'field',
    valueType: { kind: 'text', nullable: true },
    rationale,
    confidence,
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
  };
}

function attribute(
  id: string,
  sourceTerm: string,
  parentId: string,
  rationale: string,
): OntologyCandidateProposal {
  return {
    id: `candidate.${id}`,
    sourceTerm,
    sources: INFERENCE,
    classification: 'attribute-or-value',
    proposedConceptId: id,
    label: sourceTerm,
    parentId,
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    kind: 'attribute',
    valueType: { kind: 'text', nullable: true },
    rationale,
    confidence: 'medium',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
  };
}

export const MUFFLE_ONTOLOGY_CANDIDATES_V1: readonly OntologyCandidateProposal[] = [
  existing(
    'candidate.existing.property',
    'Property',
    'property',
    'Existing canonical adjacent job-state concept.',
  ),
  existing(
    'candidate.existing.building-element',
    'Building element',
    'building_element',
    'Existing canonical finding subject classification.',
  ),
  existing(
    'candidate.existing.inspection-finding',
    'Inspection finding',
    'inspection.finding',
    'Existing canonical engine-backed finding record.',
  ),
  existing(
    'candidate.existing.observation',
    'Observation',
    'observation',
    'Existing canonical finding primitive.',
  ),
  existing(
    'candidate.existing.condition',
    'Condition',
    'condition',
    'Existing canonical finding primitive.',
  ),
  existing(
    'candidate.existing.defect',
    'Defect',
    'defect',
    'Existing canonical finding primitive.',
  ),
  existing(
    'candidate.existing.recommendation',
    'Recommendation',
    'recommendation',
    'Existing canonical finding primitive.',
  ),
  existing(
    'candidate.existing.evidence',
    'Evidence',
    'evidence',
    'Existing canonical supporting-evidence reference, distinct from notes.',
  ),
  existing(
    'candidate.existing.external-wall',
    'External wall',
    'building_element.external_wall',
    'The single currently implemented concrete building-element value.',
  ),
  {
    id: 'candidate.alias.main-walls',
    sourceTerm: 'Main Walls',
    sourceContext: 'Demo adapter and Level 2-style report heading.',
    sources: [...REPORT, ...FIXTURE],
    classification: 'alias',
    mapsToExistingConceptId: 'building_element.external_wall',
    aliases: ['Main Walls', 'External Walls', 'Main External Walls', 'Walling', 'Principal Walling'],
    canonical: false,
    rationale:
      'These terms can denote the external-wall element in context; a surveyor must confirm the alias scope before promotion.',
    confidence: 'medium',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
    notes: 'External elevations is intentionally excluded because it may be broader than walling.',
  },
  {
    id: 'candidate.publication.rics-d4-main-walls',
    sourceTerm: 'D4 Main Walls',
    sourceContext: 'RICS Level 2-style section terminology.',
    sources: RICS,
    classification: 'publication',
    mapsToExistingConceptId: 'building_element.external_wall',
    canonical: false,
    ownership: 'report-model',
    maturity: 'type-only',
    kind: 'publication',
    rationale:
      'A report heading that may publish the external-wall concept; it is not a separate physical building element.',
    confidence: 'high',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
  },
  proposedFindingField(
    'cause',
    'Cause',
    'A possible explanation for a defect must remain distinct from the observed defect and requires professional adjudication.',
    'low',
  ),
  proposedFindingField(
    'implication',
    'Implication',
    'A consequence of a defect is distinct from the defect, risk, and recommendation.',
    'low',
  ),
  proposedFindingField(
    'risk',
    'Risk',
    'A professionally assessed potential adverse outcome should not be conflated with a defect or implication.',
    'low',
  ),
  proposedFindingField(
    'further_investigation',
    'Further investigation',
    'Advice to investigate uncertainty is distinct from remedial recommendation.',
    'medium',
  ),
  proposedFindingField(
    'measurement',
    'Measurement',
    'A measured value may support a finding but needs a later controlled representation.',
  ),
  proposedFindingField(
    'limitation',
    'Finding limitation',
    'A finding-level constraint differs from the existing brief-level limitation.',
    'low',
  ),
  proposedFindingField(
    'significance',
    'Significance',
    'Assessment significance may be distinct from condition and requires surveyor workflow review.',
    'low',
  ),
  ...[
    ['roof_covering', 'Roof covering', ['Roof coverings'], 'high'],
    ['roof_structure', 'Roof structure', [], 'high'],
    ['chimney', 'Chimney', ['Chimneys'], 'high'],
    ['rainwater_goods', 'Rainwater goods', ['Gutters and downpipes'], 'high'],
    ['window', 'Window', ['Windows'], 'high'],
    ['external_door', 'External door', ['Outside doors', 'Patio doors'], 'high'],
    ['porch', 'Porch', ['Porches'], 'medium'],
    ['conservatory', 'Conservatory', ['Conservatories'], 'medium'],
    ['balcony', 'Balcony', ['Balconies'], 'medium'],
    ['external_finish', 'External finish', ['Render', 'Cladding'], 'medium'],
    ['damp_proof_course', 'Damp proof course', ['DPC'], 'medium'],
    ['foundation', 'Foundation', ['Foundations'], 'low'],
    ['internal_wall', 'Internal wall', ['Internal walls'], 'high'],
    ['partition', 'Partition', ['Partitions'], 'high'],
    ['ceiling', 'Ceiling', ['Ceilings'], 'high'],
    ['floor', 'Floor', ['Floors'], 'high'],
    ['staircase', 'Staircase', ['Stairs'], 'high'],
    ['internal_door', 'Internal door', ['Internal doors'], 'high'],
    ['fireplace', 'Fireplace', ['Fireplaces'], 'medium'],
    ['roof_void', 'Roof void', ['Roof space'], 'medium'],
    ['cellar_basement', 'Cellar or basement', ['Cellar', 'Basement'], 'medium'],
    ['electrical_installation', 'Electrical installation', ['Electricity'], 'high'],
    ['gas_installation', 'Gas installation', ['Gas'], 'medium'],
    ['water_supply', 'Water supply', ['Water'], 'medium'],
    ['heating_system', 'Heating system', ['Heating'], 'high'],
    ['hot_water_system', 'Hot water system', ['Hot water'], 'medium'],
    ['drainage', 'Drainage', ['Drainage system'], 'medium'],
    ['ventilation', 'Ventilation', ['Ventilation system'], 'medium'],
    ['renewable_energy_system', 'Renewable energy system', ['Solar panels'], 'low'],
    ['boundary', 'Boundary', ['Boundaries'], 'medium'],
    ['retaining_wall', 'Retaining wall', ['Retaining walls'], 'medium'],
    ['driveway', 'Driveway', ['Driveways'], 'medium'],
    ['path', 'Path', ['Paths'], 'medium'],
    ['patio', 'Patio', ['Patios'], 'medium'],
    ['outbuilding', 'Outbuilding', ['Outbuildings'], 'medium'],
    ['garage', 'Garage', ['Garages'], 'medium'],
    ['external_drainage', 'External drainage', ['Drains'], 'medium'],
    ['tree_vegetation', 'Tree or vegetation', ['Trees', 'Vegetation'], 'low'],
  ].map(([id, label, aliases, confidence]) =>
    proposedElement(
      id as string,
      label as string,
      aliases as readonly string[],
      confidence as OntologyCandidateConfidence,
    ),
  ),
  attribute(
    'building_element.construction_type',
    'Construction type',
    'building_element',
    'Construction is a property of an element, not a new building element.',
  ),
  attribute(
    'building_element.material',
    'Material',
    'building_element',
    'Brick, stone, render, and timber frame are candidate controlled values or attributes, not standalone inspection elements.',
  ),
  attribute(
    'building_element.location',
    'Location or elevation',
    'building_element',
    'Front, rear, left, and right are likely controlled location/elevation values.',
  ),
  {
    id: 'candidate.value.condition-rating',
    sourceTerm: 'Condition Rating 2',
    sources: RICS,
    classification: 'attribute-or-value',
    label: 'Condition rating',
    canonical: false,
    ownership: 'report-model',
    maturity: 'type-only',
    kind: 'value',
    rationale:
      'A report rating may need decomposition into assessment/value mapping; it is not automatically canonical condition meaning.',
    confidence: 'low',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
  },
  {
    id: 'candidate.publication.rics-section-heading',
    sourceTerm: 'RICS section heading',
    sourceContext: 'Coded D/E/F report headings.',
    sources: RICS,
    classification: 'publication',
    canonical: false,
    ownership: 'report-model',
    maturity: 'type-only',
    kind: 'publication',
    rationale:
      'Report section structure is publication terminology; adapters should map canonical meaning to firm/report headings.',
    confidence: 'high',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
  },
  {
    id: 'candidate.workflow.svyr-prep',
    sourceTerm: 'PREP',
    sourceContext: 'SVYR preparation navigation token.',
    sources: [{ type: 'existing-muffle-ontology', id: 'workflow.preparation' }],
    classification: 'workflow',
    mapsToExistingConceptId: 'workflow.preparation',
    canonical: false,
    ownership: 'workflow',
    maturity: 'implemented',
    kind: 'workflow',
    rationale: 'Navigation/workflow vocabulary is not property or finding truth.',
    confidence: 'high',
    expertReviewRequired: false,
    reviewStatus: 'unreviewed',
  },
  {
    id: 'candidate.adjunct.note',
    sourceTerm: 'Note',
    sources: EXISTING,
    classification: 'adjunct',
    mapsToExistingConceptId: 'note',
    canonical: false,
    ownership: 'adjunct-state',
    maturity: 'adjunct',
    kind: 'adjunct',
    rationale: 'Notes remain separate from evidence and excluded from completion.',
    confidence: 'high',
    expertReviewRequired: false,
    reviewStatus: 'unreviewed',
  },
  {
    id: 'candidate.uncertain.external-elevations',
    sourceTerm: 'External elevations',
    sources: FIXTURE,
    classification: 'uncertain',
    canonical: false,
    rationale:
      'Could describe a broader external grouping rather than an alias for external wall alone.',
    confidence: 'low',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
  },
  {
    id: 'candidate.uncertain.construction',
    sourceTerm: 'Construction',
    sources: DESIGN,
    classification: 'uncertain',
    canonical: false,
    rationale:
      'Could be an element attribute, an observation dimension, or a future finding field; current engine has no representation.',
    confidence: 'low',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
  },
] as const;

export const MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1: readonly OntologyCandidateRelationship[] = [
  {
    id: 'candidate-relation.finding-concerns-building-element',
    subjectId: 'inspection.finding',
    predicate: 'concerns',
    objectId: 'building_element',
    rationale: 'A finding is about an inspected building element.',
    confidence: 'high',
    expertReviewRequired: false,
    reviewStatus: 'unreviewed',
    sources: DESIGN,
  },
  {
    id: 'candidate-relation.observation-belongs-to-finding',
    subjectId: 'observation',
    predicate: 'belongs_to',
    objectId: 'inspection.finding',
    rationale: 'Observation is a finding primitive.',
    confidence: 'high',
    expertReviewRequired: false,
    reviewStatus: 'unreviewed',
    sources: EXISTING,
  },
  {
    id: 'candidate-relation.evidence-supports-observation',
    subjectId: 'evidence',
    predicate: 'supports',
    objectId: 'observation',
    rationale: 'Evidence supports inspection observation rather than becoming a note.',
    confidence: 'medium',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
    sources: DESIGN,
  },
  {
    id: 'candidate-relation.defect-supported-by-observation',
    subjectId: 'defect',
    predicate: 'is_supported_by',
    objectId: 'observation',
    rationale: 'A defect assessment should be grounded in observation.',
    confidence: 'medium',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
    sources: DESIGN,
  },
  {
    id: 'candidate-relation.cause-explains-defect',
    subjectId: 'cause',
    predicate: 'explains',
    objectId: 'defect',
    rationale: 'Possible cause is not the same as a defect.',
    confidence: 'low',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
    sources: DESIGN,
  },
  {
    id: 'candidate-relation.implication-results-from-defect',
    subjectId: 'implication',
    predicate: 'results_from',
    objectId: 'defect',
    rationale: 'Implication is a possible consequence of a defect.',
    confidence: 'low',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
    sources: DESIGN,
  },
  {
    id: 'candidate-relation.risk-arises-from-implication',
    subjectId: 'risk',
    predicate: 'arises_from',
    objectId: 'implication',
    rationale: 'Risk may arise from an assessed implication.',
    confidence: 'low',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
    sources: DESIGN,
  },
  {
    id: 'candidate-relation.recommendation-addresses-defect',
    subjectId: 'recommendation',
    predicate: 'addresses',
    objectId: 'defect',
    rationale: 'Recommendation can address a defect or associated risk.',
    confidence: 'medium',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
    sources: EXISTING,
  },
  {
    id: 'candidate-relation.investigation-investigates-limitation',
    subjectId: 'further_investigation',
    predicate: 'investigates',
    objectId: 'limitation',
    rationale: 'Further investigation can respond to uncertainty or inspection limitation.',
    confidence: 'low',
    expertReviewRequired: true,
    reviewStatus: 'unreviewed',
    sources: DESIGN,
  },
] as const;

export function getOntologyCandidatesByClassification(
  classification: OntologyCandidateClassification,
): OntologyCandidateProposal[] {
  return MUFFLE_ONTOLOGY_CANDIDATES_V1.filter(
    (candidate) => candidate.classification === classification,
  );
}

export function getOntologyCandidatesByConfidence(
  confidence: OntologyCandidateConfidence,
): OntologyCandidateProposal[] {
  return MUFFLE_ONTOLOGY_CANDIDATES_V1.filter(
    (candidate) => candidate.confidence === confidence,
  );
}

export function getOntologyCandidatesRequiringExpertReview(): OntologyCandidateProposal[] {
  return MUFFLE_ONTOLOGY_CANDIDATES_V1.filter(
    (candidate) => candidate.expertReviewRequired,
  );
}

function normalizeForDuplicateReview(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function findPotentialOntologyCandidateDuplicates(): OntologyCandidateProposal[][] {
  const groups = new Map<string, OntologyCandidateProposal[]>();
  for (const candidate of MUFFLE_ONTOLOGY_CANDIDATES_V1) {
    const key = normalizeForDuplicateReview(
      candidate.proposedConceptId ?? candidate.sourceTerm,
    );
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}
