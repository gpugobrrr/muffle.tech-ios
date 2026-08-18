import { useCallback, useRef, useState, useSyncExternalStore } from 'react';

import {
  buildCanonicalClause,
  getCanonicalMissingSlots,
} from '@/domain/ontology/canonical-defects';
import {
  attachPhotoToFinding as persistPhotoToFinding,
  listInspectionFindings,
  loadInspectionFinding,
  saveInspectionFinding,
} from '@/lib/case-persistence';
import type { InspectionFinding } from '@/lib/inspection-findings';
import { sortFindings } from '@/lib/inspection-findings';
import { createStreamingSession } from '@/lib/audio/streaming-transcription-adapter';
import type { StreamingSession } from '@/lib/audio/streaming-types';
import { persistVoiceFinding } from '@/lib/voice-finding-bridge';
import {
  parseVoiceMacro,
  parseVoiceMacroPatch,
} from '@/lib/voice-macro-parser';

export type AcousticState = 'STANDBY' | 'LISTENING' | 'PARSING';

export const DEFAULT_VOICE_CASE_ID = 'demo-ox3-8se';
export const DEFAULT_VOICE_ACTIVE_ROOM = 'roof void';

export type VoiceFindingPipelineOptions = {
  activeRoom?: string;
  apiKey?: string | null;
};

export type RoofStructureSetCommand = {
  slotName: string;
  value: string;
  findingId?: string;
};

type VoiceFindingStore = {
  byCase: Map<string, readonly InspectionFinding[]>;
  listeners: Set<() => void>;
};

const voiceFindingStore: VoiceFindingStore = {
  byCase: new Map(),
  listeners: new Set(),
};

/** Stable empty snapshot — never allocate a fresh [] in getSnapshot. */
const EMPTY_VOICE_FINDINGS: readonly InspectionFinding[] = [];

function emitVoiceFindingStore(): void {
  for (const listener of voiceFindingStore.listeners) {
    listener();
  }
}

export function subscribeVoiceFindings(listener: () => void): () => void {
  voiceFindingStore.listeners.add(listener);
  return () => {
    voiceFindingStore.listeners.delete(listener);
  };
}

export function getVoiceFindingsSnapshot(
  caseId: string,
): readonly InspectionFinding[] {
  return voiceFindingStore.byCase.get(caseId) ?? EMPTY_VOICE_FINDINGS;
}

function setCaseFindings(
  caseId: string,
  findings: readonly InspectionFinding[],
): void {
  const nextSnapshot: readonly InspectionFinding[] =
    findings.length === 0 ? EMPTY_VOICE_FINDINGS : [...findings];
  voiceFindingStore.byCase.set(caseId, nextSnapshot);
  emitVoiceFindingStore();
}

function upsertCaseFinding(caseId: string, finding: InspectionFinding): void {
  const current = [...(voiceFindingStore.byCase.get(caseId) ?? EMPTY_VOICE_FINDINGS)];
  const index = current.findIndex((entry) => entry.id === finding.id);
  if (index >= 0) {
    current[index] = finding;
  } else {
    current.push(finding);
  }
  setCaseFindings(caseId, sortFindings(current));
}

/** Hydrate the in-memory subscriber store from case persistence. */
export async function hydrateVoiceFindings(caseId: string): Promise<void> {
  const persisted = await listInspectionFindings(caseId);
  setCaseFindings(caseId, persisted);
}

export function resolveRoofStructureFindingId(
  caseId: string,
  explicitFindingId?: string,
): string | null {
  if (explicitFindingId) {
    const match = getVoiceFindingsSnapshot(caseId).find(
      (finding) => finding.id === explicitFindingId,
    );
    return match?.id ?? explicitFindingId;
  }

  const roofFindings = getVoiceFindingsSnapshot(caseId).filter(
    (finding) => finding.elementId === 'roof_structure',
  );
  if (roofFindings.length === 0) return null;
  return sortFindings(roofFindings).at(-1)?.id ?? null;
}

/**
 * Parse typed CLI slot commands such as
 * `svyr set roof_structure.location "rear slope"`.
 */
export function parseRoofStructureSetCommand(
  rawCommand: string,
): RoofStructureSetCommand | null {
  const trimmed = rawCommand.trim();
  if (!trimmed) return null;

  const quotedWithFindingId =
    /^(?:svyr\s+)?set\s+(roof_structure\.\d+)\.(\w+)\s+"([^"]*)"\s*$/i.exec(
      trimmed,
    );
  if (quotedWithFindingId) {
    return {
      findingId: quotedWithFindingId[1],
      slotName: quotedWithFindingId[2],
      value: quotedWithFindingId[3],
    };
  }

  const quoted =
    /^(?:svyr\s+)?set\s+roof_structure\.(\w+)\s+"([^"]*)"\s*$/i.exec(trimmed);
  if (quoted) {
    return { slotName: quoted[1], value: quoted[2] };
  }

  const unquotedWithFindingId =
    /^(?:svyr\s+)?set\s+(roof_structure\.\d+)\.(\w+)\s+(.+?)\s*$/i.exec(
      trimmed,
    );
  if (unquotedWithFindingId) {
    return {
      findingId: unquotedWithFindingId[1],
      slotName: unquotedWithFindingId[2],
      value: unquotedWithFindingId[3],
    };
  }

  const unquoted =
    /^(?:svyr\s+)?set\s+roof_structure\.(\w+)\s+(.+?)\s*$/i.exec(trimmed);
  if (unquoted) {
    return { slotName: unquoted[1], value: unquoted[2] };
  }

  return null;
}

function buildUpdatedFinding(
  existing: InspectionFinding,
  slotName: string,
  value: string,
): InspectionFinding {
  const slots = {
    ...existing.slots,
    [slotName]: value.trim(),
  };
  const clause = buildCanonicalClause(existing.defectId, slots);
  const missingSlots = getCanonicalMissingSlots(existing.defectId, slots);

  return {
    ...existing,
    slots,
    missingSlots,
    observation: clause.observation,
    implication: clause.implication,
    recommendation: clause.recommendation,
  };
}

/**
 * Unified slot mutation for voice macros, terminal CLI, and nudge chips.
 * Emits the updated finding to subscribers synchronously before persistence.
 */
export async function mutateFindingSlot(
  caseId: string,
  findingId: string,
  slotName: string,
  value: string,
): Promise<InspectionFinding> {
  const fromStore = getVoiceFindingsSnapshot(caseId).find(
    (finding) => finding.id === findingId,
  );
  const existing =
    fromStore ?? (await loadInspectionFinding(caseId, findingId));
  if (!existing) {
    throw new Error(`Finding not found: ${findingId}`);
  }

  const updated = buildUpdatedFinding(existing, slotName, value);
  upsertCaseFinding(caseId, updated);

  const persisted = await saveInspectionFinding(caseId, updated);
  upsertCaseFinding(caseId, persisted);
  return persisted;
}

/** @deprecated Use mutateFindingSlot — retained for existing call sites and tests. */
export const fillSlot = mutateFindingSlot;

async function applyVoiceMacroToFinding(
  caseId: string,
  findingId: string,
  transcript: string,
): Promise<InspectionFinding> {
  const fromStore = getVoiceFindingsSnapshot(caseId).find(
    (finding) => finding.id === findingId,
  );
  const existing =
    fromStore ?? (await loadInspectionFinding(caseId, findingId));
  if (!existing) {
    throw new Error(`Finding not found: ${findingId}`);
  }

  const patch = parseVoiceMacroPatch(transcript);
  const slots = {
    ...existing.slots,
    ...patch.slots,
  };
  const defectId = patch.defectId ?? existing.defectId;
  const clause = buildCanonicalClause(defectId, slots);
  const missingSlots = getCanonicalMissingSlots(defectId, slots);

  const updated: InspectionFinding = {
    ...existing,
    defectId,
    slots,
    missingSlots,
    observation: clause.observation,
    implication: clause.implication,
    recommendation: clause.recommendation,
    conditionRating: patch.conditionRating ?? existing.conditionRating,
  };

  upsertCaseFinding(caseId, updated);
  const persisted = await saveInspectionFinding(caseId, updated);
  upsertCaseFinding(caseId, persisted);
  return persisted;
}

/** Parse a voice transcript and persist the resulting finding for a case. */
export async function processTranscript(
  caseId: string,
  transcript: string,
  targetFindingId?: string,
): Promise<InspectionFinding> {
  if (targetFindingId) {
    return applyVoiceMacroToFinding(caseId, targetFindingId, transcript);
  }

  const parsed = parseVoiceMacro(transcript);
  const persisted = await persistVoiceFinding(caseId, parsed);
  upsertCaseFinding(caseId, persisted);
  return persisted;
}

/**
 * Execute a typed roof-structure slot command against the shared finding store.
 * Returns the optimistically updated finding when the command is recognised.
 */
export async function executeRoofStructureSetCommand(
  caseId: string,
  rawCommand: string,
): Promise<InspectionFinding | null> {
  const parsed = parseRoofStructureSetCommand(rawCommand);
  if (!parsed) return null;

  const findingId = resolveRoofStructureFindingId(caseId, parsed.findingId);
  if (!findingId) {
    throw new Error('No roof_structure finding is available to update');
  }

  return mutateFindingSlot(caseId, findingId, parsed.slotName, parsed.value);
}

/**
 * Attach a captured photo URI to the active or explicit roof-structure finding.
 * Emits the optimistic update synchronously before persistence completes.
 */
export async function attachPhotoToFinding(
  caseId: string,
  findingId?: string,
  photoUri?: string,
): Promise<InspectionFinding | null> {
  const trimmedUri = photoUri?.trim();
  if (!trimmedUri) {
    return null;
  }

  const resolvedId = resolveRoofStructureFindingId(caseId, findingId);
  if (!resolvedId) {
    throw new Error('No active finding is available to attach a photo');
  }

  const fromStore = getVoiceFindingsSnapshot(caseId).find(
    (finding) => finding.id === resolvedId,
  );
  const existing =
    fromStore ?? (await loadInspectionFinding(caseId, resolvedId));
  if (!existing) {
    throw new Error(`Finding not found: ${resolvedId}`);
  }

  const photoUris = [...(existing.photoUris ?? []), trimmedUri];
  const optimistic: InspectionFinding = {
    ...existing,
    photoUris,
    photoCount: photoUris.length,
  };
  upsertCaseFinding(caseId, optimistic);

  const persisted = await persistPhotoToFinding(
    caseId,
    resolvedId,
    trimmedUri,
  );
  upsertCaseFinding(caseId, persisted);
  return persisted;
}

/** Test helper — clears the in-memory subscriber store. */
export function resetVoiceFindingStores(): void {
  voiceFindingStore.byCase.clear();
  emitVoiceFindingStore();
}

export function useVoiceFindingPipeline(
  caseId: string = DEFAULT_VOICE_CASE_ID,
  options: VoiceFindingPipelineOptions = {},
) {
  const activeRoom = options.activeRoom ?? DEFAULT_VOICE_ACTIVE_ROOM;
  const apiKey = options.apiKey;
  const [acousticState, setAcousticState] = useState<AcousticState>('STANDBY');
  const [latestTranscript, setLatestTranscript] = useState<string | null>(null);
  const [streamingTranscript, setStreamingTranscript] = useState<string>('');
  const sessionRef = useRef<StreamingSession | null>(null);
  const getFindingsSnapshot = useCallback(
    () => getVoiceFindingsSnapshot(caseId),
    [caseId],
  );
  const findings = useSyncExternalStore(
    subscribeVoiceFindings,
    getFindingsSnapshot,
    getFindingsSnapshot,
  );

  const processTranscriptAndUpdateFeed = useCallback(
    async (
      activeCaseId: string,
      transcript: string,
      targetFindingId?: string,
    ): Promise<InspectionFinding> => {
      setAcousticState('PARSING');
      try {
        return await processTranscript(
          activeCaseId,
          transcript,
          targetFindingId,
        );
      } finally {
        setAcousticState('STANDBY');
      }
    },
    [],
  );

  const mutateFindingSlotAndUpdateFeed = useCallback(
    async (
      activeCaseId: string,
      findingId: string,
      slotName: string,
      value: string,
    ): Promise<InspectionFinding> => {
      return mutateFindingSlot(activeCaseId, findingId, slotName, value);
    },
    [],
  );

  const handlePttPressIn = useCallback(async () => {
    setAcousticState('LISTENING');
    setStreamingTranscript('');
    try {
      const { startRecording } = await import(
        '@/lib/audio/microphone-capture'
      );
      await startRecording();
    } catch (err) {
      console.warn('Audio recording start failed:', err);
    }
    const session = createStreamingSession(activeRoom, apiKey);
    sessionRef.current = session;
    session.onPartial((e) => {
      setStreamingTranscript(e.text);
    });
  }, [activeRoom, apiKey]);

  const handlePttPressOut = useCallback(
    async (targetFindingId?: string) => {
      setAcousticState('PARSING');
      try {
        let audioUri: string | null = null;
        try {
          const { stopAndGetUri } = await import(
            '@/lib/audio/microphone-capture'
          );
          audioUri = await stopAndGetUri();
        } catch (err) {
          console.warn('Audio recording stop failed:', err);
        }

        let finalText = '';
        if (sessionRef.current) {
          finalText = await sessionRef.current.stop();
          sessionRef.current = null;
        } else {
          const { transcribeAudio } = await import(
            '@/lib/audio/transcription-adapter'
          );
          finalText = await transcribeAudio(audioUri, activeRoom);
        }

        setLatestTranscript(finalText);
        if (finalText.trim()) {
          await processTranscript(caseId, finalText, targetFindingId);
        }
      } finally {
        setStreamingTranscript('');
        setLatestTranscript(null);
        setAcousticState('STANDBY');
      }
    },
    [activeRoom, caseId],
  );

  const captureAndAttachPhoto = useCallback(
    async (findingId?: string): Promise<InspectionFinding | null> => {
      const { captureInspectionPhoto } = await import(
        '@/lib/photo/camera-capture'
      );
      const photoUri = await captureInspectionPhoto();
      if (!photoUri) {
        return null;
      }

      const attached = await attachPhotoToFinding(caseId, findingId, photoUri);
      return attached;
    },
    [caseId],
  );

  return {
    caseId,
    activeRoom,
    acousticState,
    setAcousticState,
    streamingTranscript,
    latestTranscript,
    findings,
    hydrateFindings: useCallback(
      () => hydrateVoiceFindings(caseId),
      [caseId],
    ),
    processTranscript: processTranscriptAndUpdateFeed,
    mutateFindingSlot: mutateFindingSlotAndUpdateFeed,
    attachPhotoToFinding: useCallback(
      (findingId?: string, photoUri?: string) =>
        attachPhotoToFinding(caseId, findingId, photoUri),
      [caseId],
    ),
    captureAndAttachPhoto,
    handlePttPressIn,
    handlePttPressOut,
    /** @deprecated Use mutateFindingSlot */
    fillSlot: mutateFindingSlotAndUpdateFeed,
  };
}
