import { Fragment, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import {
    DISPLAY_SEPARATOR,
    formatCommandPath,
    formatSvyrPathForDisplay,
} from '@/lib/command-registry';

/** Deliberate hold before the invisible pin action fires. */
const PIN_LONG_PRESS_MS = 450;
const FINAL_COMMAND_LONG_PRESS_MS = 350;

export type WorkspaceTerminalProps = {
  pinnedCommandPrefix?: string[];
  /** Recognised structural segments — never editable. */
  editablePath: string[];
  /** Long-press on the structural path — the only pin affordance. */
  onToggleCurrentPathPin: () => void;
  canPinCurrentPath?: boolean;
  isCurrentPathPinned?: boolean;
  /** Render inside the darker value-entry surface. */
  embedded?: boolean;
  /** Temporary input guidance for the final data-entry directory token. */
  finalCommandDescription?: string;
  onFinalCommandHoldChange?: (description: string | null) => void;
  onSegmentPress?: (index: number) => void;
};

/**
 * Navigation-mode SVYR > command line.
 *
 * Read-only structural context only. The command line remains mounted at the
 * bottom of the workspace during data entry, while the dedicated entry panel
 * sits above it. Long-press pins; there is no keyboard, caret, RUN, PIN, or
 * ESC control.
 */
export function WorkspaceTerminal({
  pinnedCommandPrefix = [],
  editablePath,
  onToggleCurrentPathPin,
  canPinCurrentPath = false,
  isCurrentPathPinned = false,
  embedded = false,
  finalCommandDescription,
  onFinalCommandHoldChange,
  onSegmentPress,
}: WorkspaceTerminalProps) {
  const finalLongPressRef = useRef(false);
  const finalPressStartXRef = useRef<number | null>(null);
  const hasPinned = pinnedCommandPrefix.length > 0;
  const pinnedPathLabel = formatCommandPath(pinnedCommandPrefix);
  const pinnedDisplay = `${formatSvyrPathForDisplay(pinnedPathLabel)}${
    editablePath.length > 0 ? DISPLAY_SEPARATOR : ''
  }`;
  const pathDisplay = formatSvyrPathForDisplay(formatCommandPath(editablePath));
  const commandLabel =
    formatCommandPath([...pinnedCommandPrefix, ...editablePath]) || 'empty';
  const displayTokens = [...pinnedCommandPrefix, ...editablePath]
    .map((token, index) => ({
      token: formatSvyrPathForDisplay(token.trim()),
      pinned: index < pinnedCommandPrefix.length,
    }))
    .filter(({ token }) => Boolean(token));

  useEffect(() => {
    finalLongPressRef.current = false;
    onFinalCommandHoldChange?.(null);
  }, [editablePath.join('/'), finalCommandDescription, onFinalCommandHoldChange]);

  return (
    <View
      style={[
        styles.terminal,
        embedded ? styles.embeddedTerminal : styles.navigationTerminal,
      ]}>
      <View
        style={[
          styles.commandRow,
          embedded ? styles.embeddedCommandRow : null,
        ]}>
        <Pressable
          style={[
            styles.commandPathContainer,
            embedded ? styles.embeddedCommandPathContainer : null,
          ]}
          pointerEvents={embedded && onSegmentPress ? 'box-none' : 'auto'}
          onLongPress={
            canPinCurrentPath
              ? () => {
                  if (!finalLongPressRef.current) onToggleCurrentPathPin();
                }
              : undefined
          }
          delayLongPress={PIN_LONG_PRESS_MS}
          disabled={!canPinCurrentPath && !embedded}
          accessible={!(embedded && onSegmentPress)}
          accessibilityRole={embedded && onSegmentPress ? undefined : 'text'}
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
          {embedded ? (
            <View style={styles.embeddedSequence}>
              <View style={styles.leadingContent}>
                <Text style={styles.prompt}>SVYR {'>'}</Text>
                {displayTokens.map(({ token, pinned }, index) => {
                  const isEditableSegment = index >= pinnedCommandPrefix.length;
                  const isFinalEditableSegment =
                    isEditableSegment && index === displayTokens.length - 1;
                  const segmentStyle = pinned
                    ? styles.pinnedPrefix
                    : isFinalEditableSegment
                      ? styles.finalCommand
                      : styles.commandText;

                  if (!isEditableSegment || !onSegmentPress) {
                    return (
                      <Fragment key={`${token}:${index}`}>
                        <Text style={segmentStyle}>{DISPLAY_SEPARATOR}</Text>
                        <Text style={segmentStyle}>{token}</Text>
                      </Fragment>
                    );
                  }

                  return (
                    <Pressable
                      key={`${token}:${index}`}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Return to ${token}`}
                      onPressIn={(event) => {
                        finalPressStartXRef.current = event.nativeEvent.pageX;
                        finalLongPressRef.current = false;
                      }}
                      onPress={() => {
                        if (!finalLongPressRef.current) onSegmentPress(index - pinnedCommandPrefix.length);
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
                      style={styles.finalCommandPressable}>
                      <View style={styles.segmentContent}>
                        <Text style={segmentStyle}>{DISPLAY_SEPARATOR}</Text>
                        <Text style={segmentStyle}>{token}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.prompt}>SVYR {'>'}</Text>
              <View style={styles.field}>
                <View style={styles.visibleLine}>
                  {hasPinned ? (
                    <Text style={styles.pinnedPrefix}>{pinnedDisplay}</Text>
                  ) : null}
                  {pathDisplay ? (
                    <Text style={styles.commandText}>{pathDisplay}</Text>
                  ) : null}
                </View>
              </View>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  terminal: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  navigationTerminal: {
    backgroundColor: Colors.canvas,
  },
  embeddedTerminal: {
    flex: 1,
    minWidth: 0,
  },
  /** No action column: the path owns the full row width. */
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 36,
    paddingHorizontal: Spacing.md,
  },
  embeddedCommandRow: {
    paddingHorizontal: 20,
  },
  commandPathContainer: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
  },
  embeddedCommandPathContainer: {
    justifyContent: 'flex-start',
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
    minHeight: 28,
    justifyContent: 'center',
  },
  leadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  embeddedSequence: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  finalCommand: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
  },
  finalCommandPressable: {
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
