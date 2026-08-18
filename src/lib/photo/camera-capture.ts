import * as ImagePicker from 'expo-image-picker';

export async function ensureCameraPermissions(): Promise<boolean> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  return permission.granted;
}

function mockInspectionPhotoUri(): string {
  return `file:///mock/muffle/evidence-${Date.now()}.jpg`;
}

/**
 * Capture an inspection photo via the native camera, falling back to the photo
 * library or a deterministic mock URI in simulator/dev environments.
 */
export async function captureInspectionPhoto(): Promise<string | null> {
  const granted = await ensureCameraPermissions();
  if (granted) {
    const cameraResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!cameraResult.canceled && cameraResult.assets[0]?.uri) {
      return cameraResult.assets[0].uri;
    }
  }

  const libraryPermission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (libraryPermission.granted) {
    const libraryResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!libraryResult.canceled && libraryResult.assets[0]?.uri) {
      return libraryResult.assets[0].uri;
    }
  }

  if (__DEV__) {
    return mockInspectionPhotoUri();
  }

  return null;
}
