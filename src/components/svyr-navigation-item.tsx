import { useRef } from 'react';
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

const SUGGESTED_COMMAND_LONG_PRESS_MS = 350;
const HORIZONTAL_HOLD_CANCEL_DISTANCE = 12;

export type SvyrNavigationItemProps = {
  label: string;
  available?: boolean;
  align?: 'left' | 'right';
  accessibilityHint?: string;
  onPress?: () => void;
  onLongPressHold?: (description: string) => void;
  onLongPressRelease?: () => void;
  holdDescription?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/**
 * Navigation suggestion row — renders `[label]` and preserves long-press /
 * horizontal-swipe cancel behavior from the shared autocomplete surface.
 */
export function SvyrNavigationItem({
  label,
  available = true,
  align = 'left',
  accessibilityHint,
  onPress,
  onLongPressHold,
  onLongPressRelease,
  holdDescription,
  style,
  textStyle,
}: SvyrNavigationItemProps) {
  const holdSelectSuppressRef = useRef(false);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressCancelledRef = useRef(false);

  const clearHeldSuggestion = () => {
    holdSelectSuppressRef.current = false;
    pressStartRef.current = null;
    longPressCancelledRef.current = false;
    onLongPressRelease?.();
  };

  const cancelLongPressForSwipe = () => {
    longPressCancelledRef.current = true;
  };

  return (
    <Pressable
      disabled={!available}
      onPress={
        available && onPress
          ? () => {
              if (holdSelectSuppressRef.current) return;
              onPress();
            }
          : undefined
      }
      onPressIn={(event: GestureResponderEvent) => {
        holdSelectSuppressRef.current = false;
        longPressCancelledRef.current = false;
        pressStartRef.current = {
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
        };
      }}
      onTouchMove={(event: GestureResponderEvent) => {
        const start = pressStartRef.current;
        if (
          start &&
          Math.abs(event.nativeEvent.pageX - start.x) >=
            HORIZONTAL_HOLD_CANCEL_DISTANCE
        ) {
          cancelLongPressForSwipe();
        }
      }}
      onLongPress={
        available && onLongPressHold && holdDescription
          ? () => {
              if (longPressCancelledRef.current) return;
              holdSelectSuppressRef.current = true;
              onLongPressHold(holdDescription);
            }
          : undefined
      }
      onPressOut={() => {
        requestAnimationFrame(() => {
          clearHeldSuggestion();
        });
      }}
      onTouchCancel={clearHeldSuggestion}
      delayLongPress={SUGGESTED_COMMAND_LONG_PRESS_MS}
      cancelable
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={
        available
          ? (accessibilityHint ?? 'Tap to use. Hold for command details.')
          : undefined
      }
      accessibilityState={{ disabled: !available }}
      style={({ pressed }) => [
        styles.suggestionTouchTarget,
        align === 'right' ? styles.suggestionTouchTargetRight : null,
        available && pressed ? styles.pressed : null,
        style,
      ]}>
      <Text
        style={[
          styles.suggestionText,
          !available ? styles.suggestionTextUnavailable : null,
          align === 'right' ? styles.suggestionTextRight : null,
          textStyle,
        ]}>
        {formatSvyrDisplayedLabel(label, 'navigation')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  suggestionTouchTarget: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.xs,
  },
  suggestionTouchTargetRight: {
    alignSelf: 'flex-end',
  },
  suggestionText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
  },
  suggestionTextRight: {
    textAlign: 'right',
  },
  suggestionTextUnavailable: {
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  pressed: {
    opacity: 0.7,
  },
});
