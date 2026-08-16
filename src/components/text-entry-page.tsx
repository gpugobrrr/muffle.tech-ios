import { useCallback, useEffect, useRef } from 'react';
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
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { ActiveEntryField } from '@/hooks/use-workspace';
import type { SvyrHintId } from '@/lib/hint-repository';
import type { PresentationMode } from '@/lib/presentation-mode';

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
  /** Optional hold-guidance copy shown while the shared SVYR bar final segment is held. */
  heldCommandDescription?: string | null;
  notesSurface?: ReactNode;
  noteEditing?: boolean;
  noteValue?: string;
  onChangeNote?: (value: string) => void;
  /** Keyboard layer on mount; numeric capture uses `numeric`. */
  initialKeyboardMode?: 'alpha' | 'numeric';
  /**
   * Schema display-only unit (e.g. `%`). Never appended to the draft or
   * canonical scalar value.
   */
  displayUnit?: string | null;
  /** When false, disables the double-tap space gesture (numeric entry). */
  allowSpaceGesture?: boolean;
  /** Touch keeps the split keyboard; laptop uses native text editing. */
  presentationMode?: PresentationMode;
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
  heldCommandDescription = null,
  notesSurface,
  noteEditing = false,
  noteValue = '',
  onChangeNote,
  initialKeyboardMode = 'alpha',
  displayUnit = null,
  allowSpaceGesture = true,
  presentationMode = 'touch',
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const isLaptopPresentation = presentationMode === 'laptop';

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      if (!isLaptopPresentation) Keyboard.dismiss();
    });
  }, [isLaptopPresentation]);

  const fieldPathKey = field.path.join('/');

  useEffect(() => {
    focusInput();
  }, [fieldPathKey, focusInput, focusToken]);

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
  const customKeyboardValue = noteEditing ? noteValue : value;
  const handleCustomKeyboardChange = noteEditing
    ? (nextValue: string) => onChangeNote?.(nextValue)
    : onChangeText;
  const handleCustomKeyboardSubmit = noteEditing ? () => undefined : onSubmit;

  return (
    <View style={[styles.dataEntryPanel, styles.flexDataEntryPanel]}>
      {notesSurface}
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
                onPress={isLaptopPresentation ? undefined : focusInput}
                accessibilityRole="none"
                accessibilityActions={[
                  { name: 'escape', label: 'Cancel data entry' },
                ]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'escape') onCancelEntry();
                }}
                style={styles.dataEntryInputRow}>
                <View style={styles.dataEntryValueRow}>
                  <TextInput
                    ref={inputRef}
                    value={value}
                    onChangeText={onChangeText}
                    onKeyPress={handleKeyPress}
                    onSubmitEditing={onSubmit}
                    showSoftInputOnFocus={isLaptopPresentation}
                    autoFocus
                    autoCapitalize={
                      initialKeyboardMode === 'numeric' ? 'none' : 'words'
                    }
                    autoCorrect={false}
                    spellCheck={false}
                    returnKeyType="done"
                    submitBehavior="submit"
                    blurOnSubmit={false}
                    placeholder=""
                    caretHidden={
                      !isLaptopPresentation && value.length === 0
                    }
                    style={[
                      styles.dataEntryInput,
                      displayUnit ? styles.dataEntryInputWithUnit : null,
                    ]}
                    accessibilityLabel={entryLabel}
                  />
                  {displayUnit ? (
                    <Text
                      style={styles.displayUnit}
                      accessibilityLabel={`Unit ${displayUnit}`}>
                      {displayUnit}
                    </Text>
                  ) : null}
                </View>
                {!isLaptopPresentation && value.length === 0 ? (
                  <PulsingCaret />
                ) : null}
              </Pressable>
            </View>
          </View>
        </View>
        {allowSpaceGesture ? (
          <GestureDetector gesture={spaceWorkspaceGesture}>
            <View
              style={styles.spaceWorkspace}
              accessibilityLabel="Empty workspace. Double tap to insert a space."
            />
          </GestureDetector>
        ) : (
          <View style={styles.spaceWorkspace} />
        )}
        {isLaptopPresentation ? null : (
          <SplitTextKeyboard
            value={customKeyboardValue}
            onChangeText={handleCustomKeyboardChange}
            onSubmit={handleCustomKeyboardSubmit}
            showNumericMode
            initialMode={initialKeyboardMode}
          />
        )}
      </View>
    </View>
  );
}

export function inputInstructionForField(field: ActiveEntryField): string {
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
  dataEntryValueRow: {
    width: '100%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
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
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 48,
    minHeight: 58,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.mono,
    fontSize: 18,
    lineHeight: DATA_ENTRY_LINE_HEIGHT,
    color: Colors.text,
    textAlign: 'center',
  },
  dataEntryInputWithUnit: {
    flexGrow: 0,
    textAlign: 'right',
    maxWidth: '70%',
  },
  displayUnit: {
    marginLeft: Spacing.xs,
    fontFamily: Fonts.mono,
    fontSize: 18,
    lineHeight: DATA_ENTRY_LINE_HEIGHT,
    color: Colors.textSecondary,
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
