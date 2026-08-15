import type { FieldDefinition } from '@/lib/field-schema';
import {
  MAINS_SERVICE_FIELD_IDS,
  type MainsServiceId,
} from '@/lib/property-energy-mains-services';
import {
  SERVICE_PRESENCE_CATALOG,
  buildPresenceFieldDefinition,
} from '@/lib/service-presence-schema';

export type ServicesPresenceRouteId = MainsServiceId;

export type ServicesPresenceConfig = {
  serviceId: ServicesPresenceRouteId;
  route: readonly string[];
  token: string;
  label: string;
  description: string;
};

const PREFERRED_SERVICES_ORDER: readonly ServicesPresenceRouteId[] = [
  'electricity',
  'water',
  'drainage',
  'gas',
];

export const SERVICES_PRESENCE_CONFIGS: readonly ServicesPresenceConfig[] =
  PREFERRED_SERVICES_ORDER.map((serviceId) => {
    const row = SERVICE_PRESENCE_CATALOG.find((r) => r.serviceId === serviceId);
    if (!row) {
      throw new Error(`Missing catalog row for serviceId: ${serviceId}`);
    }
    return {
      serviceId: row.serviceId,
      route: row.route,
      token: 'presence',
      label: row.aliasLabel,
      description: row.aliasDescription,
    };
  });

export const SERVICES_PRESENCE_ROUTES = Object.fromEntries(
  SERVICES_PRESENCE_CONFIGS.map((config) => [config.serviceId, config.route]),
) as Readonly<Record<ServicesPresenceRouteId, readonly string[]>>;

function buildServicesPresenceFieldDefinition(
  config: ServicesPresenceConfig,
): FieldDefinition {
  return buildPresenceFieldDefinition({
    path: config.route,
    token: config.token,
    label: config.label,
    description: config.description,
    fieldId: MAINS_SERVICE_FIELD_IDS[config.serviceId],
    valuePrompt: `ENTER ${config.label.toUpperCase()}`,
  });
}

/**
 * Navigation aliases for already-canonical mains-service presence facts.
 * These definitions intentionally reuse the property/energy field IDs.
 */
export const SERVICES_PRESENCE_FIELD_DEFINITIONS: readonly FieldDefinition[] =
  SERVICES_PRESENCE_CONFIGS.map(buildServicesPresenceFieldDefinition);

export function servicesPresenceFieldDefinition(
  serviceId: ServicesPresenceRouteId,
): FieldDefinition {
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
