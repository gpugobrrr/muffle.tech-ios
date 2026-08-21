import { Asset } from 'expo-asset';
import { initWhisper, initWhisperVad } from 'whisper.rn';
import type { WhisperContext, WhisperVadContext } from 'whisper.rn';

/**
 * RICS domain vocabulary injected as an initial prompt so Whisper biases
 * towards survey-specific terminology and condition rating shorthand.
 */
export const RICS_DOMAIN_PROMPT =
  'RICS Level 2, CR1, CR2, CR3, rafter, collar tie, deflection, spalling, eaves, sarking';

/** Module-level singleton — loaded once per app session. */
let _whisperContext: WhisperContext | null = null;
let _vadContext: WhisperVadContext | null = null;

/** Reset cached Whisper and VAD contexts — used in tests. */
export function resetLocalWhisperContext(): void {
  _whisperContext = null;
  _vadContext = null;
}

function resolveModelAsset(): number | string {
  if (process.env.VITEST) return 1;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../../assets/models/ggml-tiny.en.bin');
  } catch {
    return 1;
  }
}

function resolveVadModelAsset(): number | string {
  if (process.env.VITEST) return 1;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../../assets/models/ggml-silero-v6.2.0.bin');
  } catch {
    return 1;
  }
}

/**
 * Load and cache the on-device Whisper context from the bundled GGML model.
 * Uses CoreML acceleration on iOS where available.
 *
 * Throws if the model asset cannot be resolved to a local file URI (i.e., the
 * real `ggml-tiny.en.bin` has not been placed in `assets/models/` — see
 * `assets/models/README.md`).
 */
export async function getLocalWhisperContext(): Promise<WhisperContext> {
  if (_whisperContext) return _whisperContext;

  // Asset.fromModule resolves the Metro-bundled binary and copies it to a
  // local cache directory accessible by the native Whisper runtime.
  const asset = Asset.fromModule(resolveModelAsset());
  await asset.downloadAsync();

  const filePath = asset.localUri;
  if (!filePath) {
    throw new Error(
      '[local-whisper] Failed to resolve local model path. ' +
        'Ensure ggml-tiny.en.bin has been downloaded to assets/models/. ' +
        'See assets/models/README.md.',
    );
  }

  _whisperContext = await initWhisper({
    filePath,
    // CoreML encoder drastically reduces latency on Apple Silicon.
    // Silently ignored on Android / simulators.
    useCoreMLIos: true,
  });

  return _whisperContext;
}

/**
 * Load and cache the Silero VAD context required by whisper.rn 0.7.2
 * `RingBufferVad`. Throws if `ggml-silero-v6.2.0.bin` is missing.
 */
export async function getLocalWhisperVadContext(): Promise<WhisperVadContext> {
  if (_vadContext) return _vadContext;

  const asset = Asset.fromModule(resolveVadModelAsset());
  await asset.downloadAsync();

  const filePath = asset.localUri;
  if (!filePath) {
    throw new Error(
      '[local-whisper] Failed to resolve Silero VAD model path. ' +
        'Download ggml-silero-v6.2.0.bin to assets/models/. ' +
        'See assets/models/README.md.',
    );
  }

  _vadContext = await initWhisperVad({
    filePath,
    useGpu: true,
    nThreads: 4,
  });

  return _vadContext;
}

/**
 * Transcribe a local audio file URI fully on-device using the GGML Whisper
 * model. Audio must be accessible as a local `file://` URI; M4A and WAV are
 * both handled by the platform's native decoder on iOS.
 *
 * @param audioUri  Local file URI returned by `stopAndGetUri()`.
 * @returns         Transcribed text, or an empty string if the model produces
 *                  no output.
 */
export async function transcribeOfflineAudio(audioUri: string): Promise<string> {
  const context = await getLocalWhisperContext();
  const { promise } = context.transcribe(audioUri, {
    language: 'en',
    temperature: 0.0,
    maxThreads: 4,
    prompt: RICS_DOMAIN_PROMPT,
  });
  const { result } = await promise;
  return result?.trim() ?? '';
}
