export type VoiceTranscriptionErrorCode =
  | 'permission_denied'
  | 'stream_start_failed'
  | 'whisper_init_failed'
  | 'vad_init_failed'
  | 'native_unavailable'
  | 'transcription_failed'
  | 'empty_speech'
  | 'cancelled';

export class VoiceTranscriptionError extends Error {
  readonly code: VoiceTranscriptionErrorCode;

  constructor(message: string, code: VoiceTranscriptionErrorCode) {
    super(message);
    this.name = 'VoiceTranscriptionError';
    this.code = code;
  }
}

export function toVoiceTranscriptionError(
  error: unknown,
  fallbackCode: VoiceTranscriptionErrorCode,
): VoiceTranscriptionError {
  if (error instanceof VoiceTranscriptionError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new VoiceTranscriptionError(message, fallbackCode);
}
