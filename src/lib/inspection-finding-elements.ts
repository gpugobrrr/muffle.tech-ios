/** Stable property-element IDs accepted by canonical finding operations. */
export const INSPECTION_ELEMENT_CONCEPT_IDS = [
  'building_element.external_wall',
  'building_element.chimney',
  'building_element.rainwater_goods',
  'building_element.window',
  'service_system.electrical_installation',
  'service_system.water_supply',
  'service_system.drainage',
  'service_system.heating',
  'service_system.hot_water',
  'service_system.gas_installation',
] as const;

export type InspectionElementConceptId =
  (typeof INSPECTION_ELEMENT_CONCEPT_IDS)[number];

export type InspectionFindingField =
  | 'observation'
  | 'condition'
  | 'defect'
  | 'recommendation'
  | 'evidence';

const ELEMENT_LABELS: Readonly<Record<InspectionElementConceptId, string>> = {
  'building_element.external_wall': 'External wall',
  'building_element.chimney': 'Chimney',
  'building_element.rainwater_goods': 'Rainwater goods',
  'building_element.window': 'Window',
  'service_system.electrical_installation': 'Electrical installation',
  'service_system.water_supply': 'Water supply',
  'service_system.drainage': 'Drainage',
  'service_system.heating': 'Heating system',
  'service_system.hot_water': 'Hot water system',
  'service_system.gas_installation': 'Gas installation',
};

export function isInspectionElementConceptId(
  value: string,
): value is InspectionElementConceptId {
  return (INSPECTION_ELEMENT_CONCEPT_IDS as readonly string[]).includes(value);
}

export function labelForInspectionElement(
  elementConceptId: InspectionElementConceptId,
): string {
  return ELEMENT_LABELS[elementConceptId];
}
