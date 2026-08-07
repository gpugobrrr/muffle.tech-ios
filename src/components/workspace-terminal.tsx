import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import {
    DISPLAY_SEPARATOR,
    formatCommandPath,
    formatSvyrPathForDisplay,
} from '@/lib/command-registry';

/** Deliberate hold before the invisible pin action fires. */
const PIN_LONG_PRESS_MS = 450;

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
}: WorkspaceTerminalProps) {
  const hasPinned = pinnedCommandPrefix.length > 0;
  const pinnedPathLabel = formatCommandPath(pinnedCommandPrefix);
  const pinnedDisplay = `${formatSvyrPathForDisplay(pinnedPathLabel)}${
    editablePath.length > 0 ? DISPLAY_SEPARATOR : ''
  }`;
  const pathDisplay = formatSvyrPathForDisplay(formatCommandPath(editablePath));
  const commandLabel =
    formatCommandPath([...pinnedCommandPrefix, ...editablePath]) || 'empty';

  return (
    <View style={[styles.terminal, !embedded && styles.navigationTerminal]}>
      <View
        style={[
          styles.commandRow,
          embedded ? styles.embeddedCommandRow : null,
        ]}>
        <Pressable
          style={styles.commandPathContainer}
          onLongPress={canPinCurrentPath ? onToggleCurrentPathPin : undefined}
          delayLongPress={PIN_LONG_PRESS_MS}
          disabled={!canPinCurrentPath}
          accessible
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
