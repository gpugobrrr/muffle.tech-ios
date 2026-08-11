import {
  CONTROLLED_PRESENCE_STATUS_OPTIONS,
  defineControlledStatusField,
} from '@/lib/controlled-fact';

/** Canonical field IDs for mains-service presence facts. */
export const MAINS_SERVICE_IDS = [
  'gas',
  'electricity',
  'water',
  'drainage',
] as const;

export type MainsServiceId = (typeof MAINS_SERVICE_IDS)[number];

export const MAINS_SERVICE_FIELD_IDS: Readonly<Record<MainsServiceId, string>> =
  {
    gas: 'property.energy.mains_services.gas',
    electricity: 'property.energy.mains_services.electricity',
    water: 'property.energy.mains_services.water',
    drainage: 'property.energy.mains_services.drainage',
  };

export const MAINS_SERVICES_COMPOUND_PATH = [
  'property',
  'energy',
  'mains-services',
] as const;

export function mainsServiceFieldPath(serviceId: MainsServiceId): string[] {
  return [...MAINS_SERVICES_COMPOUND_PATH, serviceId];
}

export function buildMainsServiceFieldDefinition(
  serviceId: MainsServiceId,
  label: string,
): ReturnType<typeof defineControlledStatusField> {
  const path = mainsServiceFieldPath(serviceId);
  return defineControlledStatusField({
    path,
    token: serviceId,
    label,
    description: `Mains ${label.toLowerCase()} service presence.`,
    fieldId: MAINS_SERVICE_FIELD_IDS[serviceId],
    required: true,
    options: CONTROLLED_PRESENCE_STATUS_OPTIONS,
    valuePrompt: `ENTER ${label.toUpperCase()} STATUS`,
    entryLabel: label.toUpperCase(),
  });
}

export const MAINS_SERVICE_FIELD_DEFINITIONS: readonly ReturnType<
  typeof defineControlledStatusField
>[] = MAINS_SERVICE_IDS.map((serviceId) =>
  buildMainsServiceFieldDefinition(
    serviceId,
    serviceId === 'gas'
      ? 'Gas'
      : serviceId === 'electricity'
        ? 'Electricity'
        : serviceId === 'water'
          ? 'Water'
          : 'Drainage',
  ),
);
