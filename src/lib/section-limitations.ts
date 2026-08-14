import {
  SURVEY_CONTROLLED_FACT_READ,
  SURVEY_CONTROLLED_FACT_SET,
} from '@/lib/controlled-fact';
import type { FieldDefinition } from '@/lib/field-schema';

export const SECTION_LIMITATION_FIELD_IDS = {
  external: 'inspection.section.external.limitation',
  internal: 'inspection.section.internal.limitation',
  services: 'inspection.section.services.limitation',
} as const;

export type SectionLimitationScope = keyof typeof SECTION_LIMITATION_FIELD_IDS;

type SectionLimitationConfig = {
  scope: SectionLimitationScope;
  sectionToken: 'external' | 'internal' | 'services';
  label: string;
  description: string;
};

const SECTION_LIMITATION_CONFIGS: readonly SectionLimitationConfig[] = [
  {
    scope: 'external',
    sectionToken: 'external',
    label: 'External limitation',
    description:
      'Section-scoped limitation for outside-the-property inspection. Distinct from brief and finding limitations.',
  },
  {
    scope: 'internal',
    sectionToken: 'internal',
    label: 'Internal limitation',
    description:
      'Section-scoped limitation for inside-the-property inspection. Distinct from brief and finding limitations.',
  },
  {
    scope: 'services',
    sectionToken: 'services',
    label: 'Services limitation',
    description:
      'Section-scoped limitation for services inspection. Distinct from brief and finding limitations.',
  },
];

function sectionLimitationFieldDefinition(
  config: SectionLimitationConfig,
): FieldDefinition {
  const path = [config.sectionToken, 'limitation'] as const;
  return {
    kind: 'field',
    path: [...path],
    pathKey: path.join('/'),
    token: 'limitation',
    label: config.label,
    description: config.description,
    fieldId: SECTION_LIMITATION_FIELD_IDS[config.scope],
    optional: true,
    valueType: 'text',
    valuePrompt: `ENTER ${config.label.toUpperCase()}`,
    entryLabel: config.label.toUpperCase(),
    operationId: SURVEY_CONTROLLED_FACT_SET,
    readOperationId: SURVEY_CONTROLLED_FACT_READ,
    notesEnabled: false,
  };
}

export const SECTION_LIMITATION_FIELD_DEFINITIONS: readonly FieldDefinition[] =
  SECTION_LIMITATION_CONFIGS.map(sectionLimitationFieldDefinition);
