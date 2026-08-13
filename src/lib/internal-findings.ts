import type { FindingCaptureConfig } from '@/lib/finding-capture';

export type InternalFindingRouteId = 'ceilings';

export type InternalFindingConfig = FindingCaptureConfig & {
  routeId: InternalFindingRouteId;
  coverageRequirement: string;
};

/**
 * Engine-backed Internal inspection subjects.
 * Only 1:1 inspectable concepts belong here — not publication groupings.
 */
export const INTERNAL_FINDING_CONFIGS: readonly InternalFindingConfig[] = [
  {
    routeId: 'ceilings',
    route: ['internal', 'ceilings'],
    elementConceptId: 'building_element.ceiling',
    findingId: 'finding.ceiling.1',
    label: 'Ceilings',
    coverageRequirement: 'Ceilings',
  },
];

export function internalFindingConfig(
  routeId: InternalFindingRouteId,
): InternalFindingConfig {
  const config = INTERNAL_FINDING_CONFIGS.find((item) => item.routeId === routeId);
  if (!config) {
    throw new Error(`Missing Internal finding config: ${routeId}`);
  }
  return config;
}
