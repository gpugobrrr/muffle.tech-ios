import {
  CONTROLLED_PRESENCE_STATUS_OPTIONS,
  defineControlledStatusField,
} from '@/lib/controlled-fact';
import type { FieldDefinition, FieldOption } from '@/lib/field-schema';

/** Generic Engine operations for Type 2 enumerations stored on the brief. */
export const SURVEY_SINGLE_CHOICE_SET = 'survey.single_choice.set' as const;
export const SURVEY_SINGLE_CHOICE_READ = 'survey.single_choice.read' as const;

export const PROPERTY_TYPE_FIELD_ID = 'property.type';
export const PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID =
  'property.construction_period';
export const PROPERTY_EXTENSION_FIELD_ID = 'property.extension';
export const PROPERTY_CONVERSION_FIELD_ID = 'property.conversion';

export const PROPERTY_TYPE_VALUES = [
  'detached',
  'semi_detached',
  'terraced',
  'end_terrace',
  'bungalow',
  'flat',
  'maisonette',
  'other',
  'unknown',
] as const;

export type PropertyTypeValue = (typeof PROPERTY_TYPE_VALUES)[number];

export const PROPERTY_TYPE_OPTIONS: readonly FieldOption[] = [
  { value: 'detached', label: 'Detached' },
  { value: 'semi_detached', label: 'Semi-detached' },
  { value: 'terraced', label: 'Terraced' },
  { value: 'end_terrace', label: 'End terrace' },
  { value: 'bungalow', label: 'Bungalow' },
  { value: 'flat', label: 'Flat' },
  { value: 'maisonette', label: 'Maisonette' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
];

export const PROPERTY_CONSTRUCTION_PERIOD_VALUES = [
  'pre_1900',
  '1900_1918',
  '1919_1944',
  '1945_1964',
  '1965_1980',
  '1981_1990',
  '1991_2000',
  '2001_2010',
  '2011_2020',
  '2021_present',
  'unknown',
] as const;

export type PropertyConstructionPeriodValue =
  (typeof PROPERTY_CONSTRUCTION_PERIOD_VALUES)[number];

export const PROPERTY_CONSTRUCTION_PERIOD_OPTIONS: readonly FieldOption[] = [
  { value: 'pre_1900', label: 'Pre-1900' },
  { value: '1900_1918', label: '1900–1918' },
  { value: '1919_1944', label: '1919–1944' },
  { value: '1945_1964', label: '1945–1964' },
  { value: '1965_1980', label: '1965–1980' },
  { value: '1981_1990', label: '1981–1990' },
  { value: '1991_2000', label: '1991–2000' },
  { value: '2001_2010', label: '2001–2010' },
  { value: '2011_2020', label: '2011–2020' },
  { value: '2021_present', label: '2021–present' },
  { value: 'unknown', label: 'Unknown' },
];

function singleChoiceField(
  path: string[],
  token: string,
  label: string,
  description: string,
  fieldId: string,
  options: readonly FieldOption[],
): FieldDefinition {
  return {
    kind: 'field',
    path,
    pathKey: path.join('/'),
    token,
    label,
    description,
    fieldId,
    optional: true,
    valueType: 'singleSelect',
    options: [...options],
    valuePrompt: `ENTER ${label.toUpperCase()}`,
    entryLabel: label.toUpperCase(),
    operationId: SURVEY_SINGLE_CHOICE_SET,
    readOperationId: SURVEY_SINGLE_CHOICE_READ,
    notesEnabled: false,
  };
}

export const PROPERTY_TYPE_FIELD_DEFINITION = singleChoiceField(
  ['property', 'type'],
  'type',
  'Property type',
  'Canonical dwelling type of the selected property.',
  PROPERTY_TYPE_FIELD_ID,
  PROPERTY_TYPE_OPTIONS,
);

export const PROPERTY_CONSTRUCTION_PERIOD_FIELD_DEFINITION = singleChoiceField(
  ['property', 'age'],
  'age',
  'Approximate construction period',
  'Approximate construction period of the original dwelling.',
  PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID,
  PROPERTY_CONSTRUCTION_PERIOD_OPTIONS,
);

export const PROPERTY_EXTENSION_FIELD_DEFINITION = defineControlledStatusField({
  path: ['property', 'extension'],
  token: 'extension',
  label: 'Extension',
  description:
    'Whether a material extension or addition to the original dwelling is present.',
  fieldId: PROPERTY_EXTENSION_FIELD_ID,
  optional: true,
  options: CONTROLLED_PRESENCE_STATUS_OPTIONS,
  valuePrompt: 'ENTER EXTENSION STATUS',
  entryLabel: 'EXTENSION',
});

export const PROPERTY_CONVERSION_FIELD_DEFINITION = defineControlledStatusField({
  path: ['property', 'conversion'],
  token: 'conversion',
  label: 'Conversion',
  description:
    'Whether the dwelling shows evidence of a material conversion from its original form or use.',
  fieldId: PROPERTY_CONVERSION_FIELD_ID,
  optional: true,
  options: CONTROLLED_PRESENCE_STATUS_OPTIONS,
  valuePrompt: 'ENTER CONVERSION STATUS',
  entryLabel: 'CONVERSION',
});

export const PROPERTY_DESCRIPTION_FIELD_DEFINITIONS: readonly FieldDefinition[] = [
  PROPERTY_TYPE_FIELD_DEFINITION,
  PROPERTY_CONSTRUCTION_PERIOD_FIELD_DEFINITION,
  PROPERTY_EXTENSION_FIELD_DEFINITION,
  PROPERTY_CONVERSION_FIELD_DEFINITION,
];

export function isSingleChoiceEngineField(
  field: FieldDefinition | null | undefined,
): field is FieldDefinition & { valueType: 'singleSelect' } {
  return (
    field?.valueType === 'singleSelect' &&
    field.operationId === SURVEY_SINGLE_CHOICE_SET
  );
}
