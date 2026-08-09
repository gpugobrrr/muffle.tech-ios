import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { SvyrHint } from '@/components/svyr-hint';
import { SplitTextKeyboard } from '@/components/split-text-keyboard';
import { WorkspaceTerminal } from '@/components/workspace-terminal';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { ActiveEntryField } from '@/hooks/use-workspace';
import type { SvyrHintId } from '@/lib/hint-repository';

const SPACE_DOUBLE_TAP_MAX_DELAY_MS = 450;
const SPACE_DOUBLE_TAP_MAX_DISTANCE = 24;
const DATA_ENTRY_LINE_HEIGHT = 24;
const CARET_BLINK_MS = 700;

type Props = {
  field: ActiveEntryField;
  value: string;
  error: string | null;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onCancelEntry: () => boolean;
  focusToken?: number;
  activeHintId?: Extract<SvyrHintId, 'executeValue'> | null;
  onDismissHint?: (id: SvyrHintId) => void;
  pinnedCommandPrefix: string[];
  svyrDirectory: string[];
  canPinCurrentPath: boolean;
  isCurrentPathPinned: boolean;
  onToggleCurrentPathPin: () => void;
  onSegmentPress: (index: number) => void;
  notesSurface?: ReactNode;
  noteEditing?: boolean;
  noteValue?: string;
  onChangeNote?: (value: string) => void;
};

export function TextEntryPage({
  field,
  value,
  error,
  onChangeText,
  onSubmit,
  onCancelEntry,
  focusToken = 0,
  activeHintId = null,
  onDismissHint,
  pinnedCommandPrefix,
  svyrDirectory,
  canPinCurrentPath,
  isCurrentPathPinned,
  onToggleCurrentPathPin,
  onSegmentPress,
  notesSurface,
  noteEditing = false,
  noteValue = '',
  onChangeNote,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const valueRef = useRef(value);
  const [heldCommandDescription, setHeldCommandDescription] = useState<string | null>(
    null,
  );
  valueRef.current = value;

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      Keyboard.dismiss();
    });
  }, []);

  useEffect(() => {
    focusInput();
  }, [field.path.join('/'), focusInput, focusToken]);

  useEffect(() => {
    setHeldCommandDescription(null);
  }, [svyrDirectory.join('/')]);

  const handleKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (event.nativeEvent.key !== 'Backspace') return;
    // The shared page-level gesture owns empty-value navigation. Hardware
    // Backspace may still edit non-empty TextInput content.
    if (valueRef.current.length === 0) return;
  };

  const handleWorkspaceSpace = useCallback(() => {
    const currentValue = noteEditing ? noteValue : valueRef.current;
    if (currentValue.endsWith(' ')) return;
    const nextValue = `${currentValue} `;
    if (noteEditing) {
      onChangeNote?.(nextValue);
    } else {
      valueRef.current = nextValue;
      onChangeText(nextValue);
    }
  }, [noteEditing, noteValue, onChangeNote, onChangeText]);

  const spaceWorkspaceGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(SPACE_DOUBLE_TAP_MAX_DELAY_MS)
    .maxDistance(SPACE_DOUBLE_TAP_MAX_DISTANCE)
    .runOnJS(true)
    .onEnd((_event, success) => {
      if (success) handleWorkspaceSpace();
    });

  const entryLabel = field.node.entryLabel ?? field.node.token.toUpperCase();
  const finalCommandDescription = inputInstructionForField(field);
  const customKeyboardValue = noteEditing ? noteValue : value;
  const handleCustomKeyboardChange = noteEditing
    ? (nextValue: string) => onChangeNote?.(nextValue)
    : onChangeText;
  const handleCustomKeyboardSubmit = noteEditing ? () => undefined : onSubmit;

  return (
    <View style={[styles.dataEntryPanel, styles.flexDataEntryPanel]}>
      <View style={styles.dataEntryContext}>
        {notesSurface}
        <WorkspaceTerminal
          editablePath={svyrDirectory}
          pinnedCommandPrefix={pinnedCommandPrefix}
          onToggleCurrentPathPin={onToggleCurrentPathPin}
          finalCommandDescription={finalCommandDescription}
          onFinalCommandHoldChange={setHeldCommandDescription}
          onSegmentPress={onSegmentPress}
          canPinCurrentPath={canPinCurrentPath}
          isCurrentPathPinned={isCurrentPathPinned}
          embedded
        />
      </View>
      <View style={styles.entryStack}>
        <View style={styles.activeFieldWorkspace}>
          {heldCommandDescription ? (
            <View
              pointerEvents="none"
              style={styles.commandExplanationWorkspace}
              accessibilityElementsHidden>
              <Text style={styles.commandExplanationText}>
                {heldCommandDescription}
              </Text>
            </View>
          ) : null}
          <View style={styles.activeFieldBlock}>
            {error ? (
              <Text
                style={styles.dataEntryError}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            {activeHintId === 'executeValue' && onDismissHint ? (
              <View pointerEvents="box-none">
                <SvyrHint id="executeValue" onDismiss={onDismissHint} />
              </View>
            ) : null}

            <View style={styles.dataEntryInputShell}>
              <Pressable
                onPress={focusInput}
                accessibilityRole="none"
                accessibilityActions={[
                  { name: 'escape', label: 'Cancel data entry' },
                ]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'escape') onCancelEntry();
                }}
                style={styles.dataEntryInputRow}>
                <TextInput
                  ref={inputRef}
                  value={value}
                  onChangeText={onChangeText}
                  onKeyPress={handleKeyPress}
                  onSubmitEditing={onSubmit}
                  showSoftInputOnFocus={false}
                  autoFocus
                  autoCapitalize="words"
                  autoCorrect={false}
                  spellCheck={false}
                  returnKeyType="done"
                  submitBehavior="submit"
                  blurOnSubmit={false}
                  placeholder=""
                  caretHidden={value.length === 0}
                  style={styles.dataEntryInput}
                  accessibilityLabel={entryLabel}
                />
                {value.length === 0 ? <PulsingCaret /> : null}
              </Pressable>
            </View>
          </View>
        </View>
        <GestureDetector gesture={spaceWorkspaceGesture}>
          <View
            style={styles.spaceWorkspace}
            accessibilityLabel="Empty workspace. Double tap to insert a space."
          />
        </GestureDetector>
        <SplitTextKeyboard
          value={customKeyboardValue}
          onChangeText={handleCustomKeyboardChange}
          onSubmit={handleCustomKeyboardSubmit}
          showNumericMode
        />
      </View>
    </View>
  );
}

function inputInstructionForField(field: ActiveEntryField): string {
  const prompt = field.node.valuePrompt?.trim();
  if (prompt) {
    const withoutPrefix = prompt.replace(/^enter(?:\s+the)?\s+/i, '').trim();
    if (withoutPrefix) return `Enter the ${withoutPrefix.toLowerCase()}.`;
  }

  const label = field.node.entryLabel?.trim() || field.node.token;
  return `Enter the ${label.toLowerCase()}.`;
}

export function PulsingCaret() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: CARET_BLINK_MS / 2,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: CARET_BLINK_MS / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.inputCaret, { opacity }]}
      accessibilityElementsHidden
    />
  );
}

const styles = StyleSheet.create({
  dataEntryPanel: {
    width: '100%',
  },
  flexDataEntryPanel: {
    flex: 1,
    minHeight: 0,
  },
  dataEntryContext: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryStack: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  activeFieldWorkspace: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  activeFieldBlock: {
    width: '100%',
    maxWidth: 560,
    flexShrink: 0,
    alignItems: 'center',
  },
  dataEntryError: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: Spacing.xs,
    textAlign: 'center',
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.danger,
    letterSpacing: 0.4,
  },
  commandExplanationWorkspace: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  commandExplanationText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  dataEntryInputRow: {
    width: '100%',
  },
  dataEntryInputShell: {
    position: 'relative',
    width: '100%',
  },
  spaceWorkspace: {
    flexGrow: 1,
    minHeight: 0,
    width: '100%',
  },
  dataEntryInput: {
    width: '100%',
    minHeight: 58,
    paddingHorizontal: 20,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.mono,
    fontSize: 18,
    lineHeight: DATA_ENTRY_LINE_HEIGHT,
    color: Colors.text,
    textAlign: 'center',
  },
  inputCaret: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 2,
    height: DATA_ENTRY_LINE_HEIGHT,
    marginLeft: -1,
    marginTop: -(DATA_ENTRY_LINE_HEIGHT / 2),
    backgroundColor: Colors.text,
  },
});
