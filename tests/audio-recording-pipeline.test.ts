import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Audio } from 'expo-av';
import {
  startRecording,
  stopAndGetUri,
  resetAudioRecording,
  prepareMicrophoneForCapture,
} from '../src/lib/audio/microphone-capture';
import { VoiceTranscriptionError } from '../src/lib/audio/voice-transcription-error';

vi.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: vi.fn(),
    setAudioModeAsync: vi.fn(),
    Recording: vi.fn(),
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));

describe('audio recording pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetAudioRecording();
    vi.restoreAllMocks();
  });

  it('starts and stops recording successfully when permissions are granted', async () => {
    vi.spyOn(Audio, 'requestPermissionsAsync').mockResolvedValue({
      granted: true,
      canAskAgain: true,
      expires: 'never',
      status: 'granted',
    } as Awaited<ReturnType<typeof Audio.requestPermissionsAsync>>);
    vi.spyOn(Audio, 'setAudioModeAsync').mockResolvedValue();

    const mockRecording = {
      prepareToRecordAsync: vi.fn().mockResolvedValue({}),
      startAsync: vi.fn().mockResolvedValue({}),
      stopAndUnloadAsync: vi.fn().mockResolvedValue({}),
      getURI: vi.fn().mockReturnValue('file:///test/audio.m4a'),
    };
    vi.spyOn(Audio, 'Recording').mockImplementation(() => mockRecording as never);

    const started = await startRecording();
    expect(started).toBe(true);
    expect(mockRecording.startAsync).toHaveBeenCalled();

    const uri = await stopAndGetUri();
    expect(uri).toBe('file:///test/audio.m4a');
    expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
  });

  it('handles rejected microphone permissions gracefully', async () => {
    vi.spyOn(Audio, 'requestPermissionsAsync').mockResolvedValue({
      granted: false,
      canAskAgain: false,
      expires: 'never',
      status: 'denied',
    } as Awaited<ReturnType<typeof Audio.requestPermissionsAsync>>);

    const started = await startRecording();
    expect(started).toBe(false);

    const uri = await stopAndGetUri();
    expect(uri).toBeNull();
  });

  it('prepareMicrophoneForCapture throws on denied permission and does not start recording', async () => {
    vi.spyOn(Audio, 'requestPermissionsAsync').mockResolvedValue({
      granted: false,
      canAskAgain: false,
      expires: 'never',
      status: 'denied',
    } as Awaited<ReturnType<typeof Audio.requestPermissionsAsync>>);

    await expect(prepareMicrophoneForCapture()).rejects.toBeInstanceOf(
      VoiceTranscriptionError,
    );
  });
});
