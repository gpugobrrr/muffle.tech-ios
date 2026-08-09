import type {
  FindingBlock,
  IdentityBlock,
  ReportDocument,
} from '@/types/report';
import type { BuildingElementConceptId } from '@/types/workspace';

export type FirmTermMapping = {
  firmTerm: string;
  conceptId: BuildingElementConceptId;
};

export type FirmAdapter = {
  id: string;
  version: string;
  elementTerms: readonly FirmTermMapping[];
};

export type FirmFindingBlock = FindingBlock & {
  sectionHeading: string;
};

export type FirmReportDocument = {
  schemaVersion: ReportDocument['schemaVersion'];
  adapter: {
    id: string;
    version: string;
  };
  blocks: readonly (IdentityBlock | FirmFindingBlock)[];
};

export const DEMO_FIRM_ADAPTER: FirmAdapter = {
  id: 'demo-firm',
  version: '1.0.0',
  elementTerms: [
    {
      firmTerm: 'Main Walls',
      conceptId: 'building_element.external_wall',
    },
  ],
};

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveFirmTerm(
  adapter: FirmAdapter,
  firmTerm: string,
): BuildingElementConceptId | undefined {
  const normalized = normalizeTerm(firmTerm);
  return adapter.elementTerms.find(
    (mapping) => normalizeTerm(mapping.firmTerm) === normalized,
  )?.conceptId;
}

export function applyFirmAdapter(
  document: ReportDocument,
  adapter: FirmAdapter,
): FirmReportDocument {
  return {
    schemaVersion: document.schemaVersion,
    adapter: {
      id: adapter.id,
      version: adapter.version,
    },
    blocks: document.blocks.map((block) => {
      if (block.kind === 'identity') return block;
      const mapping = adapter.elementTerms.find(
        (candidate) => candidate.conceptId === block.elementConceptId,
      );
      return {
        ...block,
        sectionHeading: mapping?.firmTerm ?? block.elementLabel,
      };
    }),
  };
}
