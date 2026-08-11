import type { FieldDefinition } from '@/lib/field-schema';

const SET_OP = 'survey.controlled_fact.set';
const SET_READ = 'survey.controlled_fact.read';
const SET_MULTI_OP = 'survey.controlled_fact_set.set';
const SET_MULTI_READ = 'survey.controlled_fact_set.read';

export const HEATING_COMPOUND_PATH = [
  'property',
  'energy',
  'heating',
] as const;

export type HeatingFieldToken =
  | 'system-type'
  | 'fuel-source'
  | 'boiler-make-model'
  | 'installation-year'
  | 'controls'
  | 'heat-emitters'
  | 'hot-water'
  | 'secondary-heating'
  | 'condition'
  | 'defects';

function heatingPath(token: HeatingFieldToken): string[] {
  return [...HEATING_COMPOUND_PATH, token];
}

function scalarField(
  token: HeatingFieldToken,
  label: string,
  fieldId: string,
  config: Pick<FieldDefinition, 'valueType' | 'options' | 'numeric' | 'required' | 'optional'>,
): FieldDefinition {
  return {
    kind: 'field',
    path: heatingPath(token),
    pathKey: heatingPath(token).join('/'),
    token,
    label,
    description: `${label} for the property heating installation.`,
    fieldId,
    valuePrompt: `ENTER ${label.toUpperCase()}`,
    entryLabel: label.toUpperCase(),
    operationId: SET_OP,
    readOperationId: SET_READ,
    notesEnabled: false,
    ...config,
  };
}

export const HEATING_FIELD_DEFINITIONS: readonly FieldDefinition[] = [
  scalarField('system-type', 'Main heating system', 'property.energy.heating.system_type', {
    required: true,
    valueType: 'singleSelect',
    options: [
      { value: 'gas_boiler', label: 'Gas boiler' },
      { value: 'oil_boiler', label: 'Oil boiler' },
      { value: 'lpg_boiler', label: 'LPG boiler' },
      { value: 'electric_boiler', label: 'Electric boiler' },
      { value: 'air_source_heat_pump', label: 'Air source heat pump' },
      { value: 'ground_source_heat_pump', label: 'Ground source heat pump' },
      { value: 'storage_heaters', label: 'Storage heaters' },
      { value: 'warm_air', label: 'Warm air' },
      { value: 'district_heating', label: 'District / communal' },
      { value: 'solid_fuel', label: 'Solid fuel' },
      { value: 'none', label: 'None' },
      { value: 'unknown', label: 'Unknown' },
    ],
  }),
  scalarField('fuel-source', 'Fuel source', 'property.energy.heating.fuel_source', {
    required: true,
    valueType: 'singleSelect',
    options: [
      { value: 'mains_gas', label: 'Mains gas' },
      { value: 'lpg', label: 'LPG' },
      { value: 'oil', label: 'Oil' },
      { value: 'electricity', label: 'Electricity' },
      { value: 'solid_fuel', label: 'Solid fuel' },
      { value: 'biomass', label: 'Biomass' },
      { value: 'other', label: 'Other' },
      { value: 'not_applicable', label: 'Not applicable' },
      { value: 'unknown', label: 'Unknown' },
    ],
  }),
  scalarField(
    'boiler-make-model',
    'Boiler / heater make & model',
    'property.energy.heating.boiler_make_model',
    {
      optional: true,
      valueType: 'text',
    },
  ),
  scalarField(
    'installation-year',
    'Approximate installation year',
    'property.energy.heating.installation_year',
    {
      optional: true,
      valueType: 'number',
      numeric: {
        integer: true,
        min: 1900,
        max: 2100,
      },
    },
  ),
  scalarField('controls', 'Heating controls', 'property.energy.heating.controls', {
    optional: true,
    valueType: 'singleSelect',
    options: [
      { value: 'programmer_and_thermostat', label: 'Programmer and room thermostat' },
      { value: 'room_thermostat', label: 'Room thermostat only' },
      { value: 'trvs', label: 'TRVs on radiators' },
      { value: 'smart_controls', label: 'Smart controls' },
      { value: 'basic', label: 'Basic / limited' },
      { value: 'none', label: 'None' },
      { value: 'unknown', label: 'Unknown' },
    ],
  }),
  {
    kind: 'field',
    path: heatingPath('heat-emitters'),
    pathKey: heatingPath('heat-emitters').join('/'),
    token: 'heat-emitters',
    label: 'Heat emitters',
    description: 'Heat emitters present in the property.',
    fieldId: 'property.energy.heating.heat_emitters',
    optional: true,
    valueType: 'multiSelect',
    options: [
      { value: 'radiators', label: 'Radiators' },
      { value: 'underfloor', label: 'Underfloor heating' },
      { value: 'warm_air', label: 'Warm air' },
      { value: 'storage_heaters', label: 'Storage heaters' },
      { value: 'other', label: 'Other' },
    ],
    operationId: SET_MULTI_OP,
    readOperationId: SET_MULTI_READ,
    notesEnabled: false,
  },
  scalarField('hot-water', 'Hot water system', 'property.energy.heating.hot_water', {
    optional: true,
    valueType: 'singleSelect',
    options: [
      { value: 'from_main_boiler', label: 'From main boiler' },
      { value: 'separate_boiler', label: 'Separate boiler' },
      { value: 'immersion', label: 'Immersion heater' },
      { value: 'combi', label: 'Combi boiler' },
      { value: 'instant_electric', label: 'Instant electric' },
      { value: 'none', label: 'None' },
      { value: 'unknown', label: 'Unknown' },
    ],
  }),
  scalarField(
    'secondary-heating',
    'Secondary heating',
    'property.energy.heating.secondary_heating',
    {
      optional: true,
      valueType: 'singleSelect',
      options: [
        { value: 'none', label: 'None' },
        { value: 'open_fire', label: 'Open fire' },
        { value: 'stove', label: 'Stove' },
        { value: 'portable_heaters', label: 'Portable heaters' },
        { value: 'other', label: 'Other' },
        { value: 'unknown', label: 'Unknown' },
      ],
    },
  ),
  scalarField('condition', 'Condition', 'property.energy.heating.condition', {
    optional: true,
    valueType: 'singleSelect',
    options: [
      { value: 'satisfactory', label: 'Satisfactory' },
      { value: 'fair', label: 'Fair' },
      { value: 'poor', label: 'Poor' },
      { value: 'not_inspected', label: 'Not inspected' },
      { value: 'unknown', label: 'Unknown' },
    ],
  }),
  scalarField('defects', 'Defects', 'property.energy.heating.defects', {
    optional: true,
    valueType: 'text',
  }),
];

export const HEATING_NOTES_PATH = HEATING_COMPOUND_PATH.join('/');
