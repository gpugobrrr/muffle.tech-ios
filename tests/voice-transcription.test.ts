import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the local-whisper-adapter so tests don't attempt to load native Whisper.
// transcribeAudio's tier-1 (local Whisper) will throw → falls through to tier-3
// (simulation beats), which is exactly what these tests assert.
vi.mock('@/lib/audio/local-whisper-adapter', () => ({
  transcribeOfflineAudio: vi.fn().mockRejectedValue(new Error('mock: model not available')),
  getLocalWhisperContext: vi.fn().mockRejectedValue(new Error('mock: model not available')),
  resetLocalWhisperContext: vi.fn(),
  RICS_DOMAIN_PROMPT: 'RICS Level 2, CR1, CR2, CR3',
}));

import {
  nextSimulationBeat,
  resetSimulationBeats,
  transcribeAudio,
} from '../src/lib/audio/transcription-adapter';

describe('transcription adapter', () => {
  beforeEach(() => {
    resetSimulationBeats();
    delete process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  });

  afterEach(() => {
    resetSimulationBeats();
    delete process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  });

  it('returns roof-void simulation beats when no audio URI is available', async () => {
    await expect(transcribeAudio(null, 'roof void')).resolves.toBe(
      'Macro: CR3 roof spread rear slope, SE referral',
    );
    await expect(transcribeAudio(null, 'roof void')).resolves.toBe(
      'Condensation no eaves vents',
    );
  });

  it('falls back to simulation beats when cloud keys are absent', async () => {
    await expect(
      transcribeAudio('file:///tmp/muffle-voice.m4a', 'roof void'),
    ).resolves.toBe('Macro: CR3 roof spread rear slope, SE referral');
  });

  it('normalizes room labels before selecting beats', async () => {
    resetSimulationBeats();
    expect(nextSimulationBeat(' Roof Void ')).toBe(
      'Macro: CR3 roof spread rear slope, SE referral',
    );
  });

  it('streams partial tokens and resolves the complete transcript on stop', async () => {
    const { createStreamingSession } = await import(
      '../src/lib/audio/streaming-transcription-adapter'
    );
    resetSimulationBeats();

    const session = createStreamingSession('roof void');
    const partials: string[] = [];

    const unsubscribe = session.onPartial((e) => {
      partials.push(e.text);
    });

    // Wait a brief tick for initial partial
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(partials.length).toBeGreaterThan(0);

    const final = await session.stop();
    expect(final).toBe('Macro: CR3 roof spread rear slope, SE referral');
    expect(partials[partials.length - 1]).toBe(
      'Macro: CR3 roof spread rear slope, SE referral',
    );

    unsubscribe();
  });
});
