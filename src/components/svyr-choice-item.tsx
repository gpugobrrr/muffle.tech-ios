import {
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { formatSvyrDisplayedLabel } from '@/lib/svyr-label-presentation';

export type SvyrChoiceItemProps = {
  id: string;
  label: string;
  description: string;
  available: boolean;
  selected?: boolean;
  align: 'left' | 'right';
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onTouchMove?: (event: GestureResponderEvent) => void;
  onPressOut?: () => void;
  onTouchCancel?: () => void;
  delayLongPress?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/**
 * Data-entry choice row — renders choice-delimited labels for both selected
 * and unselected states. Selection is conveyed through color/weight, not
 * punctuation.
 */
export function SvyrChoiceItem({
  label,
  available,
  selected = false,
  align,
  onPress,
  onLongPress,
  onPressIn,
  onTouchMove,
  onPressOut,
  onTouchCancel,
  delayLongPress,
  style,
  textStyle,
}: SvyrChoiceItemProps) {
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
      accessibilityLabel={label}
      accessibilityHint={
        available ? 'Tap to choose this value. Hold for details.' : undefined
      }
      accessibilityState={{ disabled: !available, selected }}
      style={({ pressed }) => [
        styles.touchTarget,
        align === 'right' ? styles.touchTargetRight : null,
        available && pressed ? styles.pressed : null,
        style,
      ]}>
      <Text
        style={[
          styles.labelText,
          !available ? styles.labelTextUnavailable : null,
          selected ? styles.labelTextSelected : null,
          align === 'right' ? styles.labelTextRight : null,
          textStyle,
        ]}>
        {formatSvyrDisplayedLabel(label, 'choice')}
      </Text>
    </Pressable>
  );
}

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
  pressed: {
    opacity: 0.7,
  },
});
