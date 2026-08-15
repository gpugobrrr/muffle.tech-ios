import { CONTROLLED_PRESENCE_STATUS_OPTIONS } from '@/lib/controlled-fact';
import type { FieldDefinition } from '@/lib/field-schema';

export type ServiceId = 'gas' | 'electricity' | 'water' | 'drainage';

export interface ServicePresenceCatalogRow {
  readonly serviceId: ServiceId;
  readonly fieldId: string;
  readonly baseLabel: string;
  readonly route: readonly string[];
  readonly aliasLabel: string;
  readonly aliasDescription: string;
}

export const SERVICE_PRESENCE_CATALOG: readonly ServicePresenceCatalogRow[] = [
  {
    serviceId: 'gas',
    fieldId: 'property.energy.mains_services.gas',
    baseLabel: 'Gas',
    route: ['services', 'gas-oil', 'gas', 'presence'],
    aliasLabel: 'Mains gas presence',
    aliasDescription: 'The canonical mains-gas presence fact exposed under Gas / oil.',
  },
  {
    serviceId: 'electricity',
    fieldId: 'property.energy.mains_services.electricity',
    baseLabel: 'Electricity',
    route: ['services', 'electricity', 'presence'],
    aliasLabel: 'Mains electricity presence',
    aliasDescription: 'The same canonical mains-electricity presence fact exposed in the Services section.',
  },
  {
    serviceId: 'water',
    fieldId: 'property.energy.mains_services.water',
    baseLabel: 'Water',
    route: ['services', 'water', 'presence'],
    aliasLabel: 'Mains water presence',
    aliasDescription: 'The same canonical mains-water presence fact exposed in the Services section.',
  },
  {
    serviceId: 'drainage',
    fieldId: 'property.energy.mains_services.drainage',
    baseLabel: 'Drainage',
    route: ['services', 'drainage', 'presence'],
    aliasLabel: 'Mains drainage presence',
    aliasDescription: 'The same canonical mains-drainage presence fact exposed in the Services section.',
  },
];

export interface FieldDefinitionFactoryParams {
  readonly path: readonly string[];
  readonly token: string;
  readonly label: string;
  readonly description: string;
  readonly fieldId: string;
  readonly valuePrompt: string;
}

export function buildPresenceFieldDefinition(
  params: FieldDefinitionFactoryParams,
): FieldDefinition {
  return {
    kind: 'field',
    path: [...params.path],
    pathKey: params.path.join('/'),
    token: params.token,
    label: params.label,
    description: params.description,
    fieldId: params.fieldId,
    required: true,
    valueType: 'controlledStatus',
    options: [...CONTROLLED_PRESENCE_STATUS_OPTIONS],
    valuePrompt: params.valuePrompt,
    entryLabel: params.label.toUpperCase(),
    operationId: 'survey.controlled_fact.set',
    readOperationId: 'survey.controlled_fact.read',
    notesEnabled: false,
  };
}
