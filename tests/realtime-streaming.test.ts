import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStartRealtime } = vi.hoisted(() => ({
  mockStartRealtime: vi.fn(),
}));

vi.mock('@/lib/audio/realtime-whisper-session', () => ({
  startRealtimeWhisperSession: mockStartRealtime,
  WHISPER_REALTIME_PCM: { sampleRate: 16000, channels: 1, bitsPerSample: 16 },
}));

import { nextSimulationBeat, resetSimulationBeats } from '../src/lib/audio/transcription-adapter';
import {
  createStreamingSession,
  setStreamingSessionFactory,
} from '../src/lib/audio/streaming-transcription-adapter';
import { PttRealtimeController } from '../src/lib/audio/ptt-realtime-controller';
import { VoiceTranscriptionError } from '../src/lib/audio/voice-transcription-error';
import {
  processTranscript,
  resetVoiceFindingStores,
} from '../src/hooks/use-voice-finding-pipeline';
import { resetInspectionFindingStores } from '../src/lib/case-persistence';
import type { StreamingPartialCallback, StreamingSession } from '../src/lib/audio/streaming-types';

const CASE_ID = 'demo-ox3-8se';

type FakeSession = StreamingSession & {
  emitPartial: (text: string) => void;
  emitError: (error: Error) => void;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
};

function createFakeSession(options?: {
  finalText?: string;
  failStop?: Error;
}): FakeSession {
  const partialListeners = new Set<StreamingPartialCallback>();
  const errorListeners = new Set<(err: Error) => void>();
  const stop = vi.fn(async () => {
    if (options?.failStop) {
      throw options.failStop;
    }
    const text = options?.finalText ?? 'rafter deflection CR2';
    for (const listener of partialListeners) {
      listener({ text, isFinal: true });
    }
    return text;
  });
  const abort = vi.fn(async () => undefined);

  return {
    emitPartial(text: string) {
      for (const listener of partialListeners) {
        listener({ text, isFinal: false });
      }
    },
    emitError(error: Error) {
      for (const listener of errorListeners) listener(error);
    },
    onPartial(callback) {
      partialListeners.add(callback);
      return () => {
        partialListeners.delete(callback);
      };
    },
    onError(callback) {
      errorListeners.add(callback);
      return () => {
        errorListeners.delete(callback);
      };
    },
    stop,
    abort,
  };
}

describe('production realtime streaming adapter', () => {
  beforeEach(() => {
    mockStartRealtime.mockReset();
    setStreamingSessionFactory(null);
    resetSimulationBeats();
    resetVoiceFindingStores();
    resetInspectionFindingStores();
  });

  afterEach(() => {
    setStreamingSessionFactory(null);
    resetSimulationBeats();
    resetVoiceFindingStores();
    resetInspectionFindingStores();
  });

  it('starts the real Whisper realtime session and never calls nextSimulationBeat', async () => {
    const session = createFakeSession();
    mockStartRealtime.mockResolvedValue(session);
    resetSimulationBeats();

    const produced = await createStreamingSession('roof void');

    expect(mockStartRealtime).toHaveBeenCalledTimes(1);
    expect(produced).toBe(session);
    expect(nextSimulationBeat('roof void')).toBe(
      'Macro: CR3 roof spread rear slope, SE referral',
    );
  });

  it('updates streamingTranscript from real partial events', async () => {
    const session = createFakeSession();
    const state = { streamingTranscript: '', acousticState: 'STANDBY' as const };
    const controller = new PttRealtimeController({
      requestPermission: async () => undefined,
      createSession: async () => session,
      processTranscript: async () => undefined,
      onState: (patch) => {
        if (patch.streamingTranscript !== undefined) {
          state.streamingTranscript = patch.streamingTranscript;
        }
      },
    });

    await controller.pressIn();
    session.emitPartial('rafter');
    session.emitPartial('rafter deflection');
    expect(state.streamingTranscript).toBe('rafter deflection');
    await controller.dispose();
  });

  it('returns the realtime transcript on stop and sends it to processTranscript', async () => {
    const session = createFakeSession({
      finalText: 'Macro: CR3 roof spread rear slope, SE referral',
    });
    const processSpy = vi.fn(async (transcript: string) => {
      return processTranscript(CASE_ID, transcript);
    });
    let latestTranscript: string | null = null;
    let acousticState = 'STANDBY';
    const controller = new PttRealtimeController({
      requestPermission: async () => undefined,
      createSession: async () => session,
      processTranscript: processSpy,
      onState: (patch) => {
        if (patch.latestTranscript !== undefined) {
          latestTranscript = patch.latestTranscript;
        }
        if (patch.acousticState !== undefined) {
          acousticState = patch.acousticState;
        }
      },
    });

    await controller.pressIn();
    expect(acousticState).toBe('LISTENING');
    await controller.pressOut();

    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(processSpy).toHaveBeenCalledWith(
      'Macro: CR3 roof spread rear slope, SE referral',
      undefined,
    );
    expect(latestTranscript).toBe(
      'Macro: CR3 roof spread rear slope, SE referral',
    );
    expect(acousticState).toBe('STANDBY');
    const finding = await processSpy.mock.results[0]?.value;
    expect(finding?.defectId).toBe('roof_spread');
  });

  it('does not create a finding when microphone permission is denied', async () => {
    const createSession = vi.fn(async () => createFakeSession());
    const processSpy = vi.fn();
    let error: string | null = null;
    const controller = new PttRealtimeController({
      requestPermission: async () => {
        throw new VoiceTranscriptionError(
          'Microphone permission denied.',
          'permission_denied',
        );
      },
      createSession,
      processTranscript: processSpy,
      onState: (patch) => {
        if (patch.error !== undefined) error = patch.error;
      },
    });

    await controller.pressIn();
    await controller.pressOut();

    expect(createSession).not.toHaveBeenCalled();
    expect(processSpy).not.toHaveBeenCalled();
    expect(error).toMatch(/permission denied/i);
  });

  it('does not create a finding when transcription fails', async () => {
    const session = createFakeSession({
      failStop: new VoiceTranscriptionError(
        'native transcribe failed',
        'transcription_failed',
      ),
    });
    const processSpy = vi.fn();
    let error: string | null = null;
    const controller = new PttRealtimeController({
      requestPermission: async () => undefined,
      createSession: async () => session,
      processTranscript: processSpy,
      onState: (patch) => {
        if (patch.error !== undefined) error = patch.error;
      },
    });

    await controller.pressIn();
    await controller.pressOut();

    expect(processSpy).not.toHaveBeenCalled();
    expect(error).toMatch(/transcribe failed/i);
  });

  it('does not create a finding for empty speech', async () => {
    const session = createFakeSession({ finalText: '   ' });
    const processSpy = vi.fn();
    const controller = new PttRealtimeController({
      requestPermission: async () => undefined,
      createSession: async () => session,
      processTranscript: processSpy,
      onState: () => undefined,
    });

    await controller.pressIn();
    await controller.pressOut();
    expect(processSpy).not.toHaveBeenCalled();
  });

  it('aborts and releases the session on dispose', async () => {
    const session = createFakeSession();
    const controller = new PttRealtimeController({
      requestPermission: async () => undefined,
      createSession: async () => session,
      processTranscript: async () => undefined,
      onState: () => undefined,
    });

    await controller.pressIn();
    await controller.dispose();
    expect(session.abort).toHaveBeenCalledTimes(1);
  });

  it('treats rapid start/stop as safe and keeps latestTranscript after STANDBY', async () => {
    const session = createFakeSession({ finalText: 'collar tie CR2' });
    let latestTranscript: string | null = null;
    let acousticState = 'STANDBY';
    const controller = new PttRealtimeController({
      requestPermission: async () => undefined,
      createSession: async () => session,
      processTranscript: async () => undefined,
      onState: (patch) => {
        if (patch.latestTranscript !== undefined) {
          latestTranscript = patch.latestTranscript;
        }
        if (patch.acousticState !== undefined) {
          acousticState = patch.acousticState;
        }
      },
    });

    const started = controller.pressIn();
    const stopped = controller.pressOut();
    await Promise.all([started, stopped]);

    expect(acousticState).toBe('STANDBY');
    expect(latestTranscript).toBe('collar tie CR2');
    expect(session.stop).toHaveBeenCalled();
  });
});
