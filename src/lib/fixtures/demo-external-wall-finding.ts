import type { InspectionFinding } from '@/types/workspace';

export const DEMO_EXTERNAL_WALL_FINDING: InspectionFinding = {
  id: 'finding.external-wall.1',
  elementConceptId: 'building_element.external_wall',
  observation: 'Stepped cracking above rear opening.',
  condition: 'Localised visible movement.',
  defect: 'Masonry cracking.',
  recommendation: 'Obtain structural engineer advice.',
  evidence: [{ id: 'photo-001' }],
};
