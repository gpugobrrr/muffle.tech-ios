import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

/** Horizontal travel before the pan takes over from taps and scrolling. */
const ACTIVATE_OFFSET_X = 18;
/** Predominantly vertical movement fails the pan, leaving scrolling intact. */
const FAIL_OFFSET_Y = 28;
/** Deliberate distance that commits a directory change. */
const COMMIT_DISTANCE = 56;
/** Shorter travel still commits when flicked decisively. */
const FLICK_DISTANCE = 36;
const FLICK_VELOCITY = 500;
/** Feedback cap — the dock nudges, the screen never slides. */
const FEEDBACK_MAX = 28;
const RETURN_DURATION = 140;

/**
 * Shared directory-up swipe: one deliberate right swipe removes exactly one
 * editable command segment via the controller's `moveUpDirectory`.
 * Both orientations use this recognition and feedback so the gesture cannot
 * diverge; neither renderer mutates the command path itself.
 */
export function useDirectorySwipe(onMoveUpDirectory: () => boolean) {
  const dragX = useSharedValue(0);

  const commitDirectoryUp = useCallback(() => {
    onMoveUpDirectory();
  }, [onMoveUpDirectory]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // Start away from the extreme edge so system / browser back still works.
        .activeOffsetX(ACTIVATE_OFFSET_X)
        .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
        .shouldCancelWhenOutside(false)
        .onUpdate((event) => {
          dragX.value =
            event.translationX > 0
              ? Math.min(event.translationX, FEEDBACK_MAX)
              : 0;
        })
        .onEnd((event) => {
          const isHorizontal =
            Math.abs(event.translationX) > Math.abs(event.translationY);
          const committed =
            isHorizontal &&
            (event.translationX >= COMMIT_DISTANCE ||
              (event.translationX >= FLICK_DISTANCE &&
                event.velocityX >= FLICK_VELOCITY));

          if (committed) {
            runOnJS(commitDirectoryUp)();
          }
        })
        .onFinalize(() => {
          dragX.value = withTiming(0, { duration: RETURN_DURATION });
        }),
    [commitDirectoryUp, dragX],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  })) as AnimatedStyle<ViewStyle>;

  return { gesture, animatedStyle };
}
