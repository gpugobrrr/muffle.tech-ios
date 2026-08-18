import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock factories — vi.hoisted runs before vi.mock hoisting so these
// variables are available inside vi.mock factories.
// ---------------------------------------------------------------------------

const {
  mockTranscribe,
  mockWhisperContext,
  mockInitWhisper,
  mockDownloadAsync,
  mockAsset,
  mockFromModule,
} = vi.hoisted(() => {
  const mockTranscribe = vi.fn();
  const mockWhisperContext = { transcribe: mockTranscribe };
  const mockInitWhisper = vi.fn().mockResolvedValue(mockWhisperContext);
  const mockDownloadAsync = vi.fn().mockResolvedValue(undefined);
  const mockAsset = {
    downloadAsync: mockDownloadAsync,
    localUri: 'file:///tmp/ggml-tiny.en.bin',
  };
  const mockFromModule = vi.fn().mockReturnValue(mockAsset);
  return { mockTranscribe, mockWhisperContext, mockInitWhisper, mockDownloadAsync, mockAsset, mockFromModule };
});

vi.mock('whisper.rn', () => ({
  initWhisper: mockInitWhisper,
}));

vi.mock('expo-asset', () => ({
  Asset: { fromModule: mockFromModule },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import {
  RICS_DOMAIN_PROMPT,
  getLocalWhisperContext,
  resetLocalWhisperContext,
  transcribeOfflineAudio,
} from '../src/lib/audio/local-whisper-adapter';
import {
  nextSimulationBeat,
  resetSimulationBeats,
  transcribeAudio,
} from '../src/lib/audio/transcription-adapter';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('offline Whisper transcription pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLocalWhisperContext();
    resetSimulationBeats();
    // Re-establish defaults after clearAllMocks
    mockTranscribe.mockReturnValue({
      promise: Promise.resolve({ result: 'rafter deflection CR2' }),
    });
    mockInitWhisper.mockResolvedValue(mockWhisperContext);
    mockDownloadAsync.mockResolvedValue(undefined);
    mockFromModule.mockReturnValue(mockAsset);
  });

  afterEach(() => {
    resetLocalWhisperContext();
    vi.restoreAllMocks();
  });

  it('loads the GGML model from the bundled asset and caches the context', async () => {
    await getLocalWhisperContext();
    expect(mockFromModule).toHaveBeenCalledTimes(1);
    expect(mockDownloadAsync).toHaveBeenCalledTimes(1);
    expect(mockInitWhisper).toHaveBeenCalledWith({
      filePath: 'file:///tmp/ggml-tiny.en.bin',
      useCoreMLIos: true,
    });

    // Second call must reuse cached context — no repeated init
    await getLocalWhisperContext();
    expect(mockInitWhisper).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when the model asset has no localUri', async () => {
    mockFromModule.mockReturnValue({ downloadAsync: mockDownloadAsync, localUri: null });

    await expect(getLocalWhisperContext()).rejects.toThrow(
      /Failed to resolve local model path/,
    );
  });

  it('transcribes audio with the correct RICS domain options', async () => {
    const result = await transcribeOfflineAudio('file:///audio/voice.m4a');

    expect(mockTranscribe).toHaveBeenCalledWith('file:///audio/voice.m4a', {
      language: 'en',
      temperature: 0.0,
      maxThreads: 4,
      prompt: RICS_DOMAIN_PROMPT,
    });
    expect(result).toBe('rafter deflection CR2');
  });

  it('returns an empty string and does not throw when result is undefined', async () => {
    mockTranscribe.mockReturnValue({
      promise: Promise.resolve({ result: undefined }),
    });

    const result = await transcribeOfflineAudio('file:///audio/voice.m4a');
    expect(result).toBe('');
  });

  it('transcribeAudio dispatches to local Whisper (tier 1) when audioUri is present', async () => {
    const result = await transcribeAudio('file:///audio/voice.m4a', 'roof void');
    expect(result).toBe('rafter deflection CR2');
    // Simulation beats must NOT have advanced
    const beat0 = nextSimulationBeat('roof void');
    expect(beat0).toContain('CR3'); // first beat, not incremented by transcribeAudio
  });

  it('falls through to simulation beats when local Whisper throws', async () => {
    mockInitWhisper.mockRejectedValue(new Error('model not found'));

    const result = await transcribeAudio(null, 'roof void');
    expect(result).toContain('CR3');
  });

  it('falls through to simulation beats when audioUri is null', async () => {
    const result = await transcribeAudio(null, 'default');
    expect(result).toBe('Macro: CR3 roof spread rear slope, SE referral');
    // local Whisper should NOT have been invoked
    expect(mockTranscribe).not.toHaveBeenCalled();
  });

  it('produces 100% offline results — zero network calls', async () => {
    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', xhrSpy);

    await transcribeAudio('file:///audio/voice.m4a', 'roof void');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('RICS_DOMAIN_PROMPT contains key survey vocabulary', () => {
    const terms = [
      'RICS', 'CR1', 'CR2', 'CR3', 'rafter', 'collar tie',
      'deflection', 'spalling', 'eaves', 'sarking',
    ];
    for (const term of terms) {
      expect(RICS_DOMAIN_PROMPT).toContain(term);
    }
  });
});
