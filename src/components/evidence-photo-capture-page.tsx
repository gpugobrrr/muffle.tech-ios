import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { InspectionEvidenceCaptureTarget } from '@/lib/command-registry';
import { countFindingPhotoEvidence } from '@/lib/evidence-capture';
import { formatSvyrDisplayedLabel } from '@/lib/svyr-label-presentation';
import type { InspectionRecord } from '@/types/workspace';

type Props = {
  target: InspectionEvidenceCaptureTarget;
  inspection: InspectionRecord;
  error: string | null;
  onCapturePhoto: (temporaryUri: string) => Promise<string | null>;
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
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const photoCount = useMemo(
    () => countFindingPhotoEvidence(inspection, target.findingId),
    [inspection, target.findingId],
  );

  const ensurePermission = useCallback(async (): Promise<boolean> => {
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
  }, []);

  useEffect(() => {
    void ensurePermission();
  }, [ensurePermission]);

  const takePhoto = useCallback(async () => {
    setLocalError(null);
    if (!(await ensurePermission())) {
      setLocalError('Camera permission is required to capture photo evidence.');
      return;
    }

    setBusy(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        exif: false,
      });
      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }
      const failureMessage = await onCapturePhoto(result.assets[0].uri);
      if (failureMessage) {
        setLocalError(failureMessage);
      }
    } finally {
      setBusy(false);
    }
  }, [ensurePermission, onCapturePhoto]);

  const message = localError ?? error;

  return (
    <View style={styles.page}>
      <View style={styles.panel}>
        <Text style={styles.title}>
          {formatSvyrDisplayedLabel('Add photo', 'entry')}
        </Text>
        <Text style={styles.summary}>
          Photos saved: {photoCount}
        </Text>
        {message ? (
          <Text
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
        {permissionState === 'denied' ? (
          <Text style={styles.permission}>
            Camera permission is denied. Enable camera access in system settings
            to capture photo evidence.
          </Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo evidence"
            disabled={busy}
            onPress={() => void takePhoto()}
            style={({ pressed }) => [
              styles.button,
              pressed ? styles.buttonPressed : null,
              busy ? styles.buttonDisabled : null,
            ]}>
            <Text style={styles.buttonLabel}>
              {busy ? 'Saving photo…' : 'Take photo'}
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
