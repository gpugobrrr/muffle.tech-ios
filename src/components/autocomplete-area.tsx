import { useEffect, useRef, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { CommandSuggestion } from '@/lib/command-parser';

const HOLD_SELECT_SUPPRESS_MS = 350;
/** Suggestion group cross-fade after a directory change. */
const GROUP_FADE_IN_MS = 160;
const GROUP_FADE_OUT_MS = 120;
/**
 * Narrow landscape widths use a tighter gap while keeping the same command
 * group and touch targets.
 */
const COMPACT_SUGGESTION_WIDTH = 720;

type Props = {
  suggestions: CommandSuggestion[];
  /** Errors, lookup results — cleared when the surveyor types again */
  temporaryContent?: string | null;
  /** Whether the suggested-command group is the active interaction area. */
  showCommandReadyUnderline?: boolean;
  onApplySuggestion: (suggestion: CommandSuggestion) => void;
};

function heldDescriptionFor(suggestion: CommandSuggestion): string {
  if (suggestion.type === 'input-hint') {
    return suggestion.description ?? suggestion.label;
  }
  return suggestion.description;
}

/**
 * Dynamic contextual autocomplete beneath SVYR >.
 * Two balanced groups (left / right) when width allows; order preserved.
 * Split happens only at render time from the shared suggestion list.
 */
export function AutocompleteArea({
  suggestions,
  temporaryContent = null,
  showCommandReadyUnderline = false,
  onApplySuggestion,
}: Props) {
  const { width } = useWindowDimensions();
  const useCompactSpacing = width < COMPACT_SUGGESTION_WIDTH;
  const [previewCommandId, setPreviewCommandId] = useState<string | null>(
    null,
  );
  const [holdPreviewActive, setHoldPreviewActive] = useState(false);
  const holdSelectSuppressRef = useRef(false);

  const previewSuggestion =
    holdPreviewActive && previewCommandId
      ? suggestions.find(
          (item) => item.type === 'token' && item.id === previewCommandId,
        )
      : null;

  const holdOverlay =
    previewSuggestion && previewSuggestion.type === 'token'
      ? heldDescriptionFor(previewSuggestion)
      : null;

  const overlay = holdOverlay ?? temporaryContent;

  const isSuggestionGroupActive =
    showCommandReadyUnderline && !holdOverlay;

  useEffect(() => {
    return () => {
      setPreviewCommandId(null);
      setHoldPreviewActive(false);
    };
  }, []);

  useEffect(() => {
    setPreviewCommandId(null);
    setHoldPreviewActive(false);
  }, [suggestions, temporaryContent]);

  const clearPreview = () => {
    setPreviewCommandId(null);
    setHoldPreviewActive(false);
  };

  const renderSuggestion = (suggestion: CommandSuggestion) => {
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

    return (
      <Pressable
        key={suggestion.id}
        onPress={() => {
          if (holdSelectSuppressRef.current) return;
          onApplySuggestion(suggestion);
        }}
        onPressIn={() => {
          holdSelectSuppressRef.current = false;
          setPreviewCommandId(suggestion.id);
        }}
        onLongPress={() => {
          holdSelectSuppressRef.current = true;
          setHoldPreviewActive(true);
        }}
        onPressOut={() => {
          clearPreview();
          requestAnimationFrame(() => {
            holdSelectSuppressRef.current = false;
          });
        }}
        delayLongPress={HOLD_SELECT_SUPPRESS_MS}
        cancelable
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Suggestion [${suggestion.label}]`}
        accessibilityHint="Tap to use. Hold for command details."
        style={({ pressed }) => [
          styles.suggestionTouchTarget,
          pressed && styles.pressed,
        ]}>
        <Text
          style={[
            styles.suggestionText,
            suggestion.id === previewCommandId
              ? styles.suggestionFocusedText
              : null,
          ]}>
          [{suggestion.label}]
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.autocompleteArea}>
      {overlay ? (
        <View
          style={styles.temporaryTarget}
          accessible
          accessibilityRole="text"
          accessibilityLabel={overlay}>
          <Text
            numberOfLines={2}
            ellipsizeMode="tail"
            style={styles.temporaryText}>
            {overlay}
          </Text>
        </View>
      ) : null}

      <View style={styles.autocompleteRow}>
        <Animated.View
          key={suggestions.map((suggestion) => suggestion.id).join('|')}
          entering={FadeIn.duration(GROUP_FADE_IN_MS)}
          exiting={FadeOut.duration(GROUP_FADE_OUT_MS)}
          style={[
            styles.suggestionsWrap,
            useCompactSpacing ? styles.suggestionsCompact : null,
            holdOverlay ? styles.suggestionsHidden : null,
          ]}
          pointerEvents={holdOverlay ? 'box-none' : 'auto'}>
          {suggestions.map(renderSuggestion)}
          {isSuggestionGroupActive ? (
            <View pointerEvents="none" style={styles.suggestionUnderline} />
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Pulled slightly toward the SVYR bar above. */
  autocompleteArea: {
    width: '100%',
    marginTop: -6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.canvas,
  },
  /** The underline belongs to the complete suggestion group. */
  autocompleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    width: '100%',
  },
  /** One continuous command group; no central spacer or divider. */
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
    minHeight: 44,
    position: 'relative',
    gap: 14,
  },
  suggestionsCompact: {
    gap: 8,
  },
  suggestionsHidden: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  suggestionTouchTarget: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  hintTarget: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  temporaryTarget: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  suggestionText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
  },
  suggestionFocusedText: {
    color: Colors.accent,
  },
  suggestionUnderline: {
    position: 'absolute',
    left: Spacing.xs,
    right: Spacing.xs,
    bottom: 8,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.accentFaint,
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
  pressed: {
    opacity: 0.7,
  },
});
