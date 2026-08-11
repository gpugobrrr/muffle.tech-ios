import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import {
  defaultSuggestionGridItem,
  SvyrSuggestionGrid,
} from '@/components/svyr-suggestion-grid';
import {
  HORIZONTAL_HOLD_CANCEL_DISTANCE,
  SvyrNavigationItem,
} from '@/components/svyr-navigation-item';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useDirectorySwipe } from '@/hooks/use-directory-swipe';
import type { CommandSuggestion } from '@/lib/command-parser';
import { navigationItemsFromSuggestions } from '@/lib/svyr-navigation';

const SUGGESTED_COMMAND_LONG_PRESS_MS = 350;
/** Minimal top inset — navigation fills the stage; no ergonomic centering offset. */
const NAVIGATION_CONTENT_PADDING_TOP = Spacing.sm;
const NAVIGATION_CONTENT_PADDING_BOTTOM = Spacing.md;

type Props = {
  path: readonly string[];
  suggestions: readonly CommandSuggestion[];
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
 * Shared SVYR navigation-page template for root and every navigation container.
 * Items are derived from the canonical command graph via `suggestions`.
 */
export function SvyrNavigationPage({
  path,
  suggestions,
  temporaryContent = null,
  onApplySuggestion,
  onNavigateUpDirectory,
  onSwipeBackCommitted,
}: Props) {
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
  }, [path, suggestions, temporaryContent]);

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

  const navigationItems = navigationItemsFromSuggestions(suggestions);
  const suggestionById = new Map(suggestions.map((item) => [item.id, item]));

  const renderGridItem = (
    item: (typeof navigationItems)[number],
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

    return defaultSuggestionGridItem(
      item,
      align,
      {
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
      },
    );
  };

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.page}>
        {heldSuggestion ? (
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
          items={navigationItems}
          contentKey={`${path.join('/')}|${navigationItems.map((item) => item.id).join('|')}`}
          paddingTop={NAVIGATION_CONTENT_PADDING_TOP}
          paddingBottom={NAVIGATION_CONTENT_PADDING_BOTTOM}
          fillAvailableHeight
          renderItem={renderGridItem}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  page: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flex: 1,
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
