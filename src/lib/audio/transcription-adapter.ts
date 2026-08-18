const OPENAI_TRANSCRIPTION_URL =
  'https://api.openai.com/v1/audio/transcriptions';

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

function resolveSpeechApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
  return key ? key : null;
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

async function transcribeWithOpenAI(
  audioUri: string,
  apiKey: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', {
    uri: audioUri,
    name: 'muffle-voice.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  form.append('model', 'whisper-1');
  form.append('language', 'en');

  const response = await fetch(OPENAI_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Speech transcription failed (${response.status})`);
  }

  const payload = (await response.json()) as { text?: string };
  const text = payload.text?.trim();
  if (!text) {
    throw new Error('Speech transcription returned an empty transcript');
  }
  return text;
}

/**
 * Transcribe a recorded audio URI using a 3-tier strategy:
 *
 * 1. **On-device (primary)**: `whisper.rn` GGML model — 100% offline, no API
 *    key required. Falls through only if the model file is absent or errors.
 * 2. **Cloud (secondary)**: OpenAI Whisper API — used when
 *    `EXPO_PUBLIC_OPENAI_API_KEY` is set and the local model is unavailable.
 * 3. **Simulation (fallback)**: Deterministic room-keyed beats for dev /
 *    simulator flows where no audio URI or model is present.
 */
export async function transcribeAudio(
  audioUri: string | null,
  activeRoom: string,
): Promise<string> {
  // Tier 1: on-device Whisper (offline, no API key needed)
  if (audioUri) {
    try {
      const { transcribeOfflineAudio } = await import(
        '@/lib/audio/local-whisper-adapter'
      );
      const result = await transcribeOfflineAudio(audioUri);
      if (result) return result;
    } catch (err) {
      // Model not yet downloaded or hardware limitation — fall through.
      console.warn('[transcribeAudio] Local Whisper unavailable:', err);
    }
  }

  // Tier 2: cloud Whisper via OpenAI
  const apiKey = resolveSpeechApiKey();
  if (audioUri && apiKey) {
    try {
      return await transcribeWithOpenAI(audioUri, apiKey);
    } catch (err) {
      console.warn('[transcribeAudio] OpenAI Whisper failed:', err);
    }
  }

  // Tier 3: deterministic simulation beats (dev / demo)
  return nextSimulationBeat(activeRoom);
}
