import {
  allocateNextInspectionFindingId,
  saveInspectionFinding,
} from '@/lib/case-persistence';
import type { InspectionFinding } from '@/lib/inspection-findings';
import type { ParsedVoiceFinding } from '@/lib/voice-macro-parser';

const ROOF_STRUCTURE_ELEMENT_ID = 'roof_structure' as const;
const VOICE_FINDING_SOURCE = 'voice_macro' as const;
const VOICE_FINDING_ID_PREFIX = 'roof_structure';

export async function persistVoiceFinding(
  caseId: string,
  parsed: ParsedVoiceFinding,
): Promise<InspectionFinding> {
  const finding: InspectionFinding = {
    id: allocateNextInspectionFindingId(caseId, VOICE_FINDING_ID_PREFIX),
    observation: parsed.clause.observation,
    implication: parsed.clause.implication,
    recommendation: parsed.clause.recommendation,
    conditionRating: parsed.conditionRating,
    elementId: ROOF_STRUCTURE_ELEMENT_ID,
    source: VOICE_FINDING_SOURCE,
    slots: { ...parsed.slots },
    missingSlots: [...parsed.missingSlots],
    defectId: parsed.defectId,
  };

  return saveInspectionFinding(caseId, finding);
}
