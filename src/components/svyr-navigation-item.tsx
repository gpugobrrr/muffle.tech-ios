import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';

const HORIZONTAL_HOLD_CANCEL_DISTANCE = 12;

export type SvyrNavigationItemProps = {
  id: string;
  label: string;
  description: string;
  available: boolean;
  selected?: boolean;
  align: 'left' | 'right';
  kind?: 'navigation' | 'hint';
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onTouchMove?: (event: GestureResponderEvent) => void;
  onPressOut?: () => void;
  onTouchCancel?: () => void;
  delayLongPress?: number;
};

export function SvyrNavigationItem({
  label,
  available,
  selected = false,
  align,
  kind = 'navigation',
  onPress,
  onLongPress,
  onPressIn,
  onTouchMove,
  onPressOut,
  onTouchCancel,
  delayLongPress,
}: SvyrNavigationItemProps) {
  if (kind === 'hint') {
    return (
      <View
        style={styles.hintTarget}
        accessible
        accessibilityRole="text"
        accessibilityLabel={label}>
        <Text style={styles.hintText}>{label}</Text>
      </View>
    );
  }

  return (
    <Pressable
      disabled={!available}
      onPress={available ? onPress : undefined}
      onPressIn={onPressIn}
      onTouchMove={onTouchMove}
      onLongPress={available ? onLongPress : undefined}
      onPressOut={onPressOut}
      onTouchCancel={onTouchCancel}
      delayLongPress={delayLongPress}
      cancelable
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Suggestion [${label}]`}
      accessibilityHint={
        available ? 'Tap to use. Hold for command details.' : undefined
      }
      accessibilityState={{ disabled: !available, selected }}
      style={({ pressed }) => [
        styles.touchTarget,
        align === 'right' ? styles.touchTargetRight : null,
        available && pressed ? styles.pressed : null,
      ]}>
      <Text
        style={[
          styles.labelText,
          !available ? styles.labelTextUnavailable : null,
          selected ? styles.labelTextSelected : null,
          align === 'right' ? styles.labelTextRight : null,
        ]}>
        [{label}]
      </Text>
    </Pressable>
  );
}

export { HORIZONTAL_HOLD_CANCEL_DISTANCE };

const styles = StyleSheet.create({
  touchTarget: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.xs,
  },
  touchTargetRight: {
    alignSelf: 'flex-end',
  },
  hintTarget: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  labelText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
  },
  labelTextRight: {
    textAlign: 'right',
  },
  labelTextUnavailable: {
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  labelTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  hintText: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  pressed: {
    opacity: 0.7,
  },
});
