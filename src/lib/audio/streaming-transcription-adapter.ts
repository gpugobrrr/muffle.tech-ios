import type { StreamingSession } from '@/lib/audio/streaming-types';

export type StreamingSessionFactory = () => Promise<StreamingSession>;

let sessionFactory: StreamingSessionFactory | null = null;

/** Test helper — inject a session factory. Pass null to restore production realtime. */
export function setStreamingSessionFactory(
  factory: StreamingSessionFactory | null,
): void {
  sessionFactory = factory;
}

/**
 * Production PTT streaming session.
 *
 * Always uses on-device whisper.rn realtime transcription unless a test
 * factory has been injected. Never falls back to canned simulation text.
 */
export async function createStreamingSession(
  _activeRoom: string = 'roof void',
  _apiKey?: string | null,
): Promise<StreamingSession> {
  if (sessionFactory) {
    return sessionFactory();
  }
  const { startRealtimeWhisperSession } = await import(
    '@/lib/audio/realtime-whisper-session'
  );
  return startRealtimeWhisperSession();
}
