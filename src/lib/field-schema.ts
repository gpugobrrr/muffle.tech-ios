import type { InspectionBrief } from '@/types/workspace';

export type FieldOption = {
  value: string;
  label: string;
};

export type FieldValueType = 'text' | 'singleSelect';

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
    notesEnabled: false,
  },
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

export function findFieldDefinitionForOperationId(
  operationId: string,
): FieldDefinition | null {
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
      const normalizedValue = option.value.toLowerCase();
      const normalizedLabel = option.label.toLowerCase();
      return normalizedInput === normalizedValue || normalizedInput === normalizedLabel;
    });
    return matchedOption?.value ?? trimmed;
  }

  return trimmed;
}

export function resolveFieldValue(
  brief: InspectionBrief,
  fieldId: string,
): string | null {
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

export function applyFieldValue(
  brief: InspectionBrief,
  fieldId: string,
  value: string,
): InspectionBrief {
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
