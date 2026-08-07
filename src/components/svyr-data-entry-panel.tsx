import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
    Keyboard,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    type GestureResponderEvent,
    type NativeSyntheticEvent,
    type TextInputKeyPressEventData,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { SvyrHint } from '@/components/svyr-hint';
import { WorkspaceTerminal } from '@/components/workspace-terminal';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useDirectorySwipe } from '@/hooks/use-directory-swipe';
import type { ActiveEntryField } from '@/hooks/use-workspace';
import { findFieldDefinition, normalizeFieldInputValue } from '@/lib/field-schema';
import type { SvyrHintId } from '@/lib/hint-repository';

const SWIPE_THRESHOLD = 24;
const SOURCE_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'portal', label: 'Client portal' },
  { value: 'phone', label: 'Telephone' },
  { value: 'letter', label: 'Letter' },
  { value: 'internal', label: 'Internal referral' },
  { value: 'other', label: 'Other' },
] as const;

type Props = {
  field: ActiveEntryField;
  value: string;
  storedValue?: string | null;
  error: string | null;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  /** Empty-value Backspace cancels entry via the shared controller. */
  onDeletePreviousPart: () => void;
  /** Empty-value swipe cancels entry; non-empty values are protected. */
  onCancelEntry: () => boolean;
  focusToken?: number;
  activeHintId?: Extract<SvyrHintId, 'executeValue'> | null;
  onDismissHint?: (id: SvyrHintId) => void;
  pinnedCommandPrefix: string[];
  editablePath: string[];
  canPinCurrentPath: boolean;
  isCurrentPathPinned: boolean;
  onToggleCurrentPathPin: () => void;
  notesSurface?: ReactNode;
};

/**
 * Dedicated Power User value-entry surface. The dock remains mounted below it
 * while a value-bearing command is active — label, value, keyboard. The
 * structural SVYR path stays internal and is never shown here.
 */
export function SvyrDataEntryPanel({
  field,
  value,
  storedValue,
  error,
  onChangeText,
  onSubmit,
  onDeletePreviousPart,
  onCancelEntry,
  focusToken = 0,
  activeHintId = null,
  onDismissHint,
  pinnedCommandPrefix,
  editablePath,
  canPinCurrentPath,
  isCurrentPathPinned,
  onToggleCurrentPathPin,
  notesSurface,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const valueRef = useRef(value);
  const isSourceField = field.path.join('/') === 'prep/brief/instr/source';
  const [pickerMode, setPickerMode] = useState<'picker' | 'text'>(
    isSourceField ? 'picker' : 'text',
  );
  const [draftText, setDraftText] = useState('');
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [gestureStart, setGestureStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [gestureLocked, setGestureLocked] = useState<'horizontal' | 'vertical' | null>(null);
  const [gestureDeltaY, setGestureDeltaY] = useState(0);
  valueRef.current = value;

  // Subtle cancel nudge on the value row only — the panel itself never slides.
  const { gesture, commandLineStyle } = useDirectorySwipe(onCancelEntry, {
    maxTranslation: 10,
  });

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!isSourceField && pickerMode === 'text') {
      focusInput();
      return;
    }
    if (isSourceField && pickerMode === 'text') {
      focusInput();
      return;
    }
    if (!isSourceField) {
      focusInput();
    }
  }, [focusInput, focusToken, field.path.join('/'), isSourceField, pickerMode]);

  const handleKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (event.nativeEvent.key !== 'Backspace') return;
    if (valueRef.current.length > 0) return;
    onDeletePreviousPart();
  };

  const entryLabel =
    field.node.entryLabel ?? field.node.token.toUpperCase();
  const placeholder =
    field.node.valuePlaceholder ?? `Enter ${field.node.token}`;
  const sourceFieldDefinition = isSourceField
    ? findFieldDefinition(field.path)
    : null;
  const sourceOptions = sourceFieldDefinition?.options ?? SOURCE_OPTIONS;
  const committedSourceValue = isSourceField ? storedValue ?? null : null;
  const normalizedCommittedValue = committedSourceValue
    ? normalizeFieldInputValue(sourceFieldDefinition, committedSourceValue)
    : null;
  const matchedSourceIndex = sourceOptions.findIndex(
    (option) => option.value === normalizedCommittedValue,
  );
  const hasCustomCommittedSource =
    Boolean(committedSourceValue) &&
    (matchedSourceIndex < 0 || normalizedCommittedValue === 'other');
  const defaultSourceIndex =
    matchedSourceIndex >= 0
      ? matchedSourceIndex
      : hasCustomCommittedSource
        ? sourceOptions.findIndex((option) => option.value === 'other')
        : 0;
  const activeSourceOption = sourceOptions[selectedSourceIndex] ?? sourceOptions[0];

  const commitSourceOption = useCallback((optionValue: string) => {
    const normalized = normalizeFieldInputValue(sourceFieldDefinition, optionValue);
    if (!normalized) return;
    onChangeText(normalized);
    onSubmit();
  }, [onChangeText, onSubmit, sourceFieldDefinition]);

  const commitCustomSource = useCallback(() => {
    const trimmedDraft = draftText.trim();
    const normalized = normalizeFieldInputValue(sourceFieldDefinition, trimmedDraft);
    if (!normalized) return;
    onChangeText(normalized);
    onSubmit();
    setDraftText('');
    setPickerMode('picker');
  }, [draftText, onChangeText, onSubmit, sourceFieldDefinition]);

  useEffect(() => {
    if (!isSourceField) {
      setPickerMode('picker');
      setDraftText('');
      setSelectedSourceIndex(0);
      Keyboard.dismiss();
      return;
    }

    setPickerMode('picker');
    setDraftText('');
    setSelectedSourceIndex(
      defaultSourceIndex >= 0 ? defaultSourceIndex : 0,
    );
  }, [defaultSourceIndex, field.path.join('/'), isSourceField]);

  const advanceSelection = useCallback(
    (direction: 'up' | 'down') => {
      const nextIndex =
        direction === 'up'
          ? Math.min(selectedSourceIndex + 1, sourceOptions.length - 1)
          : Math.max(selectedSourceIndex - 1, 0);
      const nextOption = sourceOptions[nextIndex];
      if (!nextOption) return;
      setSelectedSourceIndex(nextIndex);
    },
    [selectedSourceIndex, sourceOptions],
  );

  const handlePickerTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      setGestureStart({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
      setGestureLocked(null);
      setGestureDeltaY(0);
    },
    [],
  );

  const handlePickerTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!gestureStart || pickerMode !== 'picker' || !isSourceField) return;
      const dx = event.nativeEvent.pageX - gestureStart.x;
      const dy = event.nativeEvent.pageY - gestureStart.y;
      if (gestureLocked === null) {
        if (Math.abs(dy) >= Math.abs(dx) && Math.abs(dy) >= SWIPE_THRESHOLD) {
          setGestureLocked('vertical');
        } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= SWIPE_THRESHOLD) {
          setGestureLocked('horizontal');
        } else {
          return;
        }
      }
      if (gestureLocked === 'vertical') {
        setGestureDeltaY(dy);
      }
    },
    [gestureLocked, gestureStart, isSourceField, pickerMode],
  );

  const handlePickerTouchEnd = useCallback(() => {
    if (gestureLocked !== 'vertical' || !isSourceField) {
      setGestureStart(null);
      setGestureLocked(null);
      setGestureDeltaY(0);
      return;
    }

    if (gestureDeltaY <= -SWIPE_THRESHOLD) {
      advanceSelection('up');
    } else if (gestureDeltaY >= SWIPE_THRESHOLD) {
      advanceSelection('down');
    }

    setGestureStart(null);
    setGestureLocked(null);
    setGestureDeltaY(0);
  }, [advanceSelection, gestureDeltaY, gestureLocked, isSourceField]);

  const handlePickerPress = useCallback(() => {
    if (!isSourceField || pickerMode !== 'picker') return;
    if (activeSourceOption?.value === 'other') {
      const draftValue = normalizedCommittedValue ?? '';
      setDraftText(draftValue);
      setPickerMode('text');
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return;
    }
    commitSourceOption(activeSourceOption?.value ?? '');
  }, [activeSourceOption?.value, commitSourceOption, isSourceField, normalizedCommittedValue, pickerMode]);

  const handleSourceSubmit = useCallback(() => {
    if (!isSourceField) return;
    if (pickerMode === 'text') {
      commitCustomSource();
      return;
    }
    if (activeSourceOption?.value === 'other') {
      const draftValue = normalizedCommittedValue ?? '';
      setDraftText(draftValue);
      setPickerMode('text');
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return;
    }
    commitSourceOption(activeSourceOption?.value ?? '');
  }, [activeSourceOption?.value, commitCustomSource, commitSourceOption, isSourceField, normalizedCommittedValue, pickerMode]);

  return (
    isSourceField ? (
      <View style={styles.dataEntryPanel}>
        {notesSurface}
        <WorkspaceTerminal
          editablePath={editablePath}
          pinnedCommandPrefix={pinnedCommandPrefix}
          onToggleCurrentPathPin={onToggleCurrentPathPin}
          canPinCurrentPath={canPinCurrentPath}
          isCurrentPathPinned={isCurrentPathPinned}
          embedded
        />
        <Text
          style={styles.dataEntryLabel}
          accessibilityRole="header"
          accessibilityLabel={entryLabel}>
          {entryLabel}
        </Text>

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

        <View style={styles.sourceBarFrame}>
          {pickerMode === 'picker' ? (
            <Pressable
              onStartShouldSetResponder={() => true}
              onPress={handlePickerPress}
              onTouchStart={handlePickerTouchStart}
              onTouchMove={handlePickerTouchMove}
              onTouchEnd={handlePickerTouchEnd}
              onTouchCancel={handlePickerTouchEnd}
              style={styles.sourcePickerShell}>
              <Text style={styles.sourcePickerText}>
                {activeSourceOption?.label ?? 'Email'}
              </Text>
            </Pressable>
          ) : (
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
                value={draftText}
                onChangeText={setDraftText}
                onSubmitEditing={handleSourceSubmit}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="done"
                submitBehavior="submit"
                blurOnSubmit={false}
                placeholder="Type source…"
                placeholderTextColor={Colors.textMuted}
                style={styles.dataEntryInput}
                accessibilityLabel={entryLabel}
              />
            </Pressable>
          )}
        </View>
      </View>
    ) : (
      <GestureDetector gesture={gesture}>
        <View style={styles.dataEntryPanel}>
        {notesSurface}
        <WorkspaceTerminal
          editablePath={editablePath}
          pinnedCommandPrefix={pinnedCommandPrefix}
          onToggleCurrentPathPin={onToggleCurrentPathPin}
          canPinCurrentPath={canPinCurrentPath}
          isCurrentPathPinned={isCurrentPathPinned}
          embedded
        />
        <Text
          style={styles.dataEntryLabel}
          accessibilityRole="header"
          accessibilityLabel={entryLabel}>
          {entryLabel}
        </Text>

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

        <Animated.View style={commandLineStyle}>
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
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              spellCheck={false}
              returnKeyType="done"
              submitBehavior="submit"
              blurOnSubmit={false}
              placeholder={placeholder}
              placeholderTextColor={Colors.textMuted}
              style={styles.dataEntryInput}
              accessibilityLabel={entryLabel}
            />
          </Pressable>
        </Animated.View>
      </View>
      </GestureDetector>
    )
  );
}

const styles = StyleSheet.create({
  dataEntryPanel: {
    width: '100%',
  },
  dataEntryLabel: {
    minHeight: 38,
    paddingHorizontal: 20,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    textAlignVertical: 'center',
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    letterSpacing: 0.8,
    color: Colors.textSecondary,
  },
  dataEntryError: {
    paddingHorizontal: 20,
    paddingBottom: Spacing.xs,
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.danger,
    letterSpacing: 0.4,
  },
  dataEntryInputRow: {
  },
  sourceBarFrame: {
    width: '100%',
    minHeight: 58,
    justifyContent: 'center',
  },
  sourcePickerShell: {
    width: '100%',
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: Spacing.sm,
  },
  sourcePickerText: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  dataEntryInput: {
    minHeight: 58,
    paddingHorizontal: 20,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.mono,
    fontSize: 18,
    color: Colors.text,
  },
});
