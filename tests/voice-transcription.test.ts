import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { createSimulationStreamingSession } from '../src/lib/audio/simulation-streaming-adapter';

describe('file transcription adapter', () => {
  beforeEach(() => {
    resetSimulationBeats();
    delete process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  });

  afterEach(() => {
    resetSimulationBeats();
    delete process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  });

  it('returns empty string when no audio URI is available', async () => {
    await expect(transcribeAudio(null, 'roof void')).resolves.toBe('');
  });

  it('does not fall back to simulation or OpenAI when local Whisper fails', async () => {
    await expect(
      transcribeAudio('file:///tmp/muffle-voice.m4a', 'roof void'),
    ).rejects.toThrow(/model not available/);
    expect(nextSimulationBeat('roof void')).toBe(
      'Macro: CR3 roof spread rear slope, SE referral',
    );
  });

  it('normalizes room labels before selecting explicit simulation beats', () => {
    resetSimulationBeats();
    expect(nextSimulationBeat(' Roof Void ')).toBe(
      'Macro: CR3 roof spread rear slope, SE referral',
    );
  });

  it('keeps canned streaming only on the explicit simulation adapter', async () => {
    const session = createSimulationStreamingSession('roof void');
    const partials: string[] = [];
    const unsubscribe = session.onPartial((event) => {
      partials.push(event.text);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(partials.length).toBeGreaterThan(0);

    const final = await session.stop();
    expect(final).toBe('Macro: CR3 roof spread rear slope, SE referral');
    unsubscribe();
  });
});
