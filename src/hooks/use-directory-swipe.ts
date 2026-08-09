import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
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
/**
 * The gesture stays deliberate while the interface barely moves: physical
 * travel is damped heavily and capped, so the command line nudges rather
 * than reading as page navigation.
 */
const MAX_SWIPE_TRANSLATION = 18;
const VISUAL_DAMPING = 0.22;
/** Short, flat return — no spring, no overshoot. */
const RETURN_DURATION = 120;

/**
 * Shared directory-up swipe: one deliberate directional swipe removes exactly
 * one editable command segment via the controller's `moveUpDirectory`.
 * Both the command dock and any future surfaces use this recognition and
 * these motion constants so the gesture cannot diverge; direction defaults to
 * left for SVYR back navigation, while keyboard deletion uses right. Neither
 * renderer mutates the command path itself.
 *
 * The returned style belongs to the SVYR command line alone — never the dock,
 * autocomplete, learner panel or screen.
 */
export function useDirectorySwipe(
  onMoveUpDirectory: () => boolean,
  options?: {
    maxTranslation?: number;
    direction?: 'left' | 'right';
    enabled?: boolean;
  },
) {
  const dragX = useSharedValue(0);
  const visualMax = options?.maxTranslation ?? MAX_SWIPE_TRANSLATION;
  const gestureEnabled = options?.enabled ?? true;
  const directionSign = options?.direction === 'right' ? 1 : -1;
  const activeOffsetX: [number, number] =
    directionSign === 1
      ? [ACTIVATE_OFFSET_X, Number.POSITIVE_INFINITY]
      : [Number.NEGATIVE_INFINITY, -ACTIVATE_OFFSET_X];

  const commitDirectoryUp = useCallback(() => {
    onMoveUpDirectory();
  }, [onMoveUpDirectory]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(gestureEnabled)
        // Start away from the extreme edge so system / browser back still works.
        .activeOffsetX(activeOffsetX)
        .failOffsetY([-FAIL_OFFSET_Y, FAIL_OFFSET_Y])
        .shouldCancelWhenOutside(false)
        .onUpdate((event) => {
          const directionalTravel = event.translationX * directionSign;
          dragX.value =
            directionalTravel > 0
              ? directionSign *
                Math.min(directionalTravel * VISUAL_DAMPING, visualMax)
              : 0;
        })
        .onEnd((event) => {
          // Commitment is judged on the physical swipe, never on how far the
          // command line was allowed to move.
          const isHorizontal =
            Math.abs(event.translationX) > Math.abs(event.translationY);
          const committed =
            isHorizontal &&
            (event.translationX * directionSign >= COMMIT_DISTANCE ||
              (event.translationX * directionSign >= FLICK_DISTANCE &&
                event.velocityX * directionSign >= FLICK_VELOCITY));

          if (committed) {
            runOnJS(commitDirectoryUp)();
          }
        })
        .onFinalize(() => {
          dragX.value = withTiming(0, {
            duration: RETURN_DURATION,
            easing: Easing.out(Easing.cubic),
          });
        }),
    [activeOffsetX, commitDirectoryUp, directionSign, dragX, gestureEnabled, visualMax],
  );

  const commandLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  })) as AnimatedStyle<ViewStyle>;

  return { gesture, commandLineStyle };
}
