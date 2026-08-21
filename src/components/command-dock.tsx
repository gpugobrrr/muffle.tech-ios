import React, { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import {
  DEFAULT_COMMAND_PLACEHOLDER,
  HELP_TEXT,
  parseEnglishCommand,
  type ParsedEnglishCommand,
} from '@/lib/cli/english-command-parser';
import { SvyrBar } from '@/components/svyr-bar';
import { SvyrHint } from '@/components/svyr-hint';
import { SvyrOutputLine } from '@/components/svyr-output-line';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useDirectorySwipe } from '@/hooks/use-directory-swipe';
import type { AcousticState } from '@/hooks/use-voice-finding-pipeline';
import type { SvyrHintId } from '@/lib/hint-repository';
import { SVYR_BAR_LAYOUT } from '@/lib/svyr-bar-navigation';
import { formatSvyrDisplayedLabel } from '@/lib/svyr-label-presentation';

let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch (e) {
  // no-op
}

const triggerMediumHaptic = () => {
  if (Haptics && Haptics.impactAsync && Haptics.ImpactFeedbackStyle) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
};

const triggerLightHaptic = () => {
  if (Haptics && Haptics.impactAsync && Haptics.ImpactFeedbackStyle) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
};

export {
  parseEnglishCommand,
  DEFAULT_COMMAND_PLACEHOLDER,
  HELP_TEXT,
  type ParsedEnglishCommand,
};

type DockHintId = Extract<SvyrHintId, 'selectBranch' | 'swipeBack'>;

export type CommandDockProps = {
  infoBarText?: string | null;
  path?: string[];
  onSegmentPress?: (index: number) => void;
  onRootPress?: () => void;
  onNavigateUpDirectory?: () => boolean;
  onSwipeBackCommitted?: () => void;
  finalCommandDescription?: string;
  onFinalCommandHoldChange?: (description: string | null) => void;
  activeHintId?: DockHintId | null;
  onDismissHint?: (hintId: DockHintId) => void;
  onPttPressIn?: () => void;
  onPttPressOut?: () => void;
  pttActive?: boolean;
  variant?: 'path' | 'terminal';
  commandValue?: string;
  onCommandValueChange?: (value: string) => void;
  onCommandSubmit?: (parsed?: ParsedEnglishCommand) => void;
  onParsedCommandSubmit?: (parsed: ParsedEnglishCommand) => void;
  commandSuggestions?: readonly string[];
  onApplyCommandSuggestion?: (suggestion: string) => void;
  acousticState?: AcousticState;
  focusToken?: number;
  inputRef?: React.RefObject<TextInputType | null>;
  commandPlaceholder?: string;
  transcribedText?: string | null;
  streamingTranscript?: string;
  onReset?: () => void;
};

function TerminalInputView({
  commandValue = '',
  onCommandValueChange,
  onCommandSubmit,
  onParsedCommandSubmit,
  commandSuggestions = [],
  onApplyCommandSuggestion,
  acousticState = 'STANDBY',
  focusToken,
  inputRef,
  commandPlaceholder,
  transcribedText,
  streamingTranscript,
  onReset,
}: {
  commandValue?: string;
  onCommandValueChange?: (value: string) => void;
  onCommandSubmit?: (parsed?: ParsedEnglishCommand) => void;
  onParsedCommandSubmit?: (parsed: ParsedEnglishCommand) => void;
  commandSuggestions?: readonly string[];
  onApplyCommandSuggestion?: (suggestion: string) => void;
  acousticState?: AcousticState;
  focusToken?: number;
  inputRef?: React.RefObject<TextInputType | null>;
  commandPlaceholder?: string;
  transcribedText?: string | null;
  streamingTranscript?: string;
  onReset?: () => void;
}) {
  const localRef = useRef<TextInputType>(null);
  const resolvedRef = inputRef ?? localRef;
  const listening =
    acousticState === 'LISTENING' || acousticState === 'PARSING';

  useEffect(() => {
    if (!focusToken) return;
    const timer = setTimeout(() => {
      resolvedRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [focusToken, resolvedRef]);

  // Priority for input display:
  // 1. Streaming real-time transcript while dictating
  // 2. Completed transcribedText after speech end (until cleared/edited)
  // 3. Typed commandValue buffer
  const displayValue = listening
    ? (streamingTranscript ?? transcribedText ?? commandValue)
    : (commandValue || transcribedText || '');

  // When speech completes with text and commandValue is empty, adopt transcribedText
  useEffect(() => {
    if (transcribedText && !commandValue && !listening) {
      onCommandValueChange?.(transcribedText);
    }
  }, [transcribedText, commandValue, listening, onCommandValueChange]);

  const handleSubmit = useCallback(() => {
    const trimmed = commandValue.trim();
    const parsed = parseEnglishCommand(trimmed);
    onParsedCommandSubmit?.(parsed);
    onCommandSubmit?.(parsed);
  }, [commandValue, onCommandSubmit, onParsedCommandSubmit]);

  const hasText = commandValue.trim().length > 0;

  const handleWedgePress = useCallback(() => {
    const trimmed = commandValue.trim();
    if (trimmed.length === 0) return;
    triggerMediumHaptic();
    const parsed = parseEnglishCommand(trimmed);
    onParsedCommandSubmit?.(parsed);
    onCommandSubmit?.(parsed);
  }, [commandValue, onCommandSubmit, onParsedCommandSubmit]);

  const handlePromptPress = useCallback(() => {
    triggerLightHaptic();
    onCommandValueChange?.('');
    onReset?.();
  }, [onCommandValueChange, onReset]);

  return (
    <View style={styles.terminalRegion}>
      <View style={styles.terminalRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset command input"
          onPress={handlePromptPress}
          hitSlop={8}
          style={({ pressed }) => [
            styles.promptButton,
            pressed && styles.promptButtonPressed,
          ]}>
          <Text style={styles.prompt}>SVYR {'>'}</Text>
        </Pressable>
        <TextInput
          ref={resolvedRef}
          value={displayValue}
          onChangeText={onCommandValueChange}
          onSubmitEditing={handleSubmit}
          placeholder={commandPlaceholder || DEFAULT_COMMAND_PLACEHOLDER}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="send"
          blurOnSubmit={false}
          editable={!listening}
          style={styles.terminalInput}
          accessibilityLabel="SVYR command input"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Execute command"
          disabled={!hasText}
          onPress={handleWedgePress}
          hitSlop={12}
          style={({ pressed }) => [
            styles.wedgeButton,
            pressed && styles.wedgeButtonPressed,
          ]}>
          <Text
            style={[
              styles.cornerGlyph,
              hasText ? styles.cornerGlyphActive : styles.cornerGlyphMuted,
            ]}>
            ◢
          </Text>
        </Pressable>
      </View>

      {commandSuggestions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.suggestionRow}>
          {commandSuggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityRole="button"
              accessibilityLabel={`Use ${suggestion}`}
              onPress={() => onApplyCommandSuggestion?.(suggestion)}
              hitSlop={SVYR_BAR_LAYOUT.hitSlop}
              style={({ pressed }) => [
                styles.suggestionChip,
                pressed ? styles.suggestionChipPressed : null,
              ]}><Text style={styles.suggestionText}>
                {formatSvyrDisplayedLabel(suggestion, 'navigation')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export function CommandDock({
  infoBarText = null,
  path = [],
  onSegmentPress,
  onRootPress,
  onNavigateUpDirectory,
  onSwipeBackCommitted,
  finalCommandDescription,
  onFinalCommandHoldChange,
  activeHintId = null,
  onDismissHint,
  onPttPressIn,
  onPttPressOut,
  pttActive = false,
  variant = 'path',
  commandValue,
  onCommandValueChange,
  onCommandSubmit,
  onParsedCommandSubmit,
  commandSuggestions,
  onApplyCommandSuggestion,
  acousticState = 'STANDBY',
  focusToken,
  inputRef,
  commandPlaceholder,
  transcribedText,
  streamingTranscript,
  onReset,
}: CommandDockProps) {
  const { gesture: panGesture } = useDirectorySwipe(
    onNavigateUpDirectory ?? (() => false),
    { enabled: variant === 'path' },
  );

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={styles.wrapper}>
        {infoBarText ? <SvyrOutputLine text={infoBarText} /> : null}

        {activeHintId ? (
          <View style={styles.hintOverlay}>
            <SvyrHint
              id={activeHintId}
              onDismiss={(id) => onDismissHint?.(id as DockHintId)}
            />
          </View>
        ) : null}

        {variant === 'terminal' ? (
          <TerminalInputView
            commandValue={commandValue}
            onCommandValueChange={onCommandValueChange}
            onCommandSubmit={onCommandSubmit}
            onParsedCommandSubmit={onParsedCommandSubmit}
            commandSuggestions={commandSuggestions}
            onApplyCommandSuggestion={onApplyCommandSuggestion}
            acousticState={acousticState}
            focusToken={focusToken}
            inputRef={inputRef}
            commandPlaceholder={commandPlaceholder}
            transcribedText={transcribedText}
            streamingTranscript={streamingTranscript}
            onReset={onReset}
          />
        ) : (
          <SvyrBar
            path={path}
            onSegmentPress={onSegmentPress}
            onRootPress={onRootPress}
            finalCommandDescription={finalCommandDescription}
            onFinalCommandHoldChange={onFinalCommandHoldChange}
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#F4F4F0',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D5D2CA',
  },
  hintOverlay: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    zIndex: 100,
  },
  terminalRegion: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  terminalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  promptButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  promptButtonPressed: {
    backgroundColor: '#E2E0D8',
  },
  prompt: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: '#737A7D',
    letterSpacing: 1,
  },
  terminalInput: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  wedgeButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wedgeButtonPressed: {
    opacity: 0.5,
  },
  cornerGlyph: {
    fontSize: 14,
    lineHeight: 14,
    fontWeight: '700',
  },
  cornerGlyphActive: {
    color: '#2C2C2C',
  },
  cornerGlyphMuted: {
    color: '#A09E96',
  },
  suggestionRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  suggestionChip: {
    backgroundColor: '#ECEAE4',
    borderWidth: 1,
    borderColor: '#D8D6CE',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 2,
  },
  suggestionChipPressed: {
    backgroundColor: '#2C2C2C',
    borderColor: '#2C2C2C',
  },
  suggestionText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.amber,
  },
});
