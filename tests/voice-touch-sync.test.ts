import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildLoftClause,
  getMissingSlots,
} from '../src/domain/ontology/loft-room-ontology';
import {
  mutateFindingSlot,
  processTranscript,
  resetVoiceFindingStores,
} from '../src/hooks/use-voice-finding-pipeline';
import {
  loadInspectionFinding,
  resetInspectionFindingStores,
  saveInspectionFinding,
} from '../src/lib/case-persistence';
import type { InspectionFinding } from '../src/lib/inspection-findings';

const CASE_ID = 'demo-ox3-8se';
const CONDENSATION_MACRO = 'Condensation no eaves vents';
const TYPED_LOCATION = 'north pitch felt';
const ORIGINAL_LOCATION = 'rear slope';
const VOICE_RATING_PATCH = 'CR3 SE referral';

function resetStores() {
  resetInspectionFindingStores();
  resetVoiceFindingStores();
}

async function createTypedRoofSpreadFinding(): Promise<InspectionFinding> {
  const slots = { location: ORIGINAL_LOCATION };
  const clause = buildLoftClause('roof_spread', slots);
  return saveInspectionFinding(CASE_ID, {
    id: 'roof_structure.1',
    observation: clause.observation,
    implication: clause.implication,
    recommendation: clause.recommendation,
    conditionRating: 'CR2',
    elementId: 'roof_structure',
    source: 'manual',
    slots,
    missingSlots: getMissingSlots('roof_spread', slots),
    defectId: 'roof_spread',
  });
}

describe('voice-touch state sync', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('repairs a voice-ingested finding through typed slot mutation', async () => {
    const finding = await processTranscript(CASE_ID, CONDENSATION_MACRO);

    expect(finding.missingSlots).toEqual(['location']);
    expect(finding.source).toBe('voice_macro');

    const repaired = await mutateFindingSlot(
      CASE_ID,
      finding.id,
      'location',
      TYPED_LOCATION,
    );

    expect(repaired.observation).toContain(TYPED_LOCATION);
    expect(repaired.missingSlots).toEqual([]);
    expect(repaired.slots.location).toBe(TYPED_LOCATION);

    const persisted = await loadInspectionFinding(CASE_ID, finding.id);
    expect(persisted).toEqual(repaired);
    expect(persisted?.observation).toContain(TYPED_LOCATION);
    expect(persisted?.missingSlots).toEqual([]);
  });

  it('upgrades a typed finding with a targeted voice macro without clobbering slots', async () => {
    const typed = await createTypedRoofSpreadFinding();

    expect(typed.conditionRating).toBe('CR2');
    expect(typed.source).toBe('manual');
    expect(typed.slots.location).toBe(ORIGINAL_LOCATION);

    const updated = await processTranscript(
      CASE_ID,
      VOICE_RATING_PATCH,
      typed.id,
    );

    expect(updated.id).toBe(typed.id);
    expect(updated.conditionRating).toBe('CR3');
    expect(updated.recommendation).toMatch(/SE referral/i);
    expect(updated.slots.location).toBe(ORIGINAL_LOCATION);
    expect(updated.slots.referral).toBe('SE referral');
    expect(updated.observation).toContain(ORIGINAL_LOCATION);

    const persisted = await loadInspectionFinding(CASE_ID, typed.id);
    expect(persisted).toEqual(updated);
    expect(persisted?.conditionRating).toBe('CR3');
    expect(persisted?.slots.location).toBe(ORIGINAL_LOCATION);
  });
});
