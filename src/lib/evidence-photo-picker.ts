import * as ImagePicker from 'expo-image-picker';

import {
  isBrowserSessionMediaRuntime,
  localMediaSourceFromPickerAsset,
  type LocalMediaSource,
} from '@/core/local-media-store';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.85,
  exif: false,
};

export type EvidencePhotoPickResult =
  | { status: 'selected'; source: LocalMediaSource }
  | { status: 'canceled' }
  | { status: 'failed'; message: string };

function interpretPickerResult(
  result: ImagePicker.ImagePickerResult,
): EvidencePhotoPickResult {
  if (result.canceled) {
    return { status: 'canceled' };
  }
  const asset = result.assets?.[0];
  const source = asset ? localMediaSourceFromPickerAsset(asset) : null;
  if (!source) {
    return {
      status: 'failed',
      message: 'Selected photo could not be read',
    };
  }
  return { status: 'selected', source };
}

/**
 * Open the platform image picker on the current user-gesture path.
 * Web uses the library/file picker immediately (browsers block delayed
 * pickers and camera-capture inputs are a poor desktop upload path).
 * Native keeps camera capture after permission.
 */
export async function pickEvidencePhotoFromUserGesture(): Promise<EvidencePhotoPickResult> {
  try {
    if (isBrowserSessionMediaRuntime()) {
      const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
      return interpretPickerResult(result);
    }

    const current = await ImagePicker.getCameraPermissionsAsync();
    if (!current.granted) {
      if (current.canAskAgain === false) {
        return {
          status: 'failed',
          message:
            'Camera permission is required to capture photo evidence.',
        };
      }
      const requested = await ImagePicker.requestCameraPermissionsAsync();
      if (!requested.granted) {
        return {
          status: 'failed',
          message:
            'Camera permission is required to capture photo evidence.',
        };
      }
    }

    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
    return interpretPickerResult(result);
  } catch (error) {
    console.error('[evidence-photo] Image picker failed', error);
    return {
      status: 'failed',
      message: 'Photo could not be selected',
    };
  }
}
