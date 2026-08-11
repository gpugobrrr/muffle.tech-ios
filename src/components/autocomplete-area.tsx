import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import {
  defaultSuggestionGridItem,
  SvyrSuggestionGrid,
  type SvyrSuggestionGridItem,
} from '@/components/svyr-suggestion-grid';
import { SvyrChoiceItem } from '@/components/svyr-choice-item';
import {
  HORIZONTAL_HOLD_CANCEL_DISTANCE,
  SvyrNavigationItem,
} from '@/components/svyr-navigation-item';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useDirectorySwipe } from '@/hooks/use-directory-swipe';
import type { MultiChoiceSuggestion } from '@/lib/multi-choice';
import type { SingleChoiceSuggestion } from '@/lib/single-choice';
import type { CommandSuggestion } from '@/lib/command-parser';

const SUGGESTED_COMMAND_LONG_PRESS_MS = 350;
const ERGONOMIC_START_RATIO = 0.18;
const ERGONOMIC_START_MAX = 120;

type AutocompleteSuggestion =
  | CommandSuggestion
  | SingleChoiceSuggestion
  | MultiChoiceSuggestion;

type Props<Suggestion extends AutocompleteSuggestion> = {
  suggestions: readonly Suggestion[];
  temporaryContent?: string | null;
  onApplySuggestion: (suggestion: Suggestion) => void;
  onNavigateUpDirectory?: () => boolean;
  onSwipeBackCommitted?: () => void;
};

function heldDescriptionFor(suggestion: AutocompleteSuggestion): string {
  if (suggestion.type === 'input-hint') {
    return suggestion.description ?? suggestion.label;
  }
  return suggestion.description;
}

function toGridItem(suggestion: AutocompleteSuggestion): SvyrSuggestionGridItem {
  if (suggestion.type === 'input-hint') {
    return {
      id: suggestion.id,
      label: suggestion.label,
      description: suggestion.description ?? suggestion.label,
      available: true,
      kind: 'hint',
    };
  }

  if (suggestion.type === 'choice') {
    return {
      id: suggestion.id,
      label: suggestion.label,
      description: suggestion.description,
      available: suggestion.available,
      selected: suggestion.selected,
      kind: 'choice',
    };
  }

  if (suggestion.type === 'multi-commit') {
    return {
      id: suggestion.id,
      label: suggestion.label,
      description: suggestion.description,
      available: suggestion.available,
      kind: 'navigation',
      presentation: 'entry',
    };
  }

  return {
    id: suggestion.id,
    label: suggestion.label,
    description: suggestion.description,
    available: suggestion.available,
    kind: 'navigation',
  };
}

/**
 * Sparse suggestion surface for controlled capture pages.
 * Navigation containers use `SvyrNavigationPage` instead.
 */
export function AutocompleteArea<Suggestion extends AutocompleteSuggestion>({
  suggestions,
  temporaryContent = null,
  onApplySuggestion,
  onNavigateUpDirectory,
  onSwipeBackCommitted,
}: Props<Suggestion>) {
  const { height } = useWindowDimensions();
  const ergonomicStart = Math.min(
    Math.max(height * ERGONOMIC_START_RATIO, Spacing.lg),
    ERGONOMIC_START_MAX,
  );
  const [heldSuggestionId, setHeldSuggestionId] = useState<string | null>(null);
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
            suggestion.type !== 'input-hint' &&
            suggestion.id === heldSuggestionId,
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

  const gridItems = suggestions.map(toGridItem);
  const suggestionById = new Map(suggestions.map((item) => [item.id, item]));

  const renderGridItem = (
    item: SvyrSuggestionGridItem,
    align: 'left' | 'right',
  ) => {
    if (item.kind === 'hint') {
      return (
        <SvyrNavigationItem
          key={item.id}
          id={item.id}
          label={item.label}
          description={item.description}
          available={item.available}
          align={align}
          kind="hint"
        />
      );
    }

    const suggestion = suggestionById.get(item.id);
    if (!suggestion || suggestion.type === 'input-hint') {
      return null;
    }

    if (item.kind === 'choice') {
      return (
        <SvyrChoiceItem
          key={item.id}
          id={item.id}
          label={item.label}
          description={item.description}
          available={item.available}
          selected={item.selected}
          align={align}
          onPress={() => {
            if (holdSelectSuppressRef.current) return;
            onApplySuggestion(suggestion);
          }}
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
          onLongPress={() => {
            if (longPressCancelledRef.current) return;
            holdSelectSuppressRef.current = true;
            setHeldSuggestionId(item.id);
          }}
          onPressOut={() => {
            requestAnimationFrame(() => {
              clearHeldSuggestion();
            });
          }}
          onTouchCancel={clearHeldSuggestion}
          delayLongPress={SUGGESTED_COMMAND_LONG_PRESS_MS}
        />
      );
    }

    return defaultSuggestionGridItem(item, align, {
      onPress: () => {
        if (holdSelectSuppressRef.current) return;
        onApplySuggestion(suggestion);
      },
      onPressIn: (event: GestureResponderEvent) => {
        holdSelectSuppressRef.current = false;
        longPressCancelledRef.current = false;
        pressStartRef.current = {
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
        };
      },
      onTouchMove: (event: GestureResponderEvent) => {
        const start = pressStartRef.current;
        if (
          start &&
          Math.abs(event.nativeEvent.pageX - start.x) >=
            HORIZONTAL_HOLD_CANCEL_DISTANCE
        ) {
          cancelLongPressForSwipe();
        }
      },
      onLongPress: () => {
        if (longPressCancelledRef.current) return;
        holdSelectSuppressRef.current = true;
        setHeldSuggestionId(item.id);
      },
      onPressOut: () => {
        requestAnimationFrame(() => {
          clearHeldSuggestion();
        });
      },
      onTouchCancel: clearHeldSuggestion,
      delayLongPress: SUGGESTED_COMMAND_LONG_PRESS_MS,
    });
  };

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.autocompleteArea}>
        {heldSuggestion && heldSuggestion.type !== 'input-hint' ? (
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

        <SvyrSuggestionGrid
          items={gridItems}
          contentKey={gridItems.map((item) => item.id).join('|')}
          paddingTop={ergonomicStart}
          renderItem={renderGridItem}
        />
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
  temporaryTarget: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 1,
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
