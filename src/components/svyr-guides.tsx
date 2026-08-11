import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, SvyrGuide } from '@/constants/theme';

/**
 * Faint vertical guide in the empty Power User workspace.
 * Decorative and stationary: it never moves with the command swipe and
 * never captures input.
 */
export function WorkspaceGuideLine({ isDataEntry }: { isDataEntry: boolean }) {
  const opacity = useSharedValue<number>(SvyrGuide.lineOpacity);

  useEffect(() => {
    opacity.value = withTiming(
      isDataEntry ? SvyrGuide.lineOpacityDataEntry : SvyrGuide.lineOpacity,
      { duration: SvyrGuide.lineFadeMs },
    );
  }, [isDataEntry, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
      style={[styles.workspaceBlueLine, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  workspaceBlueLine: {
    position: 'absolute',
    left: SvyrGuide.lineInset,
    top: SvyrGuide.lineInset,
    bottom: SvyrGuide.lineInset,
    width: SvyrGuide.lineWidth,
    backgroundColor: Colors.accent,
  },
});
