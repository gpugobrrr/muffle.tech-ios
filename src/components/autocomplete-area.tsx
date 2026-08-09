import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useDirectorySwipe } from '@/hooks/use-directory-swipe';
import type { CommandSuggestion } from '@/lib/command-parser';

const SUGGESTED_COMMAND_LONG_PRESS_MS = 350;
const HORIZONTAL_HOLD_CANCEL_DISTANCE = 12;
/** Suggestion group cross-fade after a directory change. */
const GROUP_FADE_IN_MS = 160;
const GROUP_FADE_OUT_MS = 120;
/**
 * Narrow landscape widths use a tighter gap while keeping the same command
 * group and touch targets.
 */
const ERGONOMIC_START_RATIO = 0.18;
const ERGONOMIC_START_MAX = 120;

type Props = {
  suggestions: CommandSuggestion[];
  /** Errors, lookup results — cleared when the surveyor types again */
  temporaryContent?: string | null;
  onApplySuggestion: (suggestion: CommandSuggestion) => void;
  onNavigateUpDirectory?: () => boolean;
  onSwipeBackCommitted?: () => void;
};

function heldDescriptionFor(suggestion: CommandSuggestion): string {
  if (suggestion.type === 'input-hint') {
    return suggestion.description ?? suggestion.label;
  }
  return suggestion.description;
}

/**
 * Dynamic contextual autocomplete for the SVYR workspace.
 * Two vertical groups preserve the shared suggestion order: the first half
 * stays on the left and the second half stays on the right.
 */
export function AutocompleteArea({
  suggestions,
  temporaryContent = null,
  onApplySuggestion,
  onNavigateUpDirectory,
  onSwipeBackCommitted,
}: Props) {
  const { height } = useWindowDimensions();
  const ergonomicStart = Math.min(
    Math.max(height * ERGONOMIC_START_RATIO, Spacing.lg),
    ERGONOMIC_START_MAX,
  );
  const [heldSuggestionId, setHeldSuggestionId] = useState<string | null>(
    null,
  );
  const holdSelectSuppressRef = useRef(false);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressCancelledRef = useRef(false);

  const handleSwipeNavigateUp = () => {
    if (!onNavigateUpDirectory) return false;
    const removed = onNavigateUpDirectory();
    if (removed) onSwipeBackCommitted?.();
    return removed;
  };
  const { gesture } = useDirectorySwipe(handleSwipeNavigateUp);
  const heldSuggestion =
    heldSuggestionId === null
      ? null
      : suggestions.find(
          (suggestion) =>
            suggestion.type === 'token' && suggestion.id === heldSuggestionId,
        );

  useEffect(() => {
    return () => {
      holdSelectSuppressRef.current = false;
    };
  }, []);

  useEffect(() => {
    setHeldSuggestionId(null);
    holdSelectSuppressRef.current = false;
  }, [suggestions, temporaryContent]);

  const clearHeldSuggestion = () => {
    setHeldSuggestionId(null);
    holdSelectSuppressRef.current = false;
    pressStartRef.current = null;
    longPressCancelledRef.current = false;
  };

  const cancelLongPressForSwipe = () => {
    setHeldSuggestionId(null);
    longPressCancelledRef.current = true;
  };

  const renderSuggestion = (
    suggestion: CommandSuggestion,
    align: 'left' | 'right',
  ) => {
    if (suggestion.type === 'input-hint') {
      return (
        <View
          key={suggestion.id}
          style={styles.hintTarget}
          accessible
          accessibilityRole="text"
          accessibilityLabel={suggestion.label}>
          <Text style={styles.hintText}>{suggestion.label}</Text>
        </View>
      );
    }

    const isAvailable = suggestion.available;

    return (
      <Pressable
        key={suggestion.id}
        disabled={!isAvailable}
        onPress={
          isAvailable
            ? () => {
                if (holdSelectSuppressRef.current) return;
                onApplySuggestion(suggestion);
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
          isAvailable
            ? () => {
                if (longPressCancelledRef.current) return;
                holdSelectSuppressRef.current = true;
                setHeldSuggestionId(suggestion.id);
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
        accessibilityLabel={`Suggestion [${suggestion.label}]`}
        accessibilityHint={
          isAvailable ? 'Tap to use. Hold for command details.' : undefined
        }
        accessibilityState={{ disabled: !isAvailable }}
        style={({ pressed }) => [
          styles.suggestionTouchTarget,
          align === 'right' ? styles.suggestionTouchTargetRight : null,
          isAvailable && pressed ? styles.pressed : null,
        ]}>
        <Text
          style={[
            styles.suggestionText,
            !isAvailable ? styles.suggestionTextUnavailable : null,
            align === 'right' ? styles.suggestionTextRight : null,
          ]}>
          [{suggestion.label}]
        </Text>
      </Pressable>
    );
  };

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.autocompleteArea}>
        {heldSuggestion && heldSuggestion.type === 'token' ? (
          <View
            pointerEvents="none"
            style={styles.explanationWorkspace}
            accessibilityElementsHidden>
            <Text style={styles.explanationText}>
              {heldDescriptionFor(heldSuggestion)}
            </Text>
          </View>
        ) : null}
        {temporaryContent ? (
          <View
            style={styles.temporaryTarget}
            accessible
            accessibilityRole="text"
            accessibilityLabel={temporaryContent}>
            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={styles.temporaryText}>
              {temporaryContent}
            </Text>
          </View>
        ) : null}

        <View style={[styles.autocompleteRow, { paddingTop: ergonomicStart }]}>
          <Animated.View
            key={suggestions.map((suggestion) => suggestion.id).join('|')}
            entering={FadeIn.duration(GROUP_FADE_IN_MS)}
            exiting={FadeOut.duration(GROUP_FADE_OUT_MS)}
            style={styles.suggestionsWrap}>
            <View style={styles.suggestionColumn}>
              {suggestions
                .slice(0, Math.ceil(suggestions.length / 2))
                .map((suggestion) => renderSuggestion(suggestion, 'left'))}
            </View>
            <View style={styles.suggestionColumn}>
              {suggestions
                .slice(Math.ceil(suggestions.length / 2))
                .map((suggestion) => renderSuggestion(suggestion, 'right'))}
            </View>
          </Animated.View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  autocompleteArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    paddingHorizontal: Spacing.xxl,
  },
  autocompleteRow: {
    flex: 1,
    width: '100%',
  },
  suggestionsWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  suggestionColumn: {
    width: '32%',
    gap: Spacing.xs,
  },
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
  hintTarget: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  temporaryTarget: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  explanationWorkspace: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
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
  hintText: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  temporaryText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.textSecondary,
  },
  explanationText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
