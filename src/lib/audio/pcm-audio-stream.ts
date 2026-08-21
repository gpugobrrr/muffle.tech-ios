import type { AudioStreamInterface } from 'whisper.rn/src/realtime-transcription';

import { VoiceTranscriptionError } from '@/lib/audio/voice-transcription-error';

/**
 * Native 16 kHz mono signed-16 PCM capture used by whisper.rn RealtimeTranscriber.
 * Requires `@fugood/react-native-audio-pcm-stream` in a development build.
 */
export async function createNativePcmAudioStream(): Promise<AudioStreamInterface> {
  try {
    const { AudioPcmStreamAdapter } = await import(
      'whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter'
    );
    return new AudioPcmStreamAdapter();
  } catch (error) {
    throw new VoiceTranscriptionError(
      `Native PCM microphone module is unavailable. Use an iOS development build (not Expo Go). ${
        error instanceof Error ? error.message : String(error)
      }`,
      'native_unavailable',
    );
  }
}
