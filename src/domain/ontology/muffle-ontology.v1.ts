import { COMMAND_ALIASES } from '@/lib/command-registry';
import {
  allDirectoryDefinitions,
  allFieldDefinitions,
  type FieldDefinition,
} from '@/lib/field-schema';
import { SURVEY_OPERATIONS } from '@/lib/survey-operations';

export type OntologyConceptKind =
  | 'entity'
  | 'field'
  | 'attribute'
  | 'workflow'
  | 'value'
  | 'publication'
  | 'adjunct';

export type OntologyOwnership =
  | 'engine-record'
  | 'job-state'
  | 'report-model'
  | 'workflow'
  | 'adjunct-state';

export type OntologyMaturity =
  | 'implemented'
  | 'engine-backed'
  | 'schema-only'
  | 'type-only'
  | 'adjunct';

export type OntologyValueType =
  | 'object'
  | 'text'
  | 'singleSelect'
  | 'controlledStatus'
  | 'multiSelect'
  | 'boolean'
  | 'number'
  | 'address';

export type OntologySourceType =
  | 'domain-type'
  | 'field-schema'
  | 'command-registry'
  | 'engine-operation'
  | 'completion-model'
  | 'notes-contract'
  | 'report-model'
  | 'ontology-review';

export type OntologyConcept = {
  id: string;
  introducedIn: '1.0.0' | '1.1.0' | '1.2.0';
  kind: OntologyConceptKind;
  label: string;
  description: string;
  aliases?: readonly string[];
  parentId?: string;
  /**
   * True only for authoritative domain truth. Derived report projections,
   * workflow vocabulary, and adjunct notes are not canonical.
   */
  canonical: boolean;
  ownership: OntologyOwnership;
  maturity: OntologyMaturity;
  valueType?: {
    kind: OntologyValueType;
    nullable?: boolean;
    options?: readonly string[];
  };
  completion?: 'required' | 'optional' | 'excluded' | 'metadata';
  bindings?: {
    domainType?: string;
    domainProperty?: string;
    canonicalFieldId?: string;
    schemaPath?: string;
    svyrPath?: string;
    svyrToken?: string;
    setOperationId?: string;
    readOperationId?: string;
  };
  source: readonly {
    type: OntologySourceType;
    id: string;
  }[];
};

export type MuffleOntologyV1 = {
  ontologyId: 'muffle-ontology';
  version: '1.2.0';
  concepts: readonly OntologyConcept[];
};

const BASE = {
  introducedIn: '1.0.0',
} as const;

const V1_1_BASE = {
  introducedIn: '1.1.0',
} as const;

const V1_2_BASE = {
  introducedIn: '1.2.0',
} as const;

const DOMAIN_CONCEPTS: OntologyConcept[] = [
  {
    ...BASE,
    id: 'active_job',
    kind: 'entity',
    label: 'Active job',
    description: 'The current surveying job context.',
    canonical: true,
    ownership: 'job-state',
    maturity: 'implemented',
    valueType: { kind: 'object' },
    bindings: { domainType: 'ActiveJob' },
    source: [{ type: 'domain-type', id: 'ActiveJob' }],
  },
  {
    ...BASE,
    id: 'property',
    kind: 'entity',
    label: 'Property',
    description: 'The selected property to which the survey relates.',
    parentId: 'active_job',
    canonical: true,
    ownership: 'job-state',
    maturity: 'implemented',
    valueType: { kind: 'object' },
    bindings: {
      domainType: 'ActiveProperty',
      domainProperty: 'ActiveJob.property',
    },
    source: [{ type: 'domain-type', id: 'ActiveProperty' }],
  },
  {
    ...BASE,
    id: 'property.address',
    kind: 'entity',
    label: 'Structured address',
    description: 'The provider-normalized structured address of the property.',
    parentId: 'property',
    canonical: true,
    ownership: 'job-state',
    maturity: 'implemented',
    valueType: { kind: 'address' },
    bindings: {
      domainType: 'StructuredAddress',
      domainProperty: 'ActiveProperty.address',
    },
    source: [{ type: 'domain-type', id: 'StructuredAddress' }],
  },
  {
    ...BASE,
    id: 'property.display_address',
    kind: 'attribute',
    label: 'Display address',
    description: 'The formatted property address used for concise display.',
    parentId: 'property',
    canonical: true,
    ownership: 'job-state',
    maturity: 'implemented',
    valueType: { kind: 'text' },
    bindings: { domainProperty: 'ActiveProperty.displayAddress' },
    source: [{ type: 'domain-type', id: 'ActiveProperty.displayAddress' }],
  },
  {
    ...BASE,
    id: 'property.instruction_type',
    kind: 'attribute',
    label: 'Instruction type',
    description: 'An optional type label associated with the property instruction.',
    parentId: 'property',
    canonical: true,
    ownership: 'job-state',
    maturity: 'type-only',
    valueType: { kind: 'text', nullable: true },
    bindings: { domainProperty: 'ActiveProperty.instructionType' },
    source: [{ type: 'domain-type', id: 'ActiveProperty.instructionType' }],
  },
  {
    ...BASE,
    id: 'inspection_brief',
    kind: 'entity',
    label: 'Inspection brief',
    description: 'The canonical record of the inspection instruction and requirements.',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'implemented',
    valueType: { kind: 'object' },
    bindings: { domainType: 'InspectionBrief' },
    source: [{ type: 'domain-type', id: 'InspectionBrief' }],
  },
  {
    ...BASE,
    id: 'inspection_brief.instruction',
    kind: 'entity',
    label: 'Instruction',
    description: 'The party, client, reference, and source details of the instruction.',
    parentId: 'inspection_brief',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'implemented',
    valueType: { kind: 'object' },
    bindings: {
      domainType: 'BriefInstruction',
      domainProperty: 'InspectionBrief.instruction',
    },
    source: [{ type: 'domain-type', id: 'BriefInstruction' }],
  },
  {
    ...BASE,
    id: 'field_completion_metadata',
    kind: 'entity',
    label: 'Field completion metadata',
    description: 'Per-field applicability and validity annotations used by completion.',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    valueType: { kind: 'object' },
    completion: 'metadata',
    bindings: {
      domainType: 'FieldCompletionMeta',
      domainProperty: 'InspectionBrief.fieldMeta',
    },
    source: [
      { type: 'domain-type', id: 'FieldCompletionMeta' },
      { type: 'completion-model', id: 'InspectionBrief.fieldMeta' },
    ],
  },
  {
    ...BASE,
    id: 'field_completion_metadata.not_applicable',
    kind: 'attribute',
    label: 'Not applicable',
    description: 'Marks a field as excluded from completion totals.',
    parentId: 'field_completion_metadata',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    valueType: { kind: 'boolean' },
    completion: 'metadata',
    bindings: { domainProperty: 'FieldCompletionMeta.notApplicable' },
    source: [{ type: 'completion-model', id: 'FieldCompletionMeta.notApplicable' }],
  },
  {
    ...BASE,
    id: 'field_completion_metadata.invalid',
    kind: 'attribute',
    label: 'Invalid',
    description: 'Marks a populated field as not acceptable for completion.',
    parentId: 'field_completion_metadata',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    valueType: { kind: 'boolean' },
    completion: 'metadata',
    bindings: { domainProperty: 'FieldCompletionMeta.invalid' },
    source: [{ type: 'completion-model', id: 'FieldCompletionMeta.invalid' }],
  },
];

const ADDRESS_ATTRIBUTES: readonly {
  id: string;
  property: string;
  label: string;
  description: string;
  valueType?: OntologyValueType;
}[] = [
  {
    id: 'formatted_address',
    property: 'formattedAddress',
    label: 'Formatted address',
    description: 'The complete normalized address as a formatted string.',
  },
  { id: 'line_1', property: 'line1', label: 'Address line 1', description: 'The first normalized address line.' },
  { id: 'line_2', property: 'line2', label: 'Address line 2', description: 'The second normalized address line.' },
  { id: 'line_3', property: 'line3', label: 'Address line 3', description: 'The third normalized address line.' },
  { id: 'line_4', property: 'line4', label: 'Address line 4', description: 'The fourth normalized address line.' },
  { id: 'street_number', property: 'streetNumber', label: 'Street number', description: 'The number identifying the property on its street.' },
  { id: 'building_name', property: 'buildingName', label: 'Building name', description: 'The name of the building containing the property.' },
  { id: 'sub_building_name', property: 'subBuildingName', label: 'Sub-building name', description: 'The named flat, unit, or other sub-building.' },
  { id: 'sub_building_number', property: 'subBuildingNumber', label: 'Sub-building number', description: 'The number identifying a flat, unit, or other sub-building.' },
  { id: 'route', property: 'route', label: 'Street', description: 'The street or route on which the property is located.' },
  { id: 'locality', property: 'locality', label: 'Locality', description: 'The locality within the postal address.' },
  { id: 'town_or_city', property: 'townOrCity', label: 'Town or city', description: 'The postal town or city.' },
  { id: 'administrative_area', property: 'administrativeArea', label: 'Administrative area', description: 'The administrative area associated with the address.' },
  { id: 'district', property: 'district', label: 'District', description: 'The district associated with the address.' },
  { id: 'postal_code', property: 'postalCode', label: 'Postcode', description: 'The postal code of the property.' },
  { id: 'country', property: 'country', label: 'Country', description: 'The country of the property.' },
  { id: 'country_code', property: 'countryCode', label: 'Country code', description: 'The normalized country code of the property.' },
  { id: 'latitude', property: 'latitude', label: 'Latitude', description: 'The latitude associated with the normalized property address.', valueType: 'number' },
  { id: 'longitude', property: 'longitude', label: 'Longitude', description: 'The longitude associated with the normalized property address.', valueType: 'number' },
];

const ADDRESS_CONCEPTS: OntologyConcept[] = ADDRESS_ATTRIBUTES.map((attribute) => ({
  ...BASE,
  id: `property.address.${attribute.id}`,
  kind: 'attribute',
  label: attribute.label,
  description: attribute.description,
  parentId: 'property.address',
  canonical: true,
  ownership: 'job-state',
  maturity: 'implemented',
  valueType: {
    kind: attribute.valueType ?? 'text',
    nullable: attribute.property !== 'formattedAddress',
  },
  bindings: {
    domainProperty: `StructuredAddress.${attribute.property}`,
  },
  source: [{ type: 'domain-type', id: `StructuredAddress.${attribute.property}` }],
}));

const DIRECTORY_CONCEPT_IDS: Readonly<Record<string, string>> = {
  prep: 'workflow.preparation',
  'prep/brief': 'workflow.preparation.brief',
  'prep/brief/instr': 'workflow.preparation.brief.instruction',
};

const DIRECTORY_PARENTS: Readonly<Record<string, string | undefined>> = {
  prep: undefined,
  'prep/brief': 'workflow.preparation',
  'prep/brief/instr': 'workflow.preparation.brief',
};

const WORKFLOW_CONCEPTS: OntologyConcept[] = allDirectoryDefinitions()
  .filter((directory) => DIRECTORY_CONCEPT_IDS[directory.pathKey])
  .map((directory) => {
    const aliases = Object.entries(COMMAND_ALIASES)
      .filter(([, canonicalToken]) => canonicalToken === directory.token)
      .map(([alias]) => alias);
    return {
      ...BASE,
      id: DIRECTORY_CONCEPT_IDS[directory.pathKey],
      kind: 'workflow',
      label: directory.label,
      description: directory.description,
      ...(aliases.length > 0 ? { aliases } : {}),
      ...(DIRECTORY_PARENTS[directory.pathKey]
        ? { parentId: DIRECTORY_PARENTS[directory.pathKey] }
        : {}),
      canonical: false,
      ownership: 'workflow',
      maturity: 'implemented',
      bindings: {
        schemaPath: directory.pathKey,
        svyrPath: directory.pathKey,
        svyrToken: directory.token,
      },
      source: [
        { type: 'field-schema', id: directory.pathKey },
        { type: 'command-registry', id: directory.pathKey },
      ],
    };
  });

const FIELD_SEMANTICS: Readonly<
  Record<
    string,
    {
      id: string;
      parentId: string;
      description: string;
    }
  >
> = {
  'instruction.instructingParty': {
    id: 'inspection_brief.instruction.instructing_party',
    parentId: 'inspection_brief.instruction',
    description: 'The person or organisation instructing the survey.',
  },
  'instruction.client': {
    id: 'inspection_brief.instruction.client',
    parentId: 'inspection_brief.instruction',
    description: 'The person or organisation for whom the instruction is undertaken.',
  },
  'instruction.reference': {
    id: 'inspection_brief.instruction.reference',
    parentId: 'inspection_brief.instruction',
    description: 'The reference identifier associated with the instruction.',
  },
  'instruction.source': {
    id: 'inspection_brief.instruction.source',
    parentId: 'inspection_brief.instruction',
    description: 'The channel or source through which the instruction was received.',
  },
  purpose: {
    id: 'inspection_brief.purpose',
    parentId: 'inspection_brief',
    description: 'The intended purpose of the inspection brief.',
  },
  deliverable: {
    id: 'inspection_brief.deliverable',
    parentId: 'inspection_brief',
    description: 'The output required by the inspection brief.',
  },
  limitation: {
    id: 'inspection_brief.limitation',
    parentId: 'inspection_brief',
    description: 'A limitation applying to the inspection brief.',
  },
  'property.type': {
    id: 'property.type',
    parentId: 'property',
    description: 'The canonical dwelling type of the selected property.',
  },
  'property.construction_period': {
    id: 'property.construction_period',
    parentId: 'property',
    description:
      'The approximate construction period of the original dwelling, not an exact year.',
  },
  'property.extension': {
    id: 'property.extension',
    parentId: 'property',
    description:
      'Whether a material extension or addition to the original dwelling is present.',
  },
  'property.conversion': {
    id: 'property.conversion',
    parentId: 'property',
    description:
      'Whether the dwelling shows evidence of a material conversion from its original form or use.',
  },
  'property.energy.mains_services.gas': {
    id: 'property.energy.mains_services.gas',
    parentId: 'property',
    description: 'Canonical mains-gas presence for the selected property.',
  },
  'property.energy.mains_services.electricity': {
    id: 'property.energy.mains_services.electricity',
    parentId: 'property',
    description: 'Canonical mains-electricity presence for the selected property.',
  },
  'property.energy.mains_services.water': {
    id: 'property.energy.mains_services.water',
    parentId: 'property',
    description: 'Canonical mains-water presence for the selected property.',
  },
  'property.energy.mains_services.drainage': {
    id: 'property.energy.mains_services.drainage',
    parentId: 'property',
    description: 'Canonical mains-drainage presence for the selected property.',
  },
  'property.energy.heating.system_type': {
    id: 'property.energy.heating.system_type',
    parentId: 'property',
    description: 'The main heating system type recorded for the property.',
  },
  'property.energy.heating.fuel_source': {
    id: 'property.energy.heating.fuel_source',
    parentId: 'property',
    description: 'The fuel source serving the main heating system.',
  },
  'property.energy.heating.boiler_make_model': {
    id: 'property.energy.heating.boiler_make_model',
    parentId: 'property',
    description: 'The boiler or heater make and model, when known.',
  },
  'property.energy.heating.installation_year': {
    id: 'property.energy.heating.installation_year',
    parentId: 'property',
    description: 'The approximate heating installation year, when known.',
  },
  'property.energy.heating.controls': {
    id: 'property.energy.heating.controls',
    parentId: 'property',
    description: 'The heating controls present at the property.',
  },
  'property.energy.heating.heat_emitters': {
    id: 'property.energy.heating.heat_emitters',
    parentId: 'property',
    description: 'The heat emitters present at the property.',
  },
  'property.energy.heating.hot_water': {
    id: 'property.energy.heating.hot_water',
    parentId: 'property',
    description: 'The hot-water system serving the property.',
  },
  'property.energy.heating.secondary_heating': {
    id: 'property.energy.heating.secondary_heating',
    parentId: 'property',
    description: 'Any secondary heating present at the property.',
  },
  'property.energy.heating.condition': {
    id: 'property.energy.heating.condition',
    parentId: 'property',
    description: 'The recorded condition of the heating installation.',
  },
  'property.energy.heating.defects': {
    id: 'property.energy.heating.defects',
    parentId: 'property',
    description: 'Defects noted on the heating installation.',
  },
};

function aliasesForToken(token: string): string[] {
  return Object.entries(COMMAND_ALIASES)
    .filter(([, canonicalToken]) => canonicalToken === token)
    .map(([alias]) => alias);
}

function maturityForField(field: FieldDefinition): OntologyMaturity {
  return field.operationId ? 'engine-backed' : 'schema-only';
}

const FIELD_CONCEPTS: OntologyConcept[] = [];
const mappedCanonicalFieldIds = new Set<string>();
for (const field of allFieldDefinitions()) {
  // Services presence routes reuse the same canonical field IDs as
  // property/energy/mains-services. Map each field ID once.
  if (mappedCanonicalFieldIds.has(field.fieldId)) continue;
  mappedCanonicalFieldIds.add(field.fieldId);

  const semantic = FIELD_SEMANTICS[field.fieldId];
  if (!semantic) {
    throw new Error(`Missing ontology field semantics: ${field.fieldId}`);
  }
  const aliases = aliasesForToken(field.token);
  FIELD_CONCEPTS.push({
    ...(field.fieldId.startsWith('property.energy.')
      ? V1_1_BASE
      : field.fieldId.startsWith('property.')
        ? V1_2_BASE
        : BASE),
    id: semantic.id,
    kind: 'field',
    label: field.label,
    description: semantic.description,
    ...(aliases.length > 0 ? { aliases } : {}),
    parentId: semantic.parentId,
    canonical: true,
    ownership: 'engine-record',
    maturity: maturityForField(field),
    valueType: {
      kind: field.valueType ?? 'text',
      nullable: true,
      ...(field.options
        ? { options: field.options.map((option) => option.value) }
        : {}),
    },
    completion: field.optional ? 'optional' : 'required',
    bindings: {
      canonicalFieldId: field.fieldId,
      schemaPath: field.pathKey,
      svyrPath: field.pathKey,
      svyrToken: field.token,
      ...(field.operationId ? { setOperationId: field.operationId } : {}),
      ...(field.readOperationId
        ? { readOperationId: field.readOperationId }
        : {}),
    },
    source: [
      { type: 'field-schema', id: field.fieldId },
      { type: 'command-registry', id: field.pathKey },
      ...(field.operationId
        ? [{ type: 'engine-operation' as const, id: field.operationId }]
        : []),
      ...(field.readOperationId
        ? [{ type: 'engine-operation' as const, id: field.readOperationId }]
        : []),
    ],
  });
}

const SOURCE_FIELD = allFieldDefinitions().find(
  (field) => field.fieldId === 'instruction.source',
);

const VALUE_CONCEPTS: OntologyConcept[] = (SOURCE_FIELD?.options ?? []).map(
  (option) => ({
    ...BASE,
    id: `inspection_brief.instruction.source.${option.value}`,
    kind: 'value',
    label: option.label,
    description: `The instruction source value "${option.label}".`,
    parentId: 'inspection_brief.instruction.source',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text' },
    source: [
      {
        type: 'field-schema',
        id: `instruction.source:${option.value}`,
      },
    ],
  }),
);

const INSPECTION_CONCEPTS: OntologyConcept[] = [
  {
    ...V1_1_BASE,
    id: 'inspection',
    kind: 'entity',
    label: 'Inspection',
    description: 'The canonical inspection record for the active surveying job.',
    parentId: 'active_job',
    canonical: true,
    ownership: 'job-state',
    maturity: 'implemented',
    valueType: { kind: 'object' },
    bindings: {
      domainType: 'InspectionRecord',
      domainProperty: 'ActiveJob.inspection',
    },
    source: [{ type: 'domain-type', id: 'InspectionRecord' }],
  },
  {
    ...V1_1_BASE,
    id: 'inspection.finding',
    kind: 'entity',
    label: 'Inspection finding',
    description: 'A canonical observation and its associated inspection assessment.',
    parentId: 'inspection',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'object' },
    bindings: {
      domainType: 'InspectionFinding',
      domainProperty: 'InspectionRecord.findings',
      setOperationId: SURVEY_OPERATIONS.upsertInspectionFinding,
      readOperationId: SURVEY_OPERATIONS.readInspectionFinding,
    },
    source: [
      { type: 'domain-type', id: 'InspectionFinding' },
      {
        type: 'engine-operation',
        id: SURVEY_OPERATIONS.upsertInspectionFinding,
      },
      {
        type: 'engine-operation',
        id: SURVEY_OPERATIONS.readInspectionFinding,
      },
    ],
  },
  {
    ...V1_1_BASE,
    id: 'building_element',
    kind: 'entity',
    label: 'Building element',
    description: 'The subject of an inspection finding.',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'object' },
    bindings: {
      domainType: 'BuildingElementConceptId',
      domainProperty: 'InspectionFinding.elementConceptId',
    },
    source: [{ type: 'domain-type', id: 'BuildingElementConceptId' }],
  },
  {
    ...V1_1_BASE,
    id: 'building_element.external_wall',
    kind: 'value',
    label: 'External wall',
    description: 'An external wall inspected as the subject of a finding.',
    parentId: 'building_element',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text' },
    bindings: { domainProperty: 'InspectionFinding.elementConceptId' },
    source: [
      {
        type: 'domain-type',
        id: 'BuildingElementConceptId:building_element.external_wall',
      },
    ],
  },
  {
    ...V1_2_BASE,
    id: 'building_element.ceiling',
    kind: 'value',
    label: 'Ceiling',
    description: 'A ceiling inspected as the subject of a finding.',
    parentId: 'building_element',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text' },
    bindings: { domainProperty: 'InspectionFinding.elementConceptId' },
    source: [
      { type: 'ontology-review', id: 'canonical-promotion-batch-1' },
      {
        type: 'domain-type',
        id: 'BuildingElementConceptId:building_element.ceiling',
      },
    ],
  },
  {
    ...V1_2_BASE,
    id: 'building_element.chimney',
    kind: 'value',
    label: 'Chimney',
    description: 'A chimney inspected as the subject of a finding.',
    parentId: 'building_element',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text' },
    bindings: { domainProperty: 'InspectionFinding.elementConceptId' },
    source: [
      { type: 'ontology-review', id: 'canonical-promotion-batch-1' },
      {
        type: 'domain-type',
        id: 'BuildingElementConceptId:building_element.chimney',
      },
    ],
  },
  {
    ...V1_2_BASE,
    id: 'building_element.damp_proof_course',
    kind: 'value',
    label: 'Damp proof course',
    description: 'A damp proof course inspected as the subject of a finding.',
    parentId: 'building_element',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    valueType: { kind: 'text' },
    source: [{ type: 'ontology-review', id: 'canonical-promotion-batch-1' }],
  },
  {
    ...V1_2_BASE,
    id: 'building_element.fireplace',
    kind: 'value',
    label: 'Fireplace',
    description: 'A fireplace inspected as the subject of a finding.',
    parentId: 'building_element',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    valueType: { kind: 'text' },
    source: [{ type: 'ontology-review', id: 'canonical-promotion-batch-1' }],
  },
  {
    ...V1_2_BASE,
    id: 'building_element.porch',
    kind: 'value',
    label: 'Porch',
    description: 'A porch inspected as the subject of a finding.',
    parentId: 'building_element',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    valueType: { kind: 'text' },
    source: [{ type: 'ontology-review', id: 'canonical-promotion-batch-1' }],
  },
  {
    ...V1_2_BASE,
    id: 'building_element.rainwater_goods',
    kind: 'value',
    label: 'Rainwater goods',
    description: 'Rainwater goods inspected as the subject of a finding.',
    parentId: 'building_element',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text' },
    bindings: { domainProperty: 'InspectionFinding.elementConceptId' },
    source: [
      { type: 'ontology-review', id: 'canonical-promotion-batch-1' },
      {
        type: 'domain-type',
        id: 'BuildingElementConceptId:building_element.rainwater_goods',
      },
    ],
  },
  {
    ...V1_2_BASE,
    id: 'building_element.staircase',
    kind: 'value',
    label: 'Staircase',
    description: 'A staircase inspected as the subject of a finding.',
    parentId: 'building_element',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    valueType: { kind: 'text' },
    source: [{ type: 'ontology-review', id: 'canonical-promotion-batch-1' }],
  },
  {
    ...V1_2_BASE,
    id: 'building_element.window',
    kind: 'value',
    label: 'Window',
    description: 'A window inspected as the subject of a finding.',
    parentId: 'building_element',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text' },
    bindings: { domainProperty: 'InspectionFinding.elementConceptId' },
    source: [
      { type: 'ontology-review', id: 'canonical-promotion-batch-1' },
      {
        type: 'domain-type',
        id: 'BuildingElementConceptId:building_element.window',
      },
    ],
  },
  {
    ...V1_1_BASE,
    id: 'observation',
    kind: 'field',
    label: 'Observation',
    description: 'What the surveyor directly observed during inspection.',
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text', nullable: false },
    bindings: { domainProperty: 'InspectionFinding.observation' },
    source: [{ type: 'domain-type', id: 'InspectionFinding.observation' }],
  },
  {
    ...V1_1_BASE,
    id: 'condition',
    kind: 'field',
    label: 'Condition',
    description: 'A project-neutral free-text assessment of current condition.',
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text', nullable: true },
    bindings: { domainProperty: 'InspectionFinding.condition' },
    source: [{ type: 'domain-type', id: 'InspectionFinding.condition' }],
  },
  {
    ...V1_1_BASE,
    id: 'defect',
    kind: 'field',
    label: 'Defect',
    description: 'An identified defect or adverse condition associated with a finding.',
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text', nullable: true },
    bindings: { domainProperty: 'InspectionFinding.defect' },
    source: [{ type: 'domain-type', id: 'InspectionFinding.defect' }],
  },
  {
    ...V1_1_BASE,
    id: 'recommendation',
    kind: 'field',
    label: 'Recommendation',
    description: 'The surveyor recommended action arising from a finding.',
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text', nullable: true },
    bindings: { domainProperty: 'InspectionFinding.recommendation' },
    source: [{ type: 'domain-type', id: 'InspectionFinding.recommendation' }],
  },
  {
    ...V1_1_BASE,
    id: 'evidence',
    kind: 'entity',
    label: 'Evidence reference',
    description: 'A stable reference to evidence supporting an inspection finding.',
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'object', nullable: true },
    bindings: {
      domainType: 'InspectionEvidenceReference',
      domainProperty: 'InspectionFinding.evidence',
    },
    source: [
      { type: 'domain-type', id: 'InspectionEvidenceReference' },
      {
        type: 'engine-operation',
        id: SURVEY_OPERATIONS.upsertInspectionFinding,
      },
    ],
  },
  {
    ...V1_2_BASE,
    id: 'cause',
    kind: 'field',
    label: 'Cause',
    description: 'A possible explanation recorded as part of an inspection finding.',
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    valueType: { kind: 'text', nullable: true },
    source: [{ type: 'ontology-review', id: 'canonical-promotion-batch-1' }],
  },
  {
    ...V1_2_BASE,
    id: 'limitation',
    kind: 'field',
    label: 'Limitation',
    description:
      'A finding-scoped limitation affecting inspection or the reliability of that finding. Distinct from inspection-brief limitation and section-level limitation.',
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text', nullable: true },
    bindings: { domainProperty: 'InspectionFinding.limitation' },
    source: [
      { type: 'ontology-review', id: 'canonical-promotion-batch-1' },
      { type: 'domain-type', id: 'InspectionFinding.limitation' },
      {
        type: 'engine-operation',
        id: SURVEY_OPERATIONS.upsertInspectionFinding,
      },
    ],
  },
  {
    ...V1_2_BASE,
    id: 'further_investigation',
    kind: 'field',
    label: 'Further investigation',
    description: 'Advice to undertake further investigation recorded as part of an inspection finding.',
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text', nullable: true },
    bindings: { domainProperty: 'InspectionFinding.furtherInvestigation' },
    source: [
      { type: 'ontology-review', id: 'canonical-promotion-batch-1' },
      { type: 'domain-type', id: 'InspectionFinding.furtherInvestigation' },
      {
        type: 'engine-operation',
        id: SURVEY_OPERATIONS.upsertInspectionFinding,
      },
    ],
  },
  {
    ...V1_2_BASE,
    id: 'implication',
    kind: 'field',
    label: 'Implication',
    description: 'A potential consequence recorded as part of an inspection finding.',
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    valueType: { kind: 'text', nullable: true },
    source: [{ type: 'ontology-review', id: 'canonical-promotion-batch-1' }],
  },
  {
    ...V1_2_BASE,
    id: 'risk',
    kind: 'field',
    label: 'Risk',
    description:
      'A finding-specific risk statement relevant to the observed issue. Not a severity rating.',
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'engine-backed',
    valueType: { kind: 'text', nullable: true },
    bindings: { domainProperty: 'InspectionFinding.risk' },
    source: [
      { type: 'ontology-review', id: 'canonical-promotion-batch-1' },
      { type: 'domain-type', id: 'InspectionFinding.risk' },
      {
        type: 'engine-operation',
        id: SURVEY_OPERATIONS.upsertInspectionFinding,
      },
    ],
  },
  {
    ...V1_2_BASE,
    id: 'significance',
    kind: 'field',
    label: 'Significance',
    description: 'An assessment of significance recorded as part of an inspection finding.',
    parentId: 'inspection.finding',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    valueType: { kind: 'text', nullable: true },
    source: [{ type: 'ontology-review', id: 'canonical-promotion-batch-1' }],
  },
];

const ADJUNCT_AND_REPORT_CONCEPTS: OntologyConcept[] = [
  {
    ...BASE,
    id: 'note',
    kind: 'adjunct',
    label: 'Note',
    description: 'Freeform path-keyed context kept separate from canonical field values.',
    canonical: false,
    ownership: 'adjunct-state',
    maturity: 'adjunct',
    valueType: { kind: 'text' },
    completion: 'excluded',
    source: [{ type: 'notes-contract', id: 'SvyrNotesByPath' }],
  },
  {
    ...BASE,
    id: 'report_document',
    kind: 'publication',
    label: 'Report document',
    description: 'The ordered semantic publication model projected from canonical records.',
    canonical: false,
    ownership: 'report-model',
    maturity: 'implemented',
    valueType: { kind: 'object' },
    bindings: { domainType: 'ReportDocument' },
    source: [{ type: 'report-model', id: 'ReportDocument' }],
  },
  {
    ...BASE,
    id: 'report.identity',
    kind: 'publication',
    label: 'Identity block',
    description: 'The publishable property and instruction identity for a report.',
    parentId: 'report_document',
    canonical: false,
    ownership: 'report-model',
    maturity: 'implemented',
    valueType: { kind: 'object' },
    bindings: { domainType: 'IdentityBlock' },
    source: [{ type: 'report-model', id: 'IdentityBlock' }],
  },
  {
    ...BASE,
    id: 'report.identity.address',
    kind: 'publication',
    label: 'Report address',
    description: 'The publication-safe structured address within the Identity block.',
    parentId: 'report.identity',
    canonical: false,
    ownership: 'report-model',
    maturity: 'implemented',
    valueType: { kind: 'address' },
    bindings: { domainType: 'ReportAddress' },
    source: [{ type: 'report-model', id: 'ReportAddress' }],
  },
  {
    ...V1_1_BASE,
    id: 'report.finding',
    kind: 'publication',
    label: 'Finding block',
    description: 'A derived semantic publication block projected from a canonical finding.',
    parentId: 'report_document',
    canonical: false,
    ownership: 'report-model',
    maturity: 'implemented',
    valueType: { kind: 'object' },
    bindings: { domainType: 'FindingBlock' },
    source: [{ type: 'report-model', id: 'FindingBlock' }],
  },
];

export const MUFFLE_ONTOLOGY_V1: MuffleOntologyV1 = {
  ontologyId: 'muffle-ontology',
  version: '1.2.0',
  concepts: [
    ...DOMAIN_CONCEPTS,
    ...ADDRESS_CONCEPTS,
    ...WORKFLOW_CONCEPTS,
    ...FIELD_CONCEPTS,
    ...VALUE_CONCEPTS,
    ...INSPECTION_CONCEPTS,
    ...ADJUNCT_AND_REPORT_CONCEPTS,
  ],
};

export function getOntologyConcept(
  id: string,
): OntologyConcept | undefined {
  return MUFFLE_ONTOLOGY_V1.concepts.find((concept) => concept.id === id);
}

export function getConceptByCanonicalField(
  fieldId: string,
): OntologyConcept | undefined {
  return MUFFLE_ONTOLOGY_V1.concepts.find(
    (concept) => concept.bindings?.canonicalFieldId === fieldId,
  );
}

export function getConceptBySvyrToken(
  token: string,
): OntologyConcept | undefined {
  const normalized = token.trim().toLowerCase();
  return MUFFLE_ONTOLOGY_V1.concepts.find(
    (concept) => concept.bindings?.svyrToken === normalized,
  );
}

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function findOntologyAliases(text: string): OntologyConcept[] {
  const normalized = normalizeAlias(text);
  return MUFFLE_ONTOLOGY_V1.concepts.filter((concept) =>
    concept.aliases?.some((alias) => normalizeAlias(alias) === normalized),
  );
}

export function serializeMuffleOntologyV1(space = 2): string {
  return JSON.stringify(MUFFLE_ONTOLOGY_V1, null, space);
}
