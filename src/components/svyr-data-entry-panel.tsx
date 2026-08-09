import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { SvyrHint } from '@/components/svyr-hint';
import { TextEntryPage } from '@/components/text-entry-page';
import { WorkspaceTerminal } from '@/components/workspace-terminal';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { ActiveEntryField } from '@/hooks/use-workspace';
import {
  findFieldDefinition,
  normalizeFieldInputValue,
  type FieldDefinition,
} from '@/lib/field-schema';
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

export function SvyrDataEntryPanel({
  field,
  value,
  storedValue,
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
  const fieldDefinition = findFieldDefinition(field.path);

  if (fieldDefinition?.valueType !== 'singleSelect') {
    return (
      <TextEntryPage
        field={field}
        value={value}
        error={error}
        onChangeText={onChangeText}
        onSubmit={onSubmit}
        onCancelEntry={onCancelEntry}
        focusToken={focusToken}
        activeHintId={activeHintId}
        onDismissHint={onDismissHint}
        pinnedCommandPrefix={pinnedCommandPrefix}
        svyrDirectory={svyrDirectory}
        canPinCurrentPath={canPinCurrentPath}
        isCurrentPathPinned={isCurrentPathPinned}
        onToggleCurrentPathPin={onToggleCurrentPathPin}
        onSegmentPress={onSegmentPress}
        notesSurface={notesSurface}
        noteEditing={noteEditing}
        noteValue={noteValue}
        onChangeNote={onChangeNote}
      />
    );
  }

  return (
    <SourceEntryPage
      field={field}
      fieldDefinition={fieldDefinition}
      value={value}
      storedValue={storedValue}
      error={error}
      onChangeText={onChangeText}
      onSubmit={onSubmit}
      onCancelEntry={onCancelEntry}
      pinnedCommandPrefix={pinnedCommandPrefix}
      svyrDirectory={svyrDirectory}
      canPinCurrentPath={canPinCurrentPath}
      isCurrentPathPinned={isCurrentPathPinned}
      onToggleCurrentPathPin={onToggleCurrentPathPin}
      onSegmentPress={onSegmentPress}
      notesSurface={notesSurface}
      activeHintId={activeHintId}
      onDismissHint={onDismissHint}
    />
  );
}

type SourceEntryPageProps = {
  field: ActiveEntryField;
  fieldDefinition: FieldDefinition;
  value: string;
  storedValue?: string | null;
  error: string | null;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onCancelEntry: () => boolean;
  pinnedCommandPrefix: string[];
  svyrDirectory: string[];
  canPinCurrentPath: boolean;
  isCurrentPathPinned: boolean;
  onToggleCurrentPathPin: () => void;
  onSegmentPress: (index: number) => void;
  notesSurface?: ReactNode;
  activeHintId?: Extract<SvyrHintId, 'executeValue'> | null;
  onDismissHint?: (id: SvyrHintId) => void;
};

function SourceEntryPage({
  field,
  fieldDefinition,
  value,
  storedValue,
  error,
  onChangeText,
  onSubmit,
  onCancelEntry,
  pinnedCommandPrefix,
  svyrDirectory,
  canPinCurrentPath,
  isCurrentPathPinned,
  onToggleCurrentPathPin,
  onSegmentPress,
  notesSurface,
  activeHintId,
  onDismissHint,
}: SourceEntryPageProps) {
  const inputRef = useRef<TextInput>(null);
  const [pickerMode, setPickerMode] = useState<'picker' | 'text'>('picker');
  const [draftText, setDraftText] = useState('');
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(0);
  const [gestureStart, setGestureStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [gestureLocked, setGestureLocked] = useState<
    'horizontal' | 'vertical' | null
  >(null);
  const [gestureDeltaY, setGestureDeltaY] = useState(0);

  const sourceOptions = fieldDefinition.options ?? SOURCE_OPTIONS;
  const committedSourceValue = storedValue ?? null;
  const normalizedCommittedValue = committedSourceValue
    ? normalizeFieldInputValue(fieldDefinition, committedSourceValue)
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
  const entryLabel =
    field.node.entryLabel ?? field.node.token.toUpperCase();

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    setPickerMode('picker');
    setDraftText('');
    setSelectedSourceIndex(
      defaultSourceIndex >= 0 ? defaultSourceIndex : 0,
    );
  }, [defaultSourceIndex, field.path.join('/')]);

  const advanceSelection = useCallback(
    (direction: 'up' | 'down') => {
      const nextIndex =
        direction === 'up'
          ? Math.min(selectedSourceIndex + 1, sourceOptions.length - 1)
          : Math.max(selectedSourceIndex - 1, 0);
      if (sourceOptions[nextIndex]) setSelectedSourceIndex(nextIndex);
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
      if (!gestureStart) return;
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
      if (gestureLocked === 'vertical') setGestureDeltaY(dy);
    },
    [gestureLocked, gestureStart],
  );

  const handlePickerTouchEnd = useCallback(() => {
    if (gestureLocked === 'vertical') {
      if (gestureDeltaY <= -SWIPE_THRESHOLD) advanceSelection('up');
      if (gestureDeltaY >= SWIPE_THRESHOLD) advanceSelection('down');
    }
    setGestureStart(null);
    setGestureLocked(null);
    setGestureDeltaY(0);
  }, [advanceSelection, gestureDeltaY, gestureLocked]);

  const commitSourceOption = useCallback(
    (optionValue: string) => {
      const normalized = normalizeFieldInputValue(fieldDefinition, optionValue);
      if (!normalized) return;
      onChangeText(normalized);
      onSubmit();
    },
    [fieldDefinition, onChangeText, onSubmit],
  );

  const handlePickerPress = useCallback(() => {
    if (activeSourceOption?.value === 'other') {
      setDraftText(normalizedCommittedValue ?? '');
      setPickerMode('text');
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    commitSourceOption(activeSourceOption?.value ?? '');
  }, [activeSourceOption?.value, commitSourceOption, normalizedCommittedValue]);

  const commitCustomSource = useCallback(() => {
    const normalized = normalizeFieldInputValue(fieldDefinition, draftText.trim());
    if (!normalized) return;
    onChangeText(normalized);
    onSubmit();
    setDraftText('');
    setPickerMode('picker');
  }, [draftText, fieldDefinition, onChangeText, onSubmit]);

  const handleSourceSubmit = useCallback(() => {
    if (pickerMode === 'text') {
      commitCustomSource();
      return;
    }
    handlePickerPress();
  }, [commitCustomSource, handlePickerPress, pickerMode]);

  return (
    <View style={styles.dataEntryPanel}>
      {notesSurface}
      <WorkspaceTerminal
        editablePath={svyrDirectory}
        pinnedCommandPrefix={pinnedCommandPrefix}
        onToggleCurrentPathPin={onToggleCurrentPathPin}
        onSegmentPress={onSegmentPress}
        canPinCurrentPath={canPinCurrentPath}
        isCurrentPathPinned={isCurrentPathPinned}
        embedded
      />
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
  );
}

const styles = StyleSheet.create({
  dataEntryPanel: {
    width: '100%',
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
  dataEntryInputRow: {
    width: '100%',
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
    width: '100%',
    minHeight: 58,
    paddingHorizontal: 20,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.mono,
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
  },
});
