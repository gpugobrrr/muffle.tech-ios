import type { FirmSemanticFragment } from '@/lib/onboarding/semantic-mapping';

export const SEMANTIC_MAPPING_FIXTURES = {
  obviousPositive: {
    firmTerm: 'Main Walls',
    nearbyHeading: 'External elements',
    representativeText:
      'The main external walls are of traditional masonry construction.',
    expectedConceptId: 'building_element.external_wall',
  },
  ontologyVocabularyPositive: {
    firmTerm: 'External wall',
    representativeText: 'The external wall was inspected.',
    expectedConceptId: 'building_element.external_wall',
  },
  unresolvedNegative: {
    firmTerm: 'Tenure',
    representativeText: 'The property is understood to be freehold.',
  },
} as const satisfies Record<
  string,
  FirmSemanticFragment & { expectedConceptId?: string }
>;
