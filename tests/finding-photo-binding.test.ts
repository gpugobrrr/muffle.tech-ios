import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  attachPhotoToFinding,
  processTranscript,
  resetVoiceFindingStores,
} from '../src/hooks/use-voice-finding-pipeline';
import {
  attachPhotoToFinding as persistPhotoToFinding,
  listInspectionFindings,
  loadInspectionFinding,
  resetInspectionFindingStores,
} from '../src/lib/case-persistence';

const CASE_ID = 'demo-ox3-8se';
const PHOTO_URI_ONE = 'file:///mock/muffle/evidence-1.jpg';
const PHOTO_URI_TWO = 'file:///mock/muffle/evidence-2.jpg';

function resetStores() {
  resetInspectionFindingStores();
  resetVoiceFindingStores();
}

describe('finding photo binding', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('appends photo URIs to the active finding and persists them', async () => {
    const finding = await processTranscript(
      CASE_ID,
      'Macro: CR3 roof spread rear slope, SE referral',
    );

    const attached = await attachPhotoToFinding(
      CASE_ID,
      undefined,
      PHOTO_URI_ONE,
    );

    expect(attached?.id).toBe(finding.id);
    expect(attached?.photoUris).toEqual([PHOTO_URI_ONE]);
    expect(attached?.photoCount).toBe(1);

    const reloaded = await loadInspectionFinding(CASE_ID, finding.id);
    expect(reloaded?.photoUris).toEqual([PHOTO_URI_ONE]);
    expect(reloaded?.photoCount).toBe(1);
  });

  it('targets the most recent finding when findingId is omitted', async () => {
    await processTranscript(CASE_ID, 'Condensation no eaves vents');
    const latest = await processTranscript(
      CASE_ID,
      'Macro: CR3 roof spread rear slope, SE referral',
    );

    const attached = await attachPhotoToFinding(
      CASE_ID,
      undefined,
      PHOTO_URI_TWO,
    );

    expect(attached?.id).toBe(latest.id);
    expect(attached?.photoUris).toEqual([PHOTO_URI_TWO]);
  });

  it('persists multiple photos across storage reloads', async () => {
    const finding = await processTranscript(
      CASE_ID,
      'Macro: CR3 roof spread rear slope, SE referral',
    );

    await persistPhotoToFinding(CASE_ID, finding.id, PHOTO_URI_ONE);
    await persistPhotoToFinding(CASE_ID, finding.id, PHOTO_URI_TWO);

    const stored = await listInspectionFindings(CASE_ID);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.photoUris).toEqual([PHOTO_URI_ONE, PHOTO_URI_TWO]);
    expect(stored[0]?.photoCount).toBe(2);
  });
});
