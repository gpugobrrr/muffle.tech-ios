import { useCallback, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import {
  SvyrNavigationItem,
  type SvyrNavigationItemProps,
} from '@/components/svyr-navigation-item';
import {
  getNavigationScrollState,
  toNavigationColumns,
} from '@/lib/svyr-navigation';

const GROUP_FADE_IN_MS = 160;
const GROUP_FADE_OUT_MS = 120;

export type SvyrSuggestionGridItem = Omit<
  SvyrNavigationItemProps,
  'align' | 'onPress' | 'onLongPress' | 'onPressIn' | 'onTouchMove' | 'onPressOut' | 'onTouchCancel' | 'delayLongPress'
>;

type Props = {
  items: readonly SvyrSuggestionGridItem[];
  contentKey: string;
  paddingTop: number;
  paddingBottom?: number;
  /** Expand to the full central workspace height (navigation template). */
  fillAvailableHeight?: boolean;
  renderItem: (
    item: SvyrSuggestionGridItem,
    align: 'left' | 'right',
  ) => ReactNode;
};

type NavigationColumnProps = {
  items: readonly SvyrSuggestionGridItem[];
  align: 'left' | 'right';
  contentKey: string;
  paddingTop: number;
  paddingBottom: number;
  fillAvailableHeight: boolean;
  renderItem: Props['renderItem'];
};

function NavigationColumn({
  items,
  align,
  contentKey,
  paddingTop,
  paddingBottom,
  fillAvailableHeight,
  renderItem,
}: NavigationColumnProps) {
  const [scrollOffsetY, setScrollOffsetY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const { canScrollUp, canScrollDown } = getNavigationScrollState({
    offsetY: scrollOffsetY,
    viewportHeight,
    contentHeight,
  });

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrollOffsetY(event.nativeEvent.contentOffset.y);
    },
    [],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
  }, []);

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      setContentHeight(height);
    },
    [],
  );

  return (
    <View
      style={[
        styles.columnContainer,
        fillAvailableHeight ? styles.columnContainerFill : null,
      ]}>
      <ScrollView
        style={[
          styles.columnScroll,
          fillAvailableHeight ? styles.columnScrollFill : null,
        ]}
        contentContainerStyle={[
          styles.columnScrollContent,
          {
            paddingTop,
            paddingBottom,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onLayout={handleLayout}
        onContentSizeChange={handleContentSizeChange}>
        <Animated.View
          key={contentKey}
          entering={FadeIn.duration(GROUP_FADE_IN_MS)}
          exiting={FadeOut.duration(GROUP_FADE_OUT_MS)}
          style={styles.columnItems}>
          {items.map((item) => renderItem(item, align))}
        </Animated.View>
      </ScrollView>

      {canScrollUp ? (
        <View
          pointerEvents="none"
          style={styles.columnIndicatorTop}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Text style={styles.columnIndicatorText}>^</Text>
        </View>
      ) : null}

      {canScrollDown ? (
        <View
          pointerEvents="none"
          style={styles.columnIndicatorBottom}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Text style={styles.columnIndicatorText}>⌄</Text>
        </View>
      ) : null}
    </View>
  );
}

export function SvyrSuggestionGrid({
  items,
  contentKey,
  paddingTop,
  paddingBottom = Spacing.xl,
  fillAvailableHeight = false,
  renderItem,
}: Props) {
  const { left, right } = toNavigationColumns(items);

  return (
    <View
      style={[
        styles.gridContainer,
        fillAvailableHeight ? styles.gridContainerFill : null,
      ]}>
      <View
        style={[
          styles.columnsWrap,
          fillAvailableHeight ? styles.columnsWrapFill : null,
        ]}>
        <NavigationColumn
          items={left}
          align="left"
          contentKey={`${contentKey}-left`}
          paddingTop={paddingTop}
          paddingBottom={paddingBottom}
          fillAvailableHeight={fillAvailableHeight}
          renderItem={renderItem}
        />
        <NavigationColumn
          items={right}
          align="right"
          contentKey={`${contentKey}-right`}
          paddingTop={paddingTop}
          paddingBottom={paddingBottom}
          fillAvailableHeight={fillAvailableHeight}
          renderItem={renderItem}
        />
      </View>
    </View>
  );
}

export function defaultSuggestionGridItem(
  item: SvyrSuggestionGridItem,
  align: 'left' | 'right',
  handlers: Pick<
    SvyrNavigationItemProps,
    | 'onPress'
    | 'onLongPress'
    | 'onPressIn'
    | 'onTouchMove'
    | 'onPressOut'
    | 'onTouchCancel'
    | 'delayLongPress'
  >,
) {
  return (
    <SvyrNavigationItem
      key={item.id}
      {...item}
      align={align}
      {...handlers}
    />
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    width: '100%',
  },
  gridContainerFill: {
    flex: 1,
  },
  columnsWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  columnsWrapFill: {
    flex: 1,
  },
  columnContainer: {
    width: '32%',
    position: 'relative',
  },
  columnContainerFill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  columnScroll: {
    width: '100%',
  },
  columnScrollFill: {
    flex: 1,
  },
  columnScrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  columnItems: {
    width: '100%',
    gap: Spacing.xs,
  },
  columnIndicatorTop: {
    position: 'absolute',
    top: Spacing.xs,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  columnIndicatorBottom: {
    position: 'absolute',
    bottom: Spacing.xs,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  columnIndicatorText: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.textMuted,
    letterSpacing: 0.4,
    lineHeight: Type.label + 2,
  },
});
