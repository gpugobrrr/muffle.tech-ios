import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { formatSvyrDisplayedLabel } from '@/lib/svyr-label-presentation';

export type SvyrChoiceItemProps = {
  label: string;
  selected?: boolean;
  available?: boolean;
  align?: 'left' | 'right';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/**
 * Data-entry choice row — renders `(label)` for both selected and unselected
 * states. Selection is conveyed through color/weight, not punctuation.
 */
export function SvyrChoiceItem({
  label,
  selected = false,
  available = true,
  align = 'left',
  onPress,
  style,
  textStyle,
}: SvyrChoiceItemProps) {
  return (
    <Pressable
      disabled={!available}
      onPress={available ? onPress : undefined}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !available, selected }}
      style={({ pressed }) => [
        styles.choiceTouchTarget,
        align === 'right' ? styles.choiceTouchTargetRight : null,
        available && pressed ? styles.pressed : null,
        style,
      ]}>
      <Text
        style={[
          styles.choiceText,
          selected ? styles.choiceTextSelected : null,
          !available ? styles.choiceTextUnavailable : null,
          align === 'right' ? styles.choiceTextRight : null,
          textStyle,
        ]}>
        {formatSvyrDisplayedLabel(label, 'choice')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choiceTouchTarget: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.xs,
  },
  choiceTouchTargetRight: {
    alignSelf: 'flex-end',
  },
  choiceText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
  },
  choiceTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  choiceTextRight: {
    textAlign: 'right',
  },
  choiceTextUnavailable: {
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  pressed: {
    opacity: 0.7,
  },
});
