import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  fillSlot,
  mutateFindingSlot,
  processTranscript,
  resetVoiceFindingStores,
} from '../src/hooks/use-voice-finding-pipeline';
import {
  listInspectionFindings,
  loadInspectionFinding,
  resetInspectionFindingStores,
} from '../src/lib/case-persistence';
import { parseVoiceMacro } from '../src/lib/voice-macro-parser';

const CASE_ID = 'demo-ox3-8se';

const ROOF_SPREAD_MACRO =
  'Macro: CR3 roof spread rear slope, SE referral';
const CONDENSATION_MACRO = 'Condensation no eaves vents';
const INSULATION_MACRO = 'Loft insulation 50mm mineral wool';
const LOCATION_REPAIR = 'rear slope bitumen felt';

function assertCompleteThreePartClause(clause: {
  observation: string;
  implication: string;
  recommendation: string;
}) {
  expect(clause.observation.trim().length).toBeGreaterThan(0);
  expect(clause.implication.trim().length).toBeGreaterThan(0);
  expect(clause.recommendation.trim().length).toBeGreaterThan(0);
}

describe('voice loop', () => {
  beforeEach(() => {
    resetInspectionFindingStores();
    resetVoiceFindingStores();
  });

  afterEach(() => {
    resetInspectionFindingStores();
    resetVoiceFindingStores();
  });

  it('ingests a complete roof-spread macro and persists it for the demo case', async () => {
    const parsed = parseVoiceMacro(ROOF_SPREAD_MACRO);

    expect(parsed.conditionRating).toBe('CR3');
    expect(parsed.defectId).toBe('roof_spread');
    expect(parsed.missingSlots).toEqual([]);
    assertCompleteThreePartClause(parsed.clause);

    const finding = await processTranscript(CASE_ID, ROOF_SPREAD_MACRO);
    const persisted = await loadInspectionFinding(CASE_ID, finding.id);
    const stored = await listInspectionFindings(CASE_ID);

    expect(persisted).toEqual(finding);
    expect(persisted?.elementId).toBe('roof_structure');
    expect(persisted?.source).toBe('voice_macro');
    expect(persisted?.conditionRating).toBe('CR3');
    expect(persisted?.missingSlots).toEqual([]);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe(finding.id);
  });

  it('guards missing location and rebuilds the clause after fillSlot', async () => {
    const parsed = parseVoiceMacro(CONDENSATION_MACRO);

    expect(parsed.defectId).toBe('condensation_ventilation');
    expect(parsed.missingSlots).toContain('location');

    const finding = await processTranscript(CASE_ID, CONDENSATION_MACRO);
    expect(finding.missingSlots).toContain('location');

    const repaired = await mutateFindingSlot(
      CASE_ID,
      finding.id,
      'location',
      LOCATION_REPAIR,
    );

    expect(repaired.observation).toContain(LOCATION_REPAIR);
    expect(repaired.missingSlots).toEqual([]);
    expect(repaired.slots.location).toBe(LOCATION_REPAIR);

    const persisted = await loadInspectionFinding(CASE_ID, finding.id);
    expect(persisted).toEqual(repaired);
    expect(persisted?.observation).toContain(LOCATION_REPAIR);
    expect(persisted?.missingSlots).toEqual([]);
    expect(persisted?.elementId).toBe('roof_structure');
    expect(persisted?.source).toBe('voice_macro');
  });

  it('reports the mineral-wool deficit for a 50mm loft insulation macro', async () => {
    const parsed = parseVoiceMacro(INSULATION_MACRO);

    expect(parsed.defectId).toBe('insulation_deficit');
    expect(parsed.clause.implication).toContain('Deficit: ~220mm');

    const finding = await processTranscript(CASE_ID, INSULATION_MACRO);
    expect(finding.implication).toContain('Deficit: ~220mm');

    const persisted = await loadInspectionFinding(CASE_ID, finding.id);
    expect(persisted?.implication).toContain('Deficit: ~220mm');
    expect(persisted?.elementId).toBe('roof_structure');
    expect(persisted?.source).toBe('voice_macro');
  });

  it('runs the PTT release pipeline cycle with transcribeAudio adapter', async () => {
    const { transcribeAudio, resetSimulationBeats } = await import(
      '../src/lib/audio/transcription-adapter'
    );
    resetSimulationBeats();

    const audioUri: string | null = null;
    const transcript = await transcribeAudio(audioUri, 'roof void');
    expect(transcript).toBe('Macro: CR3 roof spread rear slope, SE referral');

    const finding = await processTranscript(CASE_ID, transcript);
    expect(finding.defectId).toBe('roof_spread');
    expect(finding.conditionRating).toBe('CR3');

    const persisted = await loadInspectionFinding(CASE_ID, finding.id);
    expect(persisted).toEqual(finding);
  });
});
