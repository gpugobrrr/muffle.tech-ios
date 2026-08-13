import {
  isControlledScalarField,
  normalizeControlledFactScalarInput,
} from '@/lib/controlled-fact';
import type { NumericFieldConstraints } from '@/lib/numeric-field';
import { normalizeNumericFieldInput } from '@/lib/numeric-field';
import { HEATING_FIELD_DEFINITIONS } from '@/lib/property-energy-heating';
import { MAINS_SERVICE_FIELD_DEFINITIONS } from '@/lib/property-energy-mains-services';
import {
  PROPERTY_DESCRIPTION_FIELD_DEFINITIONS,
  isSingleChoiceEngineField,
} from '@/lib/property-description';
import { SERVICES_PRESENCE_FIELD_DEFINITIONS } from '@/lib/services-controlled-facts';
import type { InspectionBrief } from '@/types/workspace';
export type FieldOption = {
  value: string;
  label: string;
  available?: boolean;
};

/**
 * Capture value kinds declared by the field schema.
 * `multiSelect` is a schema/UI contract only until Engine operations accept
 * set-valued payloads — do not encode sets as scalar text.
 * `number` is a validated scalar numeric string stored in the Engine as text.
 * Structured measurements (`{ value, unit }`) are intentionally unsupported —
 * do not encode them as `"4.2 m"` or JSON-in-string.
 */
export type FieldValueType =
  | 'text'
  | 'singleSelect'
  | 'multiSelect'
  | 'number'
  | 'controlledStatus';
export type FieldDefinition = {
  kind: 'field';
  path: string[];
  pathKey: string;
  token: string;
  label: string;
  description: string;
  fieldId: string;
  required?: boolean;
  optional?: boolean;
  valueType?: FieldValueType;
  options?: FieldOption[];
  /** Constraints for `valueType: 'number'` only. */
  numeric?: NumericFieldConstraints;
  valuePrompt?: string;
  entryLabel?: string;
  valuePlaceholder?: string;
  operationId?: string;
  readOperationId?: string;
  notesEnabled?: boolean;
};

export type DirectoryDefinition = {
  kind: 'directory';
  path: string[];
  pathKey: string;
  token: string;
  label: string;
  description: string;
};

export type SchemaNodeDefinition = FieldDefinition | DirectoryDefinition;

function normalizePath(path: string[] | string): string[] {
  if (typeof path === 'string') {
    return path
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);
  }

  return path.map((segment) => segment.trim()).filter(Boolean);
}

function pathKeyForSegments(path: string[] | string): string {
  return normalizePath(path).join('/');
}

const DIRECTORY_DEFINITIONS: DirectoryDefinition[] = [
  {
    kind: 'directory',
    path: ['prep'],
    pathKey: 'prep',
    token: 'prep',
    label: 'Preparation',
    description: 'Inspection preparation commands.',
  },
  {
    kind: 'directory',
    path: ['prep', 'brief'],
    pathKey: 'prep/brief',
    token: 'brief',
    label: 'Brief',
    description: 'Inspection brief and scope information.',
  },
  {
    kind: 'directory',
    path: ['prep', 'brief', 'instr'],
    pathKey: 'prep/brief/instr',
    token: 'instr',
    label: 'Instruction',
    description: 'Instruction details described in the brief.',
  },
  {
    kind: 'directory',
    path: ['property'],
    pathKey: 'property',
    token: 'property',
    label: 'Property',
    description: 'Property identity and description coverage.',
  },
  {
    kind: 'directory',
    path: ['property', 'energy'],
    pathKey: 'property/energy',
    token: 'energy',
    label: 'Energy',
    description: 'EPC, mains service and energy-source coverage.',
  },
  {
    kind: 'directory',
    path: ['property', 'energy', 'mains-services'],
    pathKey: 'property/energy/mains-services',
    token: 'mains-services',
    label: 'Mains services',
    description: 'Mains service presence coverage.',
  },
  {
    kind: 'directory',
    path: ['property', 'energy', 'heating'],
    pathKey: 'property/energy/heating',
    token: 'heating',
    label: 'Heating',
    description: 'Central heating and energy-source coverage.',
  },
  {
    kind: 'directory',
    path: ['services'],
    pathKey: 'services',
    token: 'services',
    label: 'Services',
    description: 'Visible services inspection coverage; no specialist testing.',
  },
  {
    kind: 'directory',
    path: ['services', 'electricity'],
    pathKey: 'services/electricity',
    token: 'electricity',
    label: 'Electricity',
    description: 'Mains electricity presence and inspection findings.',
  },
  {
    kind: 'directory',
    path: ['services', 'water'],
    pathKey: 'services/water',
    token: 'water',
    label: 'Water',
    description: 'Mains water presence and inspection findings.',
  },
  {
    kind: 'directory',
    path: ['services', 'drainage'],
    pathKey: 'services/drainage',
    token: 'drainage',
    label: 'Drainage',
    description: 'Mains drainage presence and inspection findings.',
  },
  {
    kind: 'directory',
    path: ['services', 'gas-oil'],
    pathKey: 'services/gas-oil',
    token: 'gas-oil',
    label: 'Gas / oil',
    description: 'Gas and oil installation coverage.',
  },
  {
    kind: 'directory',
    path: ['services', 'gas-oil', 'gas'],
    pathKey: 'services/gas-oil/gas',
    token: 'gas',
    label: 'Gas',
    description: 'Mains gas presence and installation findings.',
  },
];

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    kind: 'field',
    path: ['prep', 'brief', 'instr', 'party'],
    pathKey: 'prep/brief/instr/party',
    token: 'party',
    label: 'Instructing party',
    description: 'Set the instructing party name.',
    fieldId: 'instruction.instructingParty',
    required: true,
    valuePrompt: 'ENTER INSTRUCTING PARTY',
    entryLabel: 'INSTRUCTING PARTY',
    valuePlaceholder: 'Enter name',
    operationId: 'survey.brief.instruction.party.set',
    readOperationId: 'survey.brief.instruction.party.read',
    notesEnabled: false,
  },
  {
    kind: 'field',
    path: ['prep', 'brief', 'instr', 'client'],
    pathKey: 'prep/brief/instr/client',
    token: 'client',
    label: 'Client',
    description: 'Set the client name.',
    fieldId: 'instruction.client',
    optional: true,
    valuePrompt: 'ENTER CLIENT',
    entryLabel: 'CLIENT',
    valuePlaceholder: 'Enter name',
    operationId: 'survey.brief.instruction.client.set',
    readOperationId: 'survey.brief.instruction.client.read',
    notesEnabled: false,
  },
  {
    kind: 'field',
    path: ['prep', 'brief', 'instr', 'ref'],
    pathKey: 'prep/brief/instr/ref',
    token: 'ref',
    label: 'Instruction reference',
    description: 'Set the instruction reference.',
    fieldId: 'instruction.reference',
    optional: true,
    valuePrompt: 'ENTER INSTRUCTION REFERENCE',
    entryLabel: 'INSTRUCTION REFERENCE',
    valuePlaceholder: 'Enter reference',
    operationId: 'survey.brief.instruction.reference.set',
    readOperationId: 'survey.brief.instruction.reference.read',
    notesEnabled: false,
  },
  {
    kind: 'field',
    path: ['prep', 'brief', 'instr', 'source'],
    pathKey: 'prep/brief/instr/source',
    token: 'source',
    label: 'Source',
    description: 'Record the instruction source.',
    fieldId: 'instruction.source',
    required: true,
    valueType: 'singleSelect',
    options: [
      { value: 'email', label: 'Email' },
      { value: 'portal', label: 'Client portal' },
      { value: 'phone', label: 'Telephone' },
      { value: 'letter', label: 'Letter' },
      { value: 'internal', label: 'Internal referral' },
      { value: 'other', label: 'Other' },
    ],
    valuePrompt: 'ENTER SOURCE',
    entryLabel: 'SOURCE',
    valuePlaceholder: 'Enter source',
    operationId: 'survey.brief.instruction.source.set',
    readOperationId: 'survey.brief.instruction.source.read',
    notesEnabled: false,
  },
  {
    kind: 'field',
    path: ['prep', 'brief', 'purp'],
    pathKey: 'prep/brief/purp',
    token: 'purp',
    label: 'Purpose',
    description: 'Record the inspection purpose.',
    fieldId: 'purpose',
    required: true,
    valuePrompt: 'ENTER PURPOSE',
    entryLabel: 'PURPOSE',
    valuePlaceholder: 'Enter purpose',
    operationId: 'survey.brief.purpose.set',
    readOperationId: 'survey.brief.purpose.read',
    notesEnabled: false,
  },
  {
    kind: 'field',
    path: ['prep', 'brief', 'deliv'],
    pathKey: 'prep/brief/deliv',
    token: 'deliv',
    label: 'Deliverables',
    description: 'Record the deliverables.',
    fieldId: 'deliverable',
    required: true,
    valuePrompt: 'ENTER DELIVERABLE',
    entryLabel: 'DELIVERABLE',
    valuePlaceholder: 'Enter deliverable',
    operationId: 'survey.brief.deliverable.set',
    readOperationId: 'survey.brief.deliverable.read',
    notesEnabled: false,
  },
  {
    kind: 'field',
    path: ['prep', 'brief', 'limit'],
    pathKey: 'prep/brief/limit',
    token: 'limit',
    label: 'Limitations',
    description: 'Record the limitations.',
    fieldId: 'limitation',
    required: true,
    valuePrompt: 'ENTER LIMITATION',
    entryLabel: 'LIMITATION',
    valuePlaceholder: 'Enter limitation',
    operationId: 'survey.brief.limitation.set',
    readOperationId: 'survey.brief.limitation.read',
    notesEnabled: false,
  },
  ...PROPERTY_DESCRIPTION_FIELD_DEFINITIONS,
  ...MAINS_SERVICE_FIELD_DEFINITIONS,
  ...HEATING_FIELD_DEFINITIONS,
  ...SERVICES_PRESENCE_FIELD_DEFINITIONS,
];

const ALL_DEFINITIONS: SchemaNodeDefinition[] = [
  ...DIRECTORY_DEFINITIONS,
  ...FIELD_DEFINITIONS,
];

/** Read-only schema inventory for development contracts and semantic export. */
export function allDirectoryDefinitions(): readonly DirectoryDefinition[] {
  return DIRECTORY_DEFINITIONS;
}

/** Read-only field inventory for development contracts and semantic export. */
export function allFieldDefinitions(): readonly FieldDefinition[] {
  return FIELD_DEFINITIONS;
}

export function toSchemaPath(path: string[] | string): string {
  return pathKeyForSegments(path);
}

export function findDirectoryDefinition(
  path: string[] | string,
): DirectoryDefinition | null {
  const normalizedPath = pathKeyForSegments(path);
  return (
    DIRECTORY_DEFINITIONS.find(
      (definition) => definition.pathKey === normalizedPath,
    ) ?? null
  );
}

export function findFieldDefinition(
  path: string[] | string,
): FieldDefinition | null {
  const normalizedPath = pathKeyForSegments(path);
  return (
    FIELD_DEFINITIONS.find(
      (definition) => definition.pathKey === normalizedPath,
    ) ?? null
  );
}

export function findFieldDefinitionByFieldId(
  fieldId: string,
): FieldDefinition | null {
  return (
    FIELD_DEFINITIONS.find((definition) => definition.fieldId === fieldId) ??
    null
  );
}

export function findFieldDefinitionForOperationId(
  operationId: string,
): FieldDefinition | null {
  if (
    operationId === 'survey.controlled_fact.set' ||
    operationId === 'survey.controlled_fact.read' ||
    operationId === 'survey.controlled_fact_set.set' ||
    operationId === 'survey.controlled_fact_set.read' ||
    operationId === 'survey.single_choice.set' ||
    operationId === 'survey.single_choice.read'
  ) {
    return null;
  }

  return (
    FIELD_DEFINITIONS.find(
      (definition) =>
        definition.operationId === operationId ||
        definition.readOperationId === operationId,
    ) ?? null
  );
}

export function childSchemaDefinitions(
  path: string[] | string,
): SchemaNodeDefinition[] {
  const normalizedPath = normalizePath(path);
  return ALL_DEFINITIONS.filter((definition) => {
    if (definition.path.length !== normalizedPath.length + 1) {
      return false;
    }
    return definition.path
      .slice(0, normalizedPath.length)
      .every((segment, index) => segment === normalizedPath[index]);
  });
}

export function normalizeFieldInputValue(
  field: FieldDefinition | null,
  input: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!field) return trimmed;

  if (field.valueType === 'singleSelect') {
    const normalizedInput = trimmed.toLowerCase().replace(/\s+/g, ' ');
    const matchedOption = field.options?.find((option) => {
      if (option.available === false) return false;
      const normalizedValue = option.value.toLowerCase();
      const normalizedLabel = option.label.toLowerCase();
      return normalizedInput === normalizedValue || normalizedInput === normalizedLabel;
    });
    return matchedOption?.value ?? null;
  }

  if (field.valueType === 'number') {
    return normalizeNumericFieldInput(field, trimmed);
  }

  if (field.valueType === 'controlledStatus') {
    return normalizeControlledFactScalarInput(field, trimmed);
  }

  if (field.valueType === 'multiSelect') {
    // Multi-choice commits use prepareMultiChoiceCommit — never scalar text.
    return null;
  }

  return trimmed;
}

export function resolveFieldValue(
  brief: InspectionBrief,
  fieldId: string,
): string | null {
  const controlledValue = brief.controlledFacts?.[fieldId];
  if (controlledValue !== undefined) {
    return controlledValue;
  }

  switch (fieldId) {
    case 'instruction.instructingParty':
      return brief.instruction.instructingParty;
    case 'instruction.client':
      return brief.instruction.client;
    case 'instruction.reference':
      return brief.instruction.reference;
    case 'instruction.source':
      return brief.instruction.source;
    case 'purpose':
      return brief.purpose;
    case 'deliverable':
      return brief.deliverable;
    case 'limitation':
      return brief.limitation;
    default:
      return null;
  }
}

export function resolveFieldSetValue(
  brief: InspectionBrief,
  fieldId: string,
): readonly string[] {
  return brief.controlledFactSets?.[fieldId] ?? [];
}

export function applyFieldValue(
  brief: InspectionBrief,
  fieldId: string,
  value: string,
): InspectionBrief {
  const fieldDefinition = findFieldDefinitionByFieldId(fieldId);
  if (
    isControlledScalarField(fieldDefinition) ||
    isSingleChoiceEngineField(fieldDefinition)
  ) {
    return {
      ...brief,
      controlledFacts: {
        ...(brief.controlledFacts ?? {}),
        [fieldId]: value,
      },
    };
  }

  switch (fieldId) {
    case 'instruction.instructingParty':
      return {
        ...brief,
        instruction: {
          ...brief.instruction,
          instructingParty: value,
        },
      };
    case 'instruction.client':
      return {
        ...brief,
        instruction: {
          ...brief.instruction,
          client: value,
        },
      };
    case 'instruction.reference':
      return {
        ...brief,
        instruction: {
          ...brief.instruction,
          reference: value,
        },
      };
    case 'instruction.source':
      return {
        ...brief,
        instruction: {
          ...brief.instruction,
          source: value,
        },
      };
    case 'purpose':
      return {
        ...brief,
        purpose: value,
      };
    case 'deliverable':
      return {
        ...brief,
        deliverable: value,
      };
    case 'limitation':
      return {
        ...brief,
        limitation: value,
      };
    default:
      return brief;
  }
}

export function applyFieldSetValue(
  brief: InspectionBrief,
  fieldId: string,
  values: readonly string[],
): InspectionBrief {
  const fieldDefinition = findFieldDefinitionByFieldId(fieldId);
  if (fieldDefinition?.valueType !== 'multiSelect') {
    return brief;
  }

  return {
    ...brief,
    controlledFactSets: {
      ...(brief.controlledFactSets ?? {}),
      [fieldId]: [...values],
    },
  };
}
