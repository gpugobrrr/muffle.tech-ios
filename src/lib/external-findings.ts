import type { FindingCaptureConfig } from '@/lib/finding-capture';

export type ExternalFindingRouteId = 'walls' | 'chimney' | 'rainwater' | 'windows';

export type ExternalFindingConfig = FindingCaptureConfig & {
  routeId: ExternalFindingRouteId;
  coverageRequirement: string;
};

export const EXTERNAL_FINDING_CONFIGS: readonly ExternalFindingConfig[] = [
  {
    routeId: 'walls',
    route: ['external', 'walls'],
    elementConceptId: 'building_element.external_wall',
    findingId: 'finding.external-wall.1',
    label: 'External walls',
    coverageRequirement: 'External walls',
  },
  {
    routeId: 'chimney',
    route: ['external', 'chimney'],
    elementConceptId: 'building_element.chimney',
    findingId: 'finding.chimney.1',
    label: 'Chimney',
    coverageRequirement: 'Chimneys',
  },
  {
    routeId: 'rainwater',
    route: ['external', 'rainwater'],
    elementConceptId: 'building_element.rainwater_goods',
    findingId: 'finding.rainwater-goods.1',
    label: 'Rainwater goods',
    coverageRequirement: 'Rainwater pipes and gutters',
  },
  {
    routeId: 'windows',
    route: ['external', 'windows'],
    elementConceptId: 'building_element.window',
    findingId: 'finding.window.1',
    label: 'Windows',
    coverageRequirement: 'Windows',
  },
];

export function externalFindingConfig(
  routeId: ExternalFindingRouteId,
): ExternalFindingConfig {
  const config = EXTERNAL_FINDING_CONFIGS.find((item) => item.routeId === routeId);
  if (!config) {
    throw new Error(`Missing External finding config: ${routeId}`);
  }
  return config;
}
