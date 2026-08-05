import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import type { CommandSuggestion } from '@/lib/command-parser';
import type { PinState } from '@/lib/pin-context';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';

/** Portrait has the vertical room to show more wrapped rows. */
const PORTRAIT_MAX_HEIGHT = 132;
const LANDSCAPE_MAX_HEIGHT = 96;
const HOLD_SELECT_SUPPRESS_MS = 350;
/** Suggestion group cross-fade after a directory change. */
const GROUP_FADE_IN_MS = 160;
const GROUP_FADE_OUT_MS = 120;

type Props = {
  suggestions: CommandSuggestion[];
  /** Errors, lookup results — cleared when the surveyor types again */
  temporaryContent?: string | null;
  pinState: PinState;
  pinnedPrefixLabel: string;
  onApplySuggestion: (suggestion: CommandSuggestion) => void;
  onTogglePin: () => void;
};

function pinAccessibilityLabel(
  pinState: PinState,
  pinnedPrefixLabel: string,
): string {
  if (pinState === 'armed') return 'Cancel pinning next command';
  if (pinState === 'active') {
    return pinnedPrefixLabel
      ? `Unpin command prefix ${pinnedPrefixLabel}`
      : 'Unpin command prefix';
  }
  return 'Pin next command';
}

function heldDescriptionFor(suggestion: CommandSuggestion): string {
  if (suggestion.type === 'input-hint') {
    return suggestion.description ?? suggestion.label;
  }
  return suggestion.description;
}

/**
 * Dynamic contextual autocomplete beneath SVYR >, with trailing global pin.
 * Hold previews the description; release collapses. Tap inserts / executes.
 */
export function AutocompleteArea({
  suggestions,
  temporaryContent = null,
  pinState,
  pinnedPrefixLabel,
  onApplySuggestion,
  onTogglePin,
}: Props) {
  const { width, height } = useWindowDimensions();
  const [previewCommandId, setPreviewCommandId] = useState<string | null>(
    null,
  );
  const [holdPreviewActive, setHoldPreviewActive] = useState(false);
  const holdSelectSuppressRef = useRef(false);

  const maxHeight =
    width > height ? LANDSCAPE_MAX_HEIGHT : PORTRAIT_MAX_HEIGHT;

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

  const pinColor =
    pinState === 'inactive' ? Colors.textMuted : Colors.accent;
  const pinIconName =
    pinState === 'active' ? 'pin' : 'pin-outline';

  return (
    <View style={styles.autocompleteArea}>
      <ScrollView
        style={[styles.scroll, { maxHeight }]}
        contentContainerStyle={styles.autocompleteWrap}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        bounces={false}
        onScrollBeginDrag={clearPreview}>
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

        <Animated.View
          key={suggestions.map((suggestion) => suggestion.id).join('|')}
          entering={FadeIn.duration(GROUP_FADE_IN_MS)}
          exiting={FadeOut.duration(GROUP_FADE_OUT_MS)}
          style={[
            styles.suggestionsRow,
            holdOverlay ? styles.suggestionsRowHidden : null,
          ]}
          pointerEvents={holdOverlay ? 'box-none' : 'auto'}>
          {suggestions.map((suggestion) => {
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
                accessibilityLabel={`Suggestion ${suggestion.label}`}
                accessibilityHint="Tap to use. Hold for command details."
                style={({ pressed }) => [
                  styles.suggestionTouchTarget,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.suggestionText}>{suggestion.label}</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </ScrollView>

      <Pressable
        onPress={onTogglePin}
        accessibilityRole="button"
        accessibilityLabel={pinAccessibilityLabel(pinState, pinnedPrefixLabel)}
        accessibilityState={{
          selected: pinState === 'armed' || pinState === 'active',
        }}
        style={({ pressed }) => [
          styles.pinControl,
          pinState === 'armed' && styles.pinArmed,
          pinState === 'active' && styles.pinActive,
          pressed && styles.pressed,
        ]}>
        <Ionicons name={pinIconName} size={16} color={pinColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  autocompleteArea: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
  },
  scroll: {
    flex: 1,
    minHeight: 44,
  },
  autocompleteWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    flexGrow: 1,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flexGrow: 1,
  },
  suggestionsRowHidden: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  suggestionTouchTarget: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    marginRight: Spacing.sm,
  },
  hintTarget: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  temporaryTarget: {
    minHeight: 44,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  suggestionText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
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
  pinControl: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
  },
  pinArmed: {
    backgroundColor: Colors.accentSoft,
  },
  pinActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
});
