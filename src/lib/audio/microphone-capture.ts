import { Audio } from 'expo-av';

let activeRecording: Audio.Recording | null = null;

export async function ensureMicrophonePermissions(): Promise<boolean> {
  try {
    const permission = await Audio.requestPermissionsAsync();
    return permission.granted;
  } catch (err) {
    console.warn('Failed to request microphone permissions:', err);
    return false;
  }
}

async function configureRecordingAudioMode(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (err) {
    console.warn('Failed to configure audio mode:', err);
  }
}

export async function startRecording(): Promise<boolean> {
  try {
    const granted = await ensureMicrophonePermissions();
    if (!granted) {
      console.warn('Microphone permission not granted.');
      return false;
    }

    if (activeRecording) {
      try {
        await activeRecording.stopAndUnloadAsync();
      } catch {
        // Ignore stale recorder teardown failures.
      }
      activeRecording = null;
    }

    await configureRecordingAudioMode();

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    await recording.startAsync();
    activeRecording = recording;
    return true;
  } catch (err) {
    console.warn('Failed to start recording:', err);
    activeRecording = null;
    return false;
  }
}

export async function stopAndGetUri(): Promise<string | null> {
  const recording = activeRecording;
  activeRecording = null;
  if (!recording) {
    return null;
  }

  try {
    await recording.stopAndUnloadAsync();
    return recording.getURI();
  } catch (err) {
    console.warn('Failed to stop recording:', err);
    return null;
  }
}

/** Test helper — releases any active recorder without returning a URI. */
export async function resetAudioRecording(): Promise<void> {
  const recording = activeRecording;
  activeRecording = null;
  if (!recording) return;

  try {
    await recording.stopAndUnloadAsync();
  } catch {
    // Ignore teardown failures in tests.
  }
}

