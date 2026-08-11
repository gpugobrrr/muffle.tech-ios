import type { FindingCaptureConfig } from '@/lib/finding-capture';

export type ServicesFindingRouteId =
  | 'electricity'
  | 'water'
  | 'drainage'
  | 'heating'
  | 'water-heating';

export type ServicesGasFindingRouteId = 'gas';

export type ServicesFindingConfig = FindingCaptureConfig & {
  routeId: ServicesFindingRouteId;
};

export type ServicesGasFindingConfig = FindingCaptureConfig & {
  routeId: ServicesGasFindingRouteId;
};

export const SERVICES_FINDING_CONFIGS: readonly ServicesFindingConfig[] = [
  {
    routeId: 'electricity',
    route: ['services', 'electricity'],
    elementConceptId: 'service_system.electrical_installation',
    findingId: 'finding.service.electrical_installation.1',
    label: 'Electricity',
  },
  {
    routeId: 'water',
    route: ['services', 'water'],
    elementConceptId: 'service_system.water_supply',
    findingId: 'finding.service.water_supply.1',
    label: 'Water',
  },
  {
    routeId: 'drainage',
    route: ['services', 'drainage'],
    elementConceptId: 'service_system.drainage',
    findingId: 'finding.service.drainage.1',
    label: 'Drainage',
  },
  {
    routeId: 'heating',
    route: ['services', 'heating'],
    elementConceptId: 'service_system.heating',
    findingId: 'finding.service.heating.1',
    label: 'Heating',
  },
  {
    routeId: 'water-heating',
    route: ['services', 'water-heating'],
    elementConceptId: 'service_system.hot_water',
    findingId: 'finding.service.hot_water.1',
    label: 'Water heating',
  },
];

export const SERVICES_GAS_FINDING_CONFIG: ServicesGasFindingConfig = {
  routeId: 'gas',
  route: ['services', 'gas-oil', 'gas'],
  elementConceptId: 'service_system.gas_installation',
  findingId: 'finding.service.gas_installation.1',
  label: 'Gas',
};

export function servicesFindingConfig(
  routeId: ServicesFindingRouteId,
): ServicesFindingConfig {
  const config = SERVICES_FINDING_CONFIGS.find((item) => item.routeId === routeId);
  if (!config) {
    throw new Error(`Missing Services finding config: ${routeId}`);
  }
  return config;
}
