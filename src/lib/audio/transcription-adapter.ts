/** Deterministic dev/simulator transcripts keyed by active room. */
export const ROOM_SIMULATION_BEATS: Readonly<
  Record<string, readonly string[]>
> = {
  'roof void': [
    'Macro: CR3 roof spread rear slope, SE referral',
    'Condensation no eaves vents',
    'Loft insulation 50mm mineral wool',
  ],
  default: ['Macro: CR3 roof spread rear slope, SE referral'],
};

let simulationBeatIndex = 0;

function normalizeRoom(activeRoom: string): string {
  return activeRoom.trim().toLowerCase() || 'default';
}

export function nextSimulationBeat(activeRoom: string): string {
  const roomKey = normalizeRoom(activeRoom);
  const beats = ROOM_SIMULATION_BEATS[roomKey] ?? ROOM_SIMULATION_BEATS.default;
  const beat = beats[simulationBeatIndex % beats.length] ?? beats[0];
  simulationBeatIndex += 1;
  return beat;
}

/** Test helper — reset the simulation beat rotation. */
export function resetSimulationBeats(): void {
  simulationBeatIndex = 0;
}

/**
 * Transcribe a recorded audio URI on-device with whisper.rn.
 *
 * Production PTT does not use this path — it streams PCM through
 * RealtimeTranscriber. This remains for file-based transcription only.
 *
 * Empty URI → empty string (no speech). Local Whisper failures are thrown
 * rather than replaced with canned simulation text or a cloud API call.
 */
export async function transcribeAudio(
  audioUri: string | null,
  _activeRoom: string,
): Promise<string> {
  if (!audioUri) {
    return '';
  }

  const { transcribeOfflineAudio } = await import(
    '@/lib/audio/local-whisper-adapter'
  );
  return transcribeOfflineAudio(audioUri);
}
