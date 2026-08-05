import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputSelectionChangeEventData,
} from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import {
  shouldAtomicallyDeleteOnBackspace,
} from '@/lib/command-edit';
import {
  DISPLAY_SEPARATOR,
  PATH_SEPARATOR,
  formatCommandPath,
  formatSvyrCommandForDisplay,
  formatSvyrPathForDisplay,
} from '@/lib/command-registry';

export type WorkspaceTerminalProps = {
  value: string;
  onChangeText: (value: string) => void;
  onRun: () => void;
  onDeletePreviousPart: () => void;
  pinnedCommandPrefix?: string[];
  focusToken?: number;
  /** Power Mode — open keyboard on mount and restore after intentional actions. */
  persistFocus?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
};

/**
 * Constant SVYR > command line — sole editable command interface.
 */
export function WorkspaceTerminal({
  value,
  onChangeText,
  onRun,
  onDeletePreviousPart,
  pinnedCommandPrefix = [],
  focusToken = 0,
  persistFocus = false,
  autoFocus = false,
  disabled = false,
}: WorkspaceTerminalProps) {
  const terminalInputRef = useRef<TextInput>(null);
  const valueRef = useRef(value);
  const selectionRef = useRef({ start: 0, end: 0 });
  const atomicBackspaceRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const [cursorOn, setCursorOn] = useState(true);
  // Applied once after a programmatic command change, then released so typing
  // and manual cursor movement stay uncontrolled.
  const [caretToEnd, setCaretToEnd] = useState<{
    start: number;
    end: number;
  } | null>(null);

  valueRef.current = value;

  const hasPinned = pinnedCommandPrefix.length > 0;
  const pinnedPathLabel = formatCommandPath(pinnedCommandPrefix);
  // Pin and suffix are joined by a structural separator only when the suffix
  // opens a new segment — the same rule `composeFullCommand` parses with.
  const pinJoinsSuffix =
    value.length > 0 &&
    !value.startsWith(' ') &&
    !value.startsWith(PATH_SEPARATOR);
  const pinnedDisplay = `${formatSvyrPathForDisplay(pinnedPathLabel)}${
    pinJoinsSuffix ? DISPLAY_SEPARATOR : ''
  }`;
  const active = focused || value.length > 0 || hasPinned;
  const canRun = !disabled && value.trim().length > 0;

  const focusTerminal = useCallback(() => {
    if (!persistFocus) {
      terminalInputRef.current?.focus();
      return;
    }
    requestAnimationFrame(() => {
      terminalInputRef.current?.focus();
    });
  }, [persistFocus]);

  useEffect(() => {
    if (!active) {
      setCursorOn(true);
      return;
    }
    const id = setInterval(() => setCursorOn((v) => !v), 530);
    return () => clearInterval(id);
  }, [active]);

  // Entering / re-entering persistent Power Mode focus.
  useEffect(() => {
    if (!persistFocus && !autoFocus) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      terminalInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [persistFocus, autoFocus]);

  // Intentional re-focus after commands / suggestions / directory changes.
  useEffect(() => {
    if (!focusToken) return;
    focusTerminal();
    const end = valueRef.current.length;
    setCaretToEnd({ start: end, end });
  }, [focusToken, focusTerminal]);

  // Restore focus when returning to the foreground in Power Mode.
  useEffect(() => {
    if (!persistFocus) return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        focusTerminal();
      }
    });

    return () => subscription.remove();
  }, [focusTerminal, persistFocus]);

  const a11yLabel = hasPinned
    ? `Survey command input. Pinned prefix ${pinnedPathLabel}.`
    : 'Survey command input';

  const handleSelectionChange = (
    event: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    selectionRef.current = event.nativeEvent.selection;
    if (caretToEnd) {
      setCaretToEnd(null);
    }
  };

  const handleKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (event.nativeEvent.key !== 'Backspace') {
      atomicBackspaceRef.current = false;
      return;
    }

    const selection = selectionRef.current;
    const current = valueRef.current;
    const collapsed = selection.start === selection.end;
    const atEnd = collapsed && selection.start === current.length;

    atomicBackspaceRef.current =
      atEnd && shouldAtomicallyDeleteOnBackspace(current, pinnedCommandPrefix);
  };

  const handleChangeText = (next: string) => {
    const prev = valueRef.current;

    if (atomicBackspaceRef.current) {
      atomicBackspaceRef.current = false;
      const isSingleCharEndDelete =
        next.length === prev.length - 1 && prev.startsWith(next);

      if (
        isSingleCharEndDelete &&
        shouldAtomicallyDeleteOnBackspace(prev, pinnedCommandPrefix)
      ) {
        onDeletePreviousPart();
        return;
      }
    }

    onChangeText(next);
  };

  return (
    <View style={styles.terminal}>
      <View style={styles.cliRow}>
        <Pressable
          style={styles.cli}
          disabled={disabled}
          onPress={focusTerminal}
          accessibilityRole="none">
          <Text style={styles.prompt}>SVYR {'>'}</Text>
          <View style={styles.field}>
            <View style={styles.visibleLine} pointerEvents="none">
              {hasPinned ? (
                <Text style={styles.pinnedPrefix}>{pinnedDisplay}</Text>
              ) : null}
              <Text style={styles.commandText}>
                {formatSvyrCommandForDisplay(value)}
              </Text>
              {active ? (
                <View style={[styles.cursor, { opacity: cursorOn ? 1 : 0 }]} />
              ) : null}
            </View>
            <TextInput
              ref={terminalInputRef}
              value={value}
              onChangeText={handleChangeText}
              onKeyPress={handleKeyPress}
              onSelectionChange={handleSelectionChange}
              selection={caretToEnd ?? undefined}
              onSubmitEditing={onRun}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              editable={!disabled}
              autoFocus={autoFocus || persistFocus}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="go"
              submitBehavior="submit"
              blurOnSubmit={false}
              caretHidden
              // Focus is driven by the surrounding Pressable, so the invisible
              // input never needs touches. Keeping it out of hit-testing stops
              // iOS text-selection recognisers from consuming the dock's
              // directory swipe.
              pointerEvents="none"
              style={styles.hiddenInput}
              accessibilityLabel={a11yLabel}
            />
          </View>
        </Pressable>

        <Pressable
          disabled={!canRun}
          onPress={onRun}
          accessibilityRole="button"
          accessibilityLabel="Run survey command"
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          style={({ pressed }) => [
            styles.runBtn,
            !canRun && styles.runBtnDisabled,
            pressed && canRun && styles.pressed,
          ]}>
          <Text style={[styles.runText, !canRun && styles.runTextDisabled]}>
            RUN
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  terminal: {
    backgroundColor: Colors.canvas,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  cliRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 36,
    paddingHorizontal: Spacing.md,
  },
  cli: {
    flex: 1,
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
  },
  commandText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
  },
  cursor: {
    width: 2,
    height: 12,
    marginLeft: 1,
    backgroundColor: Colors.accent,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  runBtn: {
    minWidth: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.sm,
  },
  runBtnDisabled: {
    opacity: 0.45,
  },
  runText: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.accent,
    letterSpacing: 1.2,
  },
  runTextDisabled: {
    color: Colors.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
});
