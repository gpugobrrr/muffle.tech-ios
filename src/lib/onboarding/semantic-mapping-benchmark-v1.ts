import type { FirmSemanticFragment } from '@/lib/onboarding/semantic-mapping';

export type BenchmarkCategory =
  | 'obvious-match'
  | 'alternative-terminology'
  | 'contextual'
  | 'unresolved';

export type SemanticMappingBenchmarkCase = {
  id: string;
  fragment: FirmSemanticFragment;
  expectedConceptId: string | null;
  category: BenchmarkCategory;
  notes?: string;
};

const externalWall = 'building_element.external_wall';

export const SEMANTIC_MAPPING_BENCHMARK_V1 = [
  {
    id: 'external-wall-01-main-walls',
    category: 'obvious-match',
    fragment: {
      firmTerm: 'Main Walls',
      nearbyHeading: 'External elements',
      representativeText:
        'The main external walls are of traditional masonry construction.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-02-external-walls',
    category: 'obvious-match',
    fragment: {
      firmTerm: 'External Walls',
      representativeText: 'The external walls were inspected throughout.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-03-main-external-walls',
    category: 'obvious-match',
    fragment: {
      firmTerm: 'Main External Walls',
      representativeText: 'No access was available to part of the main external walls.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-04-external-walling',
    category: 'obvious-match',
    fragment: {
      firmTerm: 'External Walling',
      nearbyHeading: 'Building fabric',
      representativeText: 'The external walling is predominantly masonry.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-05-wall-construction',
    category: 'obvious-match',
    fragment: {
      firmTerm: 'Wall Construction',
      nearbyHeading: 'External elements',
      representativeText: 'Wall construction appears to be traditional solid masonry.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-06-external-elevations',
    category: 'obvious-match',
    fragment: {
      firmTerm: 'External Elevations',
      representativeText: 'The external elevations were visually inspected from ground level.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-07-external-fabric',
    category: 'obvious-match',
    fragment: {
      firmTerm: 'External Fabric',
      nearbyHeading: 'Main walls',
      representativeText: 'The external fabric includes masonry walls and associated openings.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-08-external-wall-review',
    category: 'obvious-match',
    fragment: {
      firmTerm: 'External Wall Review',
      representativeText: 'Visible cracking was recorded to the external wall.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-09-outer-walls',
    category: 'alternative-terminology',
    fragment: {
      firmTerm: 'Outer Walls',
      nearbyHeading: 'External fabric',
      representativeText: 'The outer walls were viewed from the surrounding ground.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-10-principal-walling',
    category: 'alternative-terminology',
    fragment: {
      firmTerm: 'Principal Walling',
      nearbyHeading: 'External elements',
      representativeText: 'The principal walling is brick masonry.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-11-masonry-envelope',
    category: 'alternative-terminology',
    fragment: {
      firmTerm: 'Masonry Envelope',
      nearbyHeading: 'External wall',
      representativeText: 'The masonry envelope forms the external walling of the house.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-12-outside-wall-line',
    category: 'alternative-terminology',
    fragment: {
      firmTerm: 'Outside Wall Line',
      representativeText: 'Defects were noted along the outside wall line.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-13-external-elevation-walls',
    category: 'alternative-terminology',
    fragment: {
      firmTerm: 'Elevation Walls',
      nearbyHeading: 'External elevations',
      representativeText: 'The elevation walls are exposed brick masonry.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-14-elevations-context',
    category: 'contextual',
    fragment: {
      firmTerm: 'Elevations',
      nearbyHeading: 'External wall inspection',
      representativeText: 'Stepped cracking was observed above the rear opening.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-15-fabric-context',
    category: 'contextual',
    fragment: {
      firmTerm: 'Fabric',
      nearbyHeading: 'External wall',
      representativeText: 'The fabric is formed by solid masonry external walls.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-16-walls-context',
    category: 'contextual',
    fragment: {
      firmTerm: 'Walls',
      nearbyHeading: 'Building element: external wall',
      representativeText: 'Localised masonry cracking affects the external wall.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'external-wall-17-structure-context',
    category: 'contextual',
    fragment: {
      firmTerm: 'Structure',
      nearbyHeading: 'External walls',
      representativeText: 'The external wall structure is traditional masonry.',
    },
    expectedConceptId: externalWall,
    notes: 'The heading is broad; the supplied wall context determines the label.',
  },
  {
    id: 'external-wall-18-building-fabric-context',
    category: 'contextual',
    fragment: {
      firmTerm: 'Building Fabric',
      nearbyHeading: 'External wall elements',
      representativeText: 'The inspected building fabric is the external wall construction.',
    },
    expectedConceptId: externalWall,
  },
  {
    id: 'inspection-19-finding',
    category: 'contextual',
    fragment: {
      firmTerm: 'Finding',
      nearbyHeading: 'Inspection record',
      representativeText: 'A stable finding records the observed condition of an element.',
    },
    expectedConceptId: 'inspection.finding',
  },
  {
    id: 'inspection-20-observation',
    category: 'contextual',
    fragment: {
      firmTerm: 'Observed',
      nearbyHeading: 'Observation',
      representativeText: 'Stepped cracking was directly observed above the opening.',
    },
    expectedConceptId: 'observation',
  },
  {
    id: 'inspection-21-condition',
    category: 'contextual',
    fragment: {
      firmTerm: 'Condition',
      nearbyHeading: 'Inspection finding',
      representativeText: 'The condition is recorded as localised visible movement.',
    },
    expectedConceptId: 'condition',
  },
  {
    id: 'inspection-22-defect',
    category: 'contextual',
    fragment: {
      firmTerm: 'Adverse Condition',
      nearbyHeading: 'Finding',
      representativeText: 'Masonry cracking is identified as the associated defect.',
    },
    expectedConceptId: 'defect',
  },
  {
    id: 'inspection-23-recommendation',
    category: 'contextual',
    fragment: {
      firmTerm: 'Recommended Action',
      nearbyHeading: 'Inspection finding',
      representativeText: 'Obtain structural engineer advice before repair.',
    },
    expectedConceptId: 'recommendation',
  },
  {
    id: 'unresolved-24-tenure',
    category: 'unresolved',
    fragment: {
      firmTerm: 'Tenure',
      representativeText: 'The property is understood to be freehold.',
    },
    expectedConceptId: null,
  },
  {
    id: 'unresolved-25-legal-matters',
    category: 'unresolved',
    fragment: {
      firmTerm: 'Legal Matters',
      representativeText: 'Legal matters should be referred to the client adviser.',
    },
    expectedConceptId: null,
  },
  {
    id: 'unresolved-26-heating',
    category: 'unresolved',
    fragment: {
      firmTerm: 'Heating',
      representativeText: 'The heating installation was not assessed in this inspection.',
    },
    expectedConceptId: null,
  },
  {
    id: 'unresolved-27-drainage',
    category: 'unresolved',
    fragment: {
      firmTerm: 'Drainage',
      representativeText: 'Drainage arrangements were outside the inspected scope.',
    },
    expectedConceptId: null,
  },
  {
    id: 'unresolved-28-energy-efficiency',
    category: 'unresolved',
    fragment: {
      firmTerm: 'Energy Efficiency',
      representativeText: 'Energy efficiency matters were not rated by this survey.',
    },
    expectedConceptId: null,
  },
  {
    id: 'unresolved-29-services',
    category: 'unresolved',
    fragment: {
      firmTerm: 'Services',
      representativeText: 'Services installations were outside the current semantic slice.',
    },
    expectedConceptId: null,
  },
  {
    id: 'unresolved-30-ownership',
    category: 'unresolved',
    fragment: {
      firmTerm: 'Ownership',
      representativeText: 'Ownership information is not an inspection finding concept.',
    },
    expectedConceptId: null,
  },
] as const satisfies readonly SemanticMappingBenchmarkCase[];
