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
} from '@/components/svyr-navigation-item';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useDirectorySwipe } from '@/hooks/use-directory-swipe';
import type { FindingHubItem } from '@/lib/finding-hub';
import type { SvyrNavigationItemModel } from '@/lib/svyr-navigation';

const SUGGESTED_COMMAND_LONG_PRESS_MS = 350;
const NAVIGATION_CONTENT_PADDING_TOP = Spacing.sm;
const NAVIGATION_CONTENT_PADDING_BOTTOM = Spacing.md;

type Props = {
  path: readonly string[];
  items: readonly FindingHubItem[];
  temporaryContent?: string | null;
  onSelectNewFinding: () => void;
  onSelectFinding: (findingId: string) => void;
  onNavigateUpDirectory?: () => boolean;
  onSwipeBackCommitted?: () => void;
};

/**
 * Finding hub navigation page for multi-finding elements (e.g. External walls).
 * Reuses the existing SVYR two-column navigation grid, typography, touch targets,
 * and gestures. Never introduces cards, icons, or non-SVYR styles.
 */
export function FindingHubPage({
  path,
  items,
  temporaryContent = null,
  onSelectNewFinding,
  onSelectFinding,
  onNavigateUpDirectory,
  onSwipeBackCommitted,
}: Props) {
  const [heldItemId, setHeldItemId] = useState<string | null>(null);
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

  useEffect(() => {
    return () => {
      holdSelectSuppressRef.current = false;
    };
  }, []);

  useEffect(() => {
    setHeldItemId(null);
    holdSelectSuppressRef.current = false;
  }, [path, items, temporaryContent]);

  const clearHeldItem = () => {
    setHeldItemId(null);
    holdSelectSuppressRef.current = false;
    pressStartRef.current = null;
    longPressCancelledRef.current = false;
  };

  const cancelLongPressForSwipe = () => {
    setHeldItemId(null);
    longPressCancelledRef.current = true;
  };

  const navigationItems: SvyrNavigationItemModel[] = items.map((item) => {
    if (item.kind === 'new-finding') {
      return {
        id: 'new-finding',
        label: 'NEW FINDING',
        description: 'Record a new finding observation',
        available: true,
        kind: 'navigation',
        presentation: 'entry',
      };
    }
    return {
      id: item.findingId,
      label: item.humanLabel,
      description: 'Open finding details',
      available: true,
      kind: 'navigation',
      presentation: 'navigation',
    };
  });

  const heldItem = heldItemId
    ? navigationItems.find((item) => item.id === heldItemId)
    : null;

  const renderGridItem = (
    item: (typeof navigationItems)[number],
    align: 'left' | 'right',
  ) => {
    return defaultSuggestionGridItem(
      item,
      align,
      {
        onPress: () => {
          if (holdSelectSuppressRef.current) return;
          if (item.id === 'new-finding') {
            onSelectNewFinding();
          } else {
            onSelectFinding(item.id);
          }
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
          setHeldItemId(item.id);
        },
        onPressOut: () => {
          requestAnimationFrame(() => {
            clearHeldItem();
          });
        },
        onTouchCancel: clearHeldItem,
        delayLongPress: SUGGESTED_COMMAND_LONG_PRESS_MS,
      },
    );
  };

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.page}>
        {heldItem ? (
          <View
            pointerEvents="none"
            style={styles.explanationWorkspace}
            accessibilityElementsHidden>
            <Text style={styles.explanationText}>
              {heldItem.description}
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
          contentKey={`${path.join('/')}|hub|${navigationItems.map((item) => item.id).join('|')}`}
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
