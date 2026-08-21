import type { StreamingSession } from '@/lib/audio/streaming-types';
import {
  toVoiceTranscriptionError,
} from '@/lib/audio/voice-transcription-error';

type AcousticState = 'STANDBY' | 'LISTENING' | 'PARSING';

export type PttUiState = {
  acousticState: AcousticState;
  streamingTranscript: string;
  latestTranscript: string | null;
  error: string | null;
};

export type PttRealtimeControllerDeps = {
  requestPermission: () => Promise<void>;
  createSession: () => Promise<StreamingSession>;
  processTranscript: (
    transcript: string,
    targetFindingId?: string,
  ) => Promise<unknown>;
  onState: (patch: Partial<PttUiState>) => void;
};

/**
 * Owns a single PTT generation: permission → realtime session → finalize.
 * Production sessions must come from the Whisper realtime adapter, not simulation.
 */
export class PttRealtimeController {
  private epoch = 0;
  private session: StreamingSession | null = null;
  private startPromise: Promise<StreamingSession | null> | null = null;
  private stopPromise: Promise<void> | null = null;
  private pressInTask: Promise<void> = Promise.resolve();
  private disposed = false;
  private sessionError: Error | null = null;

  constructor(private readonly deps: PttRealtimeControllerDeps) {}

  async pressIn(): Promise<void> {
    if (this.disposed) return;
    this.pressInTask = this.executePressIn();
    await this.pressInTask;
  }

  private async executePressIn(): Promise<void> {
    if (this.disposed) return;
    const epoch = ++this.epoch;
    if (this.stopPromise) {
      await this.stopPromise;
    }
    if (this.epoch !== epoch) return;

    this.sessionError = null;
    this.deps.onState({
      acousticState: 'LISTENING',
      streamingTranscript: '',
      error: null,
    });

    this.startPromise = this.openSession(epoch);
    const session = await this.startPromise;
    if (this.epoch !== epoch) {
      if (session) await this.safeAbort(session);
      return;
    }
    this.session = session;
  }

  async pressOut(targetFindingId?: string): Promise<void> {
    if (this.disposed) return;
    this.deps.onState({ acousticState: 'PARSING' });
    await this.pressInTask;

    const session = this.session ?? (await this.startPromise);
    this.session = null;
    this.startPromise = null;

    if (!session) {
      this.deps.onState({ acousticState: 'STANDBY' });
      return;
    }

    this.stopPromise = this.finalizeSession(session, targetFindingId);
    try {
      await this.stopPromise;
    } finally {
      this.stopPromise = null;
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.epoch += 1;
    await this.pressInTask.catch(() => undefined);
    const session = this.session;
    this.session = null;
    this.startPromise = null;
    if (session) await this.safeAbort(session);
  }

  private async openSession(epoch: number): Promise<StreamingSession | null> {
    try {
      await this.deps.requestPermission();
      if (this.epoch !== epoch) return null;

      const session = await this.deps.createSession();
      if (this.epoch !== epoch) {
        await this.safeAbort(session);
        return null;
      }

      session.onPartial((event) => {
        if (this.epoch !== epoch) return;
        this.deps.onState({ streamingTranscript: event.text });
      });
      session.onError?.((err) => {
        this.sessionError = err;
        if (this.epoch === epoch) {
          this.deps.onState({ error: err.message });
        }
      });
      return session;
    } catch (error) {
      if (this.epoch !== epoch) return null;
      const typed = toVoiceTranscriptionError(error, 'stream_start_failed');
      this.deps.onState({
        acousticState: 'STANDBY',
        streamingTranscript: '',
        error: typed.message,
      });
      return null;
    }
  }

  private async finalizeSession(
    session: StreamingSession,
    targetFindingId?: string,
  ): Promise<void> {
    try {
      const finalText = await session.stop();
      const trimmed = finalText.trim();
      this.deps.onState({
        latestTranscript: trimmed ? finalText : null,
        streamingTranscript: finalText,
      });

      if (this.sessionError) {
        throw this.sessionError;
      }

      if (!trimmed) {
        this.deps.onState({
          error: 'NO SPEECH DETECTED',
          latestTranscript: null,
        });
        return;
      }

      await this.deps.processTranscript(finalText, targetFindingId);
    } catch (error) {
      const typed = toVoiceTranscriptionError(error, 'transcription_failed');
      this.deps.onState({ error: typed.message });
    } finally {
      this.deps.onState({
        acousticState: 'STANDBY',
        streamingTranscript: '',
      });
    }
  }

  private async safeAbort(session: StreamingSession): Promise<void> {
    try {
      await Promise.resolve(session.abort?.());
    } catch {
      // Teardown must not throw into PTT UX.
    }
  }
}
