import { CommandSuggestionRow } from '@/components/command-suggestion-row';
import { EnterCommandButton } from '@/components/enter-command-button';
import { TabAutocompleteButton } from '@/components/tab-autocomplete-button';
import type { CommandDefinition } from '@/commands/command-types';
import type { TerminalController } from '@/hooks/use-terminal-controller';
import { useCallback, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type CommandTerminalProps = {
  controller: TerminalController;
};

export function CommandTerminal({ controller }: CommandTerminalProps) {
  const insets = useSafeAreaInsets();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { state } = controller;

  const refocusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const runCurrentCommand = useCallback(() => {
    controller.executeCurrentCommand();
    refocusInput();
  }, [controller, refocusInput]);

  const completeSuggestion = useCallback(() => {
    controller.completeHighlightedSuggestion();
    refocusInput();
  }, [controller, refocusInput]);

  const completeAndRunSuggestion = useCallback(() => {
    controller.completeAndExecuteHighlighted();
    refocusInput();
  }, [controller, refocusInput]);

  const selectSuggestion = useCallback(
    (suggestion: CommandDefinition) => {
      controller.selectSuggestion(suggestion);
      refocusInput();
    },
    [controller, refocusInput],
  );

  return (
    <View
      accessibilityLabel="Inspection command terminal"
      style={[styles.terminal, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>LAST</Text>
        <Text style={styles.statusValue}>
          {state.lastExecutedCommand ?? '—'}
        </Text>
      </View>

      <CommandSuggestionRow
        suggestions={controller.displaySuggestions}
        highlightedIndex={state.highlightedSuggestionIndex}
        onHighlight={controller.setHighlightedSuggestion}
        onSelect={selectSuggestion}
      />

      {state.error ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.error}>
          {state.error}
        </Text>
      ) : null}

      <View style={styles.commandRow}>
        <TabAutocompleteButton
          onSingleTap={completeSuggestion}
          onDoubleTap={completeAndRunSuggestion}
        />

        <View style={[styles.inputShell, isFocused && styles.inputShellFocused]}>
          <Text accessibilityElementsHidden style={styles.prompt}>
            ›
          </Text>
          <TextInput
            ref={inputRef}
            accessibilityLabel="Command input"
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={() => setIsFocused(false)}
            onChangeText={controller.setInput}
            onFocus={() => setIsFocused(true)}
            onKeyPress={controller.onInputKeyPress}
            onSubmitEditing={runCurrentCommand}
            placeholder="Type a command"
            placeholderTextColor="#7A7770"
            returnKeyType="go"
            selectionColor="#514B78"
            submitBehavior="submit"
            style={styles.input}
            value={state.inputValue}
          />
        </View>

        <EnterCommandButton
          disabled={!controller.canExecute}
          onPress={runCurrentCommand}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  terminal: {
    width: '100%',
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#BDB9AF',
    backgroundColor: '#F2EFE8',
    shadowColor: '#25231F',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  statusRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 7,
  },
  statusLabel: {
    color: '#716D66',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  statusValue: {
    color: '#373256',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  commandRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputShell: {
    minWidth: 120,
    height: 58,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A9A59B',
    borderRadius: 6,
    backgroundColor: '#FFFEFA',
  },
  inputShellFocused: {
    borderWidth: 2,
    borderColor: '#514B78',
  },
  prompt: {
    paddingLeft: 12,
    color: '#514B78',
    fontSize: 22,
    fontWeight: '800',
  },
  input: {
    minWidth: 0,
    height: '100%',
    flex: 1,
    paddingHorizontal: 9,
    color: '#22211F',
    fontSize: 17,
    fontWeight: '600',
  },
  error: {
    marginBottom: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#9A4E45',
    backgroundColor: '#F6EAE7',
    color: '#6E2E28',
    fontSize: 13,
    fontWeight: '600',
  },
});
