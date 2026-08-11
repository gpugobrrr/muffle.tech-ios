import {
  CONTROLLED_PRESENCE_STATUS_OPTIONS,
  defineControlledStatusField,
} from '@/lib/controlled-fact';
import {
  MAINS_SERVICE_FIELD_IDS,
  type MainsServiceId,
} from '@/lib/property-energy-mains-services';

export type ServicesPresenceRouteId = MainsServiceId;

type ServicesPresenceConfig = {
  serviceId: ServicesPresenceRouteId;
  route: readonly string[];
  token: string;
  label: string;
  description: string;
};

export const SERVICES_PRESENCE_CONFIGS: readonly ServicesPresenceConfig[] = [
  {
    serviceId: 'electricity',
    route: ['services', 'electricity', 'presence'],
    token: 'presence',
    label: 'Mains electricity presence',
    description:
      'The same canonical mains-electricity presence fact exposed in the Services section.',
  },
  {
    serviceId: 'water',
    route: ['services', 'water', 'presence'],
    token: 'presence',
    label: 'Mains water presence',
    description:
      'The same canonical mains-water presence fact exposed in the Services section.',
  },
  {
    serviceId: 'drainage',
    route: ['services', 'drainage', 'presence'],
    token: 'presence',
    label: 'Mains drainage presence',
    description:
      'The same canonical mains-drainage presence fact exposed in the Services section.',
  },
  {
    serviceId: 'gas',
    route: ['services', 'gas-oil', 'gas', 'presence'],
    token: 'presence',
    label: 'Mains gas presence',
    description:
      'The canonical mains-gas presence fact exposed under Gas / oil.',
  },
];

export const SERVICES_PRESENCE_ROUTES = Object.fromEntries(
  SERVICES_PRESENCE_CONFIGS.map((config) => [config.serviceId, config.route]),
) as Readonly<Record<ServicesPresenceRouteId, readonly string[]>>;

function buildServicesPresenceFieldDefinition(
  config: ServicesPresenceConfig,
): ReturnType<typeof defineControlledStatusField> {
  const path = [...config.route];
  return defineControlledStatusField({
    path,
    token: config.token,
    label: config.label,
    description: config.description,
    fieldId: MAINS_SERVICE_FIELD_IDS[config.serviceId],
    required: true,
    options: CONTROLLED_PRESENCE_STATUS_OPTIONS,
    valuePrompt: `ENTER ${config.label.toUpperCase()}`,
    entryLabel: config.label.toUpperCase(),
  });
}

/**
 * Navigation aliases for already-canonical mains-service presence facts.
 * These definitions intentionally reuse the property/energy field IDs.
 */
export const SERVICES_PRESENCE_FIELD_DEFINITIONS: readonly ReturnType<
  typeof defineControlledStatusField
>[] = SERVICES_PRESENCE_CONFIGS.map(buildServicesPresenceFieldDefinition);

export function servicesPresenceFieldDefinition(
  serviceId: ServicesPresenceRouteId,
): ReturnType<typeof defineControlledStatusField> {
  const definition = SERVICES_PRESENCE_FIELD_DEFINITIONS.find(
    (field) => field.fieldId === MAINS_SERVICE_FIELD_IDS[serviceId],
  );
  if (!definition) {
    throw new Error(`Missing Services presence field: ${serviceId}`);
  }
  return definition;
}

export function servicesPresenceBranchPath(
  serviceId: Exclude<ServicesPresenceRouteId, 'gas'>,
): string[] {
  return SERVICES_PRESENCE_ROUTES[serviceId].slice(0, -1);
}

export function servicesGasBranchPath(): string[] {
  return [...SERVICES_PRESENCE_ROUTES.gas.slice(0, -1)];
}
