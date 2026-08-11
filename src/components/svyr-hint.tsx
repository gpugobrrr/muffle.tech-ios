import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import {
  SVYR_HINT_COPY,
  type SvyrHintId,
} from '@/lib/hint-repository';

const FADE_IN_MS = 140;
const FADE_OUT_MS = 120;

type Props = {
  id: SvyrHintId;
  onDismiss: (id: SvyrHintId) => void;
  /** Optional alignment override — default hugs the left content edge. */
  align?: 'left' | 'right';
};

/**
 * One-line contextual tip. Never a modal, never a reserved empty slot when
 * absent — the parent mounts this only for the active hint id.
 */
export function SvyrHint({ id, onDismiss, align = 'left' }: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(FADE_IN_MS)}
      exiting={FadeOut.duration(FADE_OUT_MS)}
      pointerEvents="box-none"
      style={[
        styles.row,
        align === 'right' ? styles.rowRight : null,
      ]}>
      <View style={styles.leader} pointerEvents="none" />
      <Pressable
        onPress={() => onDismiss(id)}
        accessibilityRole="button"
        accessibilityLabel={`${SVYR_HINT_COPY[id]}. Dismiss hint.`}
        hitSlop={8}
        style={({ pressed }) => [
          styles.hintPressable,
          pressed && styles.pressed,
        ]}>
        <Text style={styles.hintText}>{SVYR_HINT_COPY[id]}</Text>
        <Text style={styles.dismiss}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    minHeight: 28,
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  leader: {
    width: 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderStrong,
  },
  hintPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: '100%',
  },
  hintText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.slate,
    flexShrink: 1,
  },
  dismiss: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.textMuted,
    paddingHorizontal: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
