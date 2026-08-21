import {
  RealtimeTranscriber,
  RingBufferVad,
} from 'whisper.rn/src/realtime-transcription';
import type {
  AudioStreamInterface,
  WhisperContextLike,
  WhisperVadContextLike,
} from 'whisper.rn/src/realtime-transcription/types';

import {
  getLocalWhisperContext,
  getLocalWhisperVadContext,
  RICS_DOMAIN_PROMPT,
} from '@/lib/audio/local-whisper-adapter';
import { createNativePcmAudioStream } from '@/lib/audio/pcm-audio-stream';
import type {
  StreamingPartialCallback,
  StreamingSession,
} from '@/lib/audio/streaming-types';
import {
  toVoiceTranscriptionError,
  VoiceTranscriptionError,
} from '@/lib/audio/voice-transcription-error';

/** Format required by whisper.rn 0.7.2 realtime adapters and Parakeet/Whisper PCM paths. */
export const WHISPER_REALTIME_PCM = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
} as const;

export type RealtimeWhisperSessionOverrides = {
  whisperContext?: WhisperContextLike;
  whisperVadContext?: WhisperVadContextLike;
  audioStream?: AudioStreamInterface;
};

class RealtimeWhisperSession implements StreamingSession {
  private readonly transcriber: RealtimeTranscriber;
  private readonly listeners = new Set<StreamingPartialCallback>();
  private readonly errorListeners = new Set<(err: Error) => void>();
  private readonly sliceText = new Map<number, string>();
  private closed = false;
  private lastError: Error | null = null;
  private finalText = '';

  constructor(
    whisperContext: WhisperContextLike,
    vadContext: RingBufferVad,
    audioStream: AudioStreamInterface,
  ) {
    this.transcriber = new RealtimeTranscriber(
      { whisperContext, vadContext, audioStream },
      {
        audioSliceSec: 15,
        audioMinSec: 0.4,
        maxSlicesInMemory: 3,
        initialPrompt: RICS_DOMAIN_PROMPT,
        promptPreviousSlices: true,
        transcribeOptions: {
          language: 'en',
          temperature: 0,
          maxThreads: 4,
        },
        audioStreamConfig: {
          sampleRate: WHISPER_REALTIME_PCM.sampleRate,
          channels: WHISPER_REALTIME_PCM.channels,
          bitsPerSample: WHISPER_REALTIME_PCM.bitsPerSample,
          bufferSize: 16 * 1024,
        },
        realtimeProcessingPauseMs: 250,
        initRealtimeAfterMs: 250,
      },
      {
        onTranscribe: (event) => {
          const text = event.data?.result?.trim();
          if (!text) return;
          this.sliceText.set(event.sliceIndex, text);
          this.emitPartial(false);
        },
        onSliceTranscriptionStabilized: (text) => {
          const trimmed = text.trim();
          if (trimmed) {
            const lastIndex = Math.max(0, ...this.sliceText.keys());
            this.sliceText.set(lastIndex, trimmed);
          }
          this.emitPartial(false);
        },
        onError: (message) => {
          this.lastError = new VoiceTranscriptionError(
            message,
            'transcription_failed',
          );
          for (const listener of this.errorListeners) listener(this.lastError);
        },
      },
    );
  }

  async start(): Promise<void> {
    try {
      await this.transcriber.start();
    } catch (error) {
      throw toVoiceTranscriptionError(error, 'stream_start_failed');
    }
  }

  onPartial(callback: StreamingPartialCallback): () => void {
    this.listeners.add(callback);
    const current = this.combinedText();
    if (current) callback({ text: current, isFinal: false });
    return () => {
      this.listeners.delete(callback);
    };
  }

  onError(callback: (err: Error) => void): () => void {
    this.errorListeners.add(callback);
    return () => {
      this.errorListeners.delete(callback);
    };
  }

  async stop(): Promise<string> {
    if (this.closed) return this.finalText;
    this.closed = true;
    try {
      // Force the in-progress slice while the transcriber is still active.
      // RealtimeTranscriber.stop() sets isActive=false first and then drops
      // queued items, so nextSlice() must run before stop().
      await this.transcriber.nextSlice();
      await waitUntilIdle(this.transcriber);
      this.finalText = this.combinedText();
      await this.transcriber.stop();
      await this.transcriber.release();
      this.emitPartial(true);
      if (this.lastError && !this.finalText) {
        throw this.lastError;
      }
      return this.finalText;
    } catch (error) {
      await this.safeRelease();
      throw toVoiceTranscriptionError(error, 'transcription_failed');
    }
  }

  async abort(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.listeners.clear();
    this.errorListeners.clear();
    await this.safeRelease();
  }

  private combinedText(): string {
    return [...this.sliceText.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, text]) => text)
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private emitPartial(isFinal: boolean): void {
    const text = this.combinedText();
    for (const listener of this.listeners) {
      listener({ text, isFinal });
    }
  }

  private async safeRelease(): Promise<void> {
    try {
      await this.transcriber.release();
    } catch {
      // Native teardown should not leak into PTT control flow.
    }
  }
}

async function waitUntilIdle(
  transcriber: RealtimeTranscriber,
  timeoutMs = 8000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!transcriber.getStatistics().isTranscribing) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

export async function startRealtimeWhisperSession(
  overrides: RealtimeWhisperSessionOverrides = {},
): Promise<StreamingSession> {
  let whisperContext: WhisperContextLike;
  try {
    whisperContext =
      overrides.whisperContext ?? (await getLocalWhisperContext());
  } catch (error) {
    throw toVoiceTranscriptionError(error, 'whisper_init_failed');
  }

  let whisperVadContext: WhisperVadContextLike;
  try {
    whisperVadContext =
      overrides.whisperVadContext ?? (await getLocalWhisperVadContext());
  } catch (error) {
    throw toVoiceTranscriptionError(error, 'vad_init_failed');
  }

  let audioStream: AudioStreamInterface;
  try {
    audioStream =
      overrides.audioStream ?? (await createNativePcmAudioStream());
  } catch (error) {
    throw toVoiceTranscriptionError(error, 'native_unavailable');
  }

  const vadContext = new RingBufferVad(whisperVadContext, {
    vadPreset: 'default',
    sampleRate: WHISPER_REALTIME_PCM.sampleRate,
  });

  const session = new RealtimeWhisperSession(
    whisperContext,
    vadContext,
    audioStream,
  );
  await session.start();
  return session;
}
