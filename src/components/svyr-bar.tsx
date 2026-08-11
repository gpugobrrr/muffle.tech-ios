import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Type } from '@/constants/theme';
import {
  DISPLAY_SEPARATOR,
  formatCommandPath,
  formatSvyrPathForDisplay,
} from '@/lib/command-registry';
import { SVYR_BAR_LAYOUT } from '@/lib/svyr-bar-navigation';

export { SVYR_BAR_LAYOUT } from '@/lib/svyr-bar-navigation';

/** Deliberate hold before the invisible pin action fires. */
const PIN_LONG_PRESS_MS = 450;
const FINAL_COMMAND_LONG_PRESS_MS = 350;

export type SvyrBarProps = {
  pinnedCommandPrefix?: string[];
  /** Recognised structural segments — never free-text values. */
  path: string[];
  /** Long-press on the structural path — the only pin affordance. */
  onToggleCurrentPathPin: () => void;
  canPinCurrentPath?: boolean;
  isCurrentPathPinned?: boolean;
  /** Temporary input guidance for the final data-entry directory token. */
  finalCommandDescription?: string;
  onFinalCommandHoldChange?: (description: string | null) => void;
  /** Editable segment index relative to the unpinned path. */
  onSegmentPress?: (index: number) => void;
  /** Navigate to the editable SVYR root (never below root). */
  onRootPress?: () => void;
};

/**
 * The single SVYR path bar used by navigation and every capture primitive.
 *
 * Owns prompt typography, separators, segment press targets, and dock-row
 * geometry. Pages supply path state and navigation handlers only.
 */
export function SvyrBar({
  pinnedCommandPrefix = [],
  path,
  onToggleCurrentPathPin,
  canPinCurrentPath = false,
  isCurrentPathPinned = false,
  finalCommandDescription,
  onFinalCommandHoldChange,
  onSegmentPress,
  onRootPress,
}: SvyrBarProps) {
  const finalLongPressRef = useRef(false);
  const finalPressStartXRef = useRef<number | null>(null);
  const pathKey = path.join('/');
  const commandLabel =
    formatCommandPath([...pinnedCommandPrefix, ...path]) || 'empty';
  const displayTokens = [...pinnedCommandPrefix, ...path]
    .map((token, index) => ({
      token: formatSvyrPathForDisplay(token.trim()),
      pinned: index < pinnedCommandPrefix.length,
    }))
    .filter(({ token }) => Boolean(token));

  useEffect(() => {
    finalLongPressRef.current = false;
    onFinalCommandHoldChange?.(null);
  }, [pathKey, finalCommandDescription, onFinalCommandHoldChange]);

  return (
    <View style={styles.bar} testID="svyr-bar">
      <View style={styles.commandRow}>
        <Pressable
          style={styles.commandPathContainer}
          pointerEvents={onSegmentPress || onRootPress ? 'box-none' : 'auto'}
          onLongPress={
            canPinCurrentPath
              ? () => {
                  if (!finalLongPressRef.current) onToggleCurrentPathPin();
                }
              : undefined
          }
          delayLongPress={PIN_LONG_PRESS_MS}
          disabled={!canPinCurrentPath && !onSegmentPress && !onRootPress}
          accessible={!onSegmentPress && !onRootPress}
          accessibilityRole="text"
          accessibilityLabel={`Survey command ${commandLabel}`}
          accessibilityActions={
            canPinCurrentPath
              ? [
                  {
                    name: 'activate',
                    label: isCurrentPathPinned
                      ? 'Unpin current path'
                      : 'Pin current path',
                  },
                ]
              : undefined
          }
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'activate') {
              onToggleCurrentPathPin();
            }
          }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to SVYR root"
            hitSlop={SVYR_BAR_LAYOUT.hitSlop}
            disabled={!onRootPress}
            onPress={onRootPress}
            style={styles.rootPressable}>
            <Text style={styles.prompt}>SVYR {'>'}</Text>
          </Pressable>
          <View style={styles.field}>
            <View style={styles.visibleLine}>
              {displayTokens.map(({ token, pinned }, index) => {
                const isEditableSegment = index >= pinnedCommandPrefix.length;
                const editableIndex = index - pinnedCommandPrefix.length;
                const isFinalEditableSegment =
                  isEditableSegment && index === displayTokens.length - 1;
                const segmentStyle = pinned
                  ? styles.pinnedPrefix
                  : styles.commandText;
                const content = (
                  <View style={styles.segmentContent}>
                    {index === 0 ? null : (
                      <Text style={segmentStyle}>{DISPLAY_SEPARATOR}</Text>
                    )}
                    <Text style={segmentStyle}>{token}</Text>
                  </View>
                );

                if (!isEditableSegment || !onSegmentPress) {
                  return (
                    <View key={`${token}:${index}`} style={styles.segmentContent}>
                      {index === 0 ? null : (
                        <Text style={segmentStyle}>{DISPLAY_SEPARATOR}</Text>
                      )}
                      <Text style={segmentStyle}>{token}</Text>
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={`${token}:${index}`}
                    hitSlop={SVYR_BAR_LAYOUT.hitSlop}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isFinalEditableSegment
                        ? `Back from ${token}`
                        : `Go to ${token}`
                    }
                    onPressIn={(event) => {
                      finalPressStartXRef.current = event.nativeEvent.pageX;
                      finalLongPressRef.current = false;
                    }}
                    onPress={() => {
                      if (!finalLongPressRef.current) {
                        onSegmentPress(editableIndex);
                      }
                    }}
                    onLongPress={
                      isFinalEditableSegment && finalCommandDescription
                        ? () => {
                            finalLongPressRef.current = true;
                            onFinalCommandHoldChange?.(finalCommandDescription);
                          }
                        : undefined
                    }
                    delayLongPress={FINAL_COMMAND_LONG_PRESS_MS}
                    onTouchMove={(event) => {
                      const startX = finalPressStartXRef.current;
                      if (
                        startX !== null &&
                        Math.abs(event.nativeEvent.pageX - startX) > 10
                      ) {
                        finalLongPressRef.current = true;
                        onFinalCommandHoldChange?.(null);
                      }
                    }}
                    onPressOut={() => {
                      finalPressStartXRef.current = null;
                      if (isFinalEditableSegment) {
                        onFinalCommandHoldChange?.(null);
                      }
                    }}
                    onTouchCancel={() => {
                      finalPressStartXRef.current = null;
                      finalLongPressRef.current = true;
                      onFinalCommandHoldChange?.(null);
                    }}
                    style={styles.segmentPressable}>
                    {content}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: SVYR_BAR_LAYOUT.paddingVertical,
    paddingBottom: SVYR_BAR_LAYOUT.paddingVertical,
    backgroundColor: Colors.canvas,
  },
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: SVYR_BAR_LAYOUT.minHeight,
    paddingHorizontal: SVYR_BAR_LAYOUT.paddingHorizontal,
  },
  commandPathContainer: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SVYR_BAR_LAYOUT.pathGap,
    minHeight: SVYR_BAR_LAYOUT.pathMinHeight,
  },
  rootPressable: {
    flexShrink: 0,
  },
  prompt: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  field: {
    flex: 1,
    minHeight: SVYR_BAR_LAYOUT.pathMinHeight,
    justifyContent: 'center',
  },
  segmentPressable: {
    flexShrink: 1,
  },
  segmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visibleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  pinnedPrefix: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.textSecondary,
  },
  commandText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
  },
});
