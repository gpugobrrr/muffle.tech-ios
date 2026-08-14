import type { FindingCaptureConfig } from '@/lib/finding-capture';

export type InternalFindingRouteId =
  | 'roof-structure'
  | 'ceilings'
  | 'walls-partitions'
  | 'floors'
  | 'bathroom';

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
    routeId: 'roof-structure',
    route: ['internal', 'roof-structure'],
    elementConceptId: 'building_element.roof_structure',
    findingId: 'finding.roof-structure.1',
    label: 'Roof structure',
    coverageRequirement: 'Roof structure',
  },
  {
    routeId: 'ceilings',
    route: ['internal', 'ceilings'],
    elementConceptId: 'building_element.ceiling',
    findingId: 'finding.ceiling.1',
    label: 'Ceilings',
    coverageRequirement: 'Ceilings',
  },
  {
    routeId: 'walls-partitions',
    route: ['internal', 'walls-partitions'],
    elementConceptId: 'building_element.internal_wall',
    findingId: 'finding.internal-wall.1',
    label: 'Walls and partitions',
    coverageRequirement: 'Walls and partitions',
  },
  {
    routeId: 'floors',
    route: ['internal', 'floors'],
    elementConceptId: 'building_element.floor',
    findingId: 'finding.floor.1',
    label: 'Floors',
    coverageRequirement: 'Floors',
  },
  {
    routeId: 'bathroom',
    route: ['internal', 'bathroom'],
    elementConceptId: 'building_element.bathroom_fitting',
    findingId: 'finding.bathroom-fitting.1',
    label: 'Bathroom fittings',
    coverageRequirement: 'Bathroom fittings',
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
