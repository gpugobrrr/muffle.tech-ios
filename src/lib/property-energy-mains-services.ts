import type { FieldDefinition } from '@/lib/field-schema';
import {
  SERVICE_PRESENCE_CATALOG,
  buildPresenceFieldDefinition,
  type ServiceId,
} from '@/lib/service-presence-schema';

/** Canonical field IDs for mains-service presence facts. */
export const MAINS_SERVICE_IDS: readonly ServiceId[] =
  SERVICE_PRESENCE_CATALOG.map((row) => row.serviceId);

export type MainsServiceId = ServiceId;

export const MAINS_SERVICE_FIELD_IDS: Readonly<Record<MainsServiceId, string>> =
  Object.fromEntries(
    SERVICE_PRESENCE_CATALOG.map((row) => [row.serviceId, row.fieldId])
  ) as Record<MainsServiceId, string>;

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
): FieldDefinition {
  const row = SERVICE_PRESENCE_CATALOG.find((r) => r.serviceId === serviceId);
  if (!row) {
    throw new Error(`Missing catalog row for serviceId: ${serviceId}`);
  }
  return buildPresenceFieldDefinition({
    path: mainsServiceFieldPath(serviceId),
    token: serviceId,
    label,
    description: `Mains ${label.toLowerCase()} service presence.`,
    fieldId: row.fieldId,
    valuePrompt: `ENTER ${label.toUpperCase()} STATUS`,
  });
}

export const MAINS_SERVICE_FIELD_DEFINITIONS: readonly FieldDefinition[] =
  MAINS_SERVICE_IDS.map((serviceId) => {
    const row = SERVICE_PRESENCE_CATALOG.find((r) => r.serviceId === serviceId)!;
    return buildMainsServiceFieldDefinition(serviceId, row.baseLabel);
  });
