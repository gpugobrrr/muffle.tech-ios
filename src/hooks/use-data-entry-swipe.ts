import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';

const SWIPE_BACKSPACE_THRESHOLD = 28;
const SWIPE_VERTICAL_TOLERANCE = 20;
const BACKSPACE_REPEAT_DELAY_MS = 400;
const BACKSPACE_REPEAT_INTERVAL_MS = 90;

type Options = {
  enabled: boolean;
  fieldKey: string | null;
  value: string;
  onChangeText: (value: string) => void;
  onNavigateBack: () => boolean;
  navigateBackEnabled?: boolean;
};

export function useDataEntrySwipe({
  enabled,
  fieldKey,
  value,
  onChangeText,
  onNavigateBack,
  navigateBackEnabled = true,
}: Options) {
  const valueRef = useRef(value);
  const changeTextRef = useRef(onChangeText);
  const navigateBackRef = useRef(onNavigateBack);
  const repeatDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const directionRef = useRef<'left' | 'right' | null>(null);

  valueRef.current = value;
  changeTextRef.current = onChangeText;
  navigateBackRef.current = onNavigateBack;

  const clearRepeat = useCallback(() => {
    if (repeatDelayRef.current) clearTimeout(repeatDelayRef.current);
    if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
    repeatDelayRef.current = null;
    repeatIntervalRef.current = null;
  }, []);

  const deleteCharacter = useCallback(() => {
    const current = valueRef.current;
    if (!enabled || !current) {
      clearRepeat();
      return false;
    }

    const next = current.slice(0, -1);
    valueRef.current = next;
    changeTextRef.current(next);
    return true;
  }, [clearRepeat, enabled]);

  const startRepeat = useCallback(() => {
    clearRepeat();
    repeatDelayRef.current = setTimeout(() => {
      repeatIntervalRef.current = setInterval(() => {
        if (!deleteCharacter()) clearRepeat();
      }, BACKSPACE_REPEAT_INTERVAL_MS);
    }, BACKSPACE_REPEAT_DELAY_MS);
  }, [clearRepeat, deleteCharacter]);

  useEffect(() => {
    directionRef.current = null;
    clearRepeat();
  }, [clearRepeat, enabled, fieldKey]);

  useEffect(() => clearRepeat, [clearRepeat]);

  return useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .runOnJS(true)
        .activeOffsetX([-SWIPE_BACKSPACE_THRESHOLD, SWIPE_BACKSPACE_THRESHOLD])
        .failOffsetY([
          -SWIPE_VERTICAL_TOLERANCE,
          SWIPE_VERTICAL_TOLERANCE,
        ])
        .onBegin(() => {
          directionRef.current = null;
          clearRepeat();
        })
        .onUpdate((event) => {
          if (directionRef.current === 'right') {
            if (event.translationX < SWIPE_BACKSPACE_THRESHOLD) {
              clearRepeat();
            }
            return;
          }

          if (directionRef.current === 'left') return;

          if (event.translationX >= SWIPE_BACKSPACE_THRESHOLD) {
            directionRef.current = 'right';
            if (deleteCharacter()) startRepeat();
            return;
          }

          if (
            navigateBackEnabled &&
            event.translationX <= -SWIPE_BACKSPACE_THRESHOLD
          ) {
            directionRef.current = 'left';
            navigateBackRef.current();
          }
        })
        .onFinalize(() => {
          directionRef.current = null;
          clearRepeat();
        }),
    [clearRepeat, deleteCharacter, enabled, navigateBackEnabled, startRepeat],
  );
}
