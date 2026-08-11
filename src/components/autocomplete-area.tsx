import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { SvyrChoiceItem } from '@/components/svyr-choice-item';
import { SvyrNavigationItem } from '@/components/svyr-navigation-item';
import {
  SvyrSuggestionColumn,
  SvyrSuggestionGrid,
} from '@/components/svyr-suggestion-grid';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useDirectorySwipe } from '@/hooks/use-directory-swipe';
import type { CommandSuggestion } from '@/lib/command-parser';
import type { SvyrLabelPresentation } from '@/lib/svyr-label-presentation';

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
  /**
   * Visual grammar for token suggestions. Navigation uses `[label]`; capture
   * choices use `(label)`. Callers must set this explicitly — never inferred.
   */
  suggestionPresentation?: SvyrLabelPresentation;
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
  suggestionPresentation = 'navigation',
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

    if (suggestionPresentation === 'choice') {
      return (
        <SvyrChoiceItem
          key={suggestion.id}
          label={suggestion.label}
          available={isAvailable}
          align={align}
          onPress={
            isAvailable ? () => onApplySuggestion(suggestion) : undefined
          }
        />
      );
    }

    return (
      <SvyrNavigationItem
        key={suggestion.id}
        label={suggestion.label}
        available={isAvailable}
        align={align}
        holdDescription={heldDescriptionFor(suggestion)}
        onPress={
          isAvailable ? () => onApplySuggestion(suggestion) : undefined
        }
        onLongPressHold={() => setHeldSuggestionId(suggestion.id)}
        onLongPressRelease={() => setHeldSuggestionId(null)}
      />
    );
  };

  const midpoint = Math.ceil(suggestions.length / 2);

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

        <SvyrSuggestionGrid paddingTop={ergonomicStart}>
          <Animated.View
            key={suggestions.map((suggestion) => suggestion.id).join('|')}
            entering={FadeIn.duration(GROUP_FADE_IN_MS)}
            exiting={FadeOut.duration(GROUP_FADE_OUT_MS)}
            style={styles.suggestionsWrap}>
            <SvyrSuggestionColumn>
              {suggestions
                .slice(0, midpoint)
                .map((suggestion) => renderSuggestion(suggestion, 'left'))}
            </SvyrSuggestionColumn>
            <SvyrSuggestionColumn>
              {suggestions
                .slice(midpoint)
                .map((suggestion) => renderSuggestion(suggestion, 'right'))}
            </SvyrSuggestionColumn>
          </Animated.View>
        </SvyrSuggestionGrid>
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
  suggestionsWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
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
});
