import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import {
  isBrowserSessionMediaRuntime,
  type LocalMediaSource,
} from '@/core/local-media-store';
import type { InspectionEvidenceCaptureTarget } from '@/lib/command-registry';
import { findingPhotoEvidenceRecords } from '@/lib/evidence-capture';
import { pickEvidencePhotoFromUserGesture } from '@/lib/evidence-photo-picker';
import { formatSvyrDisplayedLabel } from '@/lib/svyr-label-presentation';
import type { InspectionRecord } from '@/types/workspace';

type Props = {
  target: InspectionEvidenceCaptureTarget;
  inspection: InspectionRecord;
  error: string | null;
  onCapturePhoto: (source: LocalMediaSource) => Promise<string | null>;
  onNavigateUpDirectory: () => boolean;
};

type PermissionState = 'unknown' | 'granted' | 'denied';

export function EvidencePhotoCapturePage({
  target,
  inspection,
  error,
  onCapturePhoto,
  onNavigateUpDirectory,
}: Props) {
  const webRuntime = isBrowserSessionMediaRuntime();
  const [permissionState, setPermissionState] = useState<PermissionState>(
    webRuntime ? 'granted' : 'unknown',
  );
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const photos = useMemo(
    () => findingPhotoEvidenceRecords(inspection, target.findingId),
    [inspection, target.findingId],
  );

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (webRuntime) {
      setPermissionState('granted');
      return true;
    }
    const current = await ImagePicker.getCameraPermissionsAsync();
    if (current.granted) {
      setPermissionState('granted');
      return true;
    }
    if (current.canAskAgain === false) {
      setPermissionState('denied');
      return false;
    }
    const requested = await ImagePicker.requestCameraPermissionsAsync();
    if (requested.granted) {
      setPermissionState('granted');
      return true;
    }
    setPermissionState('denied');
    return false;
  }, [webRuntime]);

  useEffect(() => {
    if (webRuntime) return;
    void ensurePermission();
  }, [ensurePermission, webRuntime]);

  const addPhoto = useCallback(async () => {
    setLocalError(null);
    if (!webRuntime && !(await ensurePermission())) {
      setLocalError('Camera permission is required to capture photo evidence.');
      return;
    }

    const picked = await pickEvidencePhotoFromUserGesture();
    if (picked.status === 'canceled') {
      return;
    }
    if (picked.status === 'failed') {
      setLocalError(picked.message);
      return;
    }

    setBusy(true);
    try {
      const failureMessage = await onCapturePhoto(picked.source);
      if (failureMessage) {
        setLocalError(failureMessage);
      }
    } catch (error) {
      console.error('[evidence-photo] Capture failed', error);
      setLocalError('Photo could not be saved');
    } finally {
      setBusy(false);
    }
  }, [ensurePermission, onCapturePhoto, webRuntime]);

  const message = localError ?? error;
  const buttonLabel = webRuntime ? 'Choose photo' : 'Take photo';

  return (
    <View style={styles.page}>
      <View style={styles.panel}>
        <Text style={styles.title}>
          {formatSvyrDisplayedLabel('Add photo', 'entry')}
        </Text>
        <Text style={styles.summary}>
          Photos saved: {photos.length}
        </Text>
        {photos.length > 0 ? (
          <View style={styles.previewRow}>
            {photos.map((photo) => (
              <Image
                key={photo.id}
                accessibilityLabel="Saved photo evidence"
                source={{ uri: photo.uri }}
                style={styles.preview}
              />
            ))}
          </View>
        ) : null}
        {message ? (
          <Text
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
        {permissionState === 'denied' && !webRuntime ? (
          <Text style={styles.permission}>
            Camera permission is denied. Enable camera access in system settings
            to capture photo evidence.
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              webRuntime ? 'Choose photo evidence' : 'Take photo evidence'
            }
            disabled={busy}
            onPress={() => void addPhoto()}
            style={({ pressed }) => [
              styles.button,
              pressed ? styles.buttonPressed : null,
              busy ? styles.buttonDisabled : null,
            ]}>
            <Text style={styles.buttonLabel}>
              {busy ? 'Saving photo…' : buttonLabel}
            </Text>
          </Pressable>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Leave photo capture"
        onPress={() => onNavigateUpDirectory()}
        style={styles.backHint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  panel: {
    width: '100%',
    maxWidth: 560,
    gap: Spacing.md,
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
    textAlign: 'center',
  },
  summary: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  preview: {
    width: 96,
    height: 96,
    backgroundColor: Colors.border,
  },
  error: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.danger,
    textAlign: 'center',
  },
  permission: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    minWidth: 220,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.text,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
    textAlign: 'center',
  },
  backHint: {
    height: 1,
    width: 1,
    opacity: 0,
  },
});
