import { getClosestSuggestions } from '@/commands/command-suggestions';
import { parseCommand } from '@/commands/command-parser';
import type {
  CommandDefinition,
  CommandName,
} from '@/commands/command-types';
import { resolveExecutableCommand } from '@/domain/terminal-execution';
import {
  createInitialTerminalState,
  terminalReducer,
} from '@/domain/terminal-reducer';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type {
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';

export function useTerminalController() {
  const [state, dispatch] = useReducer(
    terminalReducer,
    undefined,
    createInitialTerminalState,
  );
  const stateRef = useRef(state);
  const cycleSuggestionsRef = useRef<CommandDefinition[]>([]);
  const cycleIndexRef = useRef(-1);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const resetTabCycle = useCallback(() => {
    cycleSuggestionsRef.current = [];
    cycleIndexRef.current = -1;
  }, []);

  const executeCurrentCommand = useCallback(
    (explicitCommand?: CommandName): boolean => {
      const current = stateRef.current;
      const parsed = explicitCommand
        ? parseCommand(explicitCommand)
        : resolveExecutableCommand(current);

      if (!parsed || parsed.type === 'UNKNOWN_COMMAND') {
        const unknown = current.inputValue.trim();
        if (unknown) {
          dispatch({
            type: 'SET_ERROR',
            message: `Unknown command: “${unknown}”`,
          });
        }
        return false;
      }

      if (parsed.type === 'UNDO' && current.undoStack.length === 0) {
        dispatch({ type: 'EXECUTE_COMMAND', command: parsed });
        return false;
      }

      dispatch({ type: 'EXECUTE_COMMAND', command: parsed });
      dispatch({ type: 'SET_INPUT', value: '' });
      resetTabCycle();
      return true;
    },
    [resetTabCycle],
  );

  const setInput = useCallback(
    (value: string) => {
      resetTabCycle();
      dispatch({ type: 'SET_INPUT', value });
    },
    [resetTabCycle],
  );

  const selectSuggestion = useCallback(
    (definition: CommandDefinition) => {
      const current = stateRef.current;
      if (current.inputValue.trim().toLowerCase() === definition.name) {
        executeCurrentCommand(definition.name);
      } else {
        resetTabCycle();
        dispatch({ type: 'SELECT_SUGGESTION', command: definition.name });
      }
    },
    [executeCurrentCommand, resetTabCycle],
  );

  const completeHighlightedSuggestion = useCallback(() => {
    const current = stateRef.current;

    if (cycleSuggestionsRef.current.length === 0) {
      cycleSuggestionsRef.current = current.matchingSuggestions;
      cycleIndexRef.current = Math.max(0, current.highlightedSuggestionIndex);
    } else {
      cycleIndexRef.current =
        (cycleIndexRef.current + 1) % cycleSuggestionsRef.current.length;
    }

    const suggestion = cycleSuggestionsRef.current[cycleIndexRef.current];
    if (!suggestion) return;

    dispatch({ type: 'SELECT_SUGGESTION', command: suggestion.name });
  }, []);

  const completeAndExecuteHighlighted = useCallback(() => {
    const current = stateRef.current;
    const suggestion =
      current.matchingSuggestions[current.highlightedSuggestionIndex];
    if (suggestion) executeCurrentCommand(suggestion.name);
  }, [executeCurrentCommand]);

  const onInputKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (event.nativeEvent.key === 'ArrowUp') {
        resetTabCycle();
        dispatch({ type: 'BROWSE_HISTORY', direction: 'previous' });
      } else if (event.nativeEvent.key === 'ArrowDown') {
        resetTabCycle();
        dispatch({ type: 'BROWSE_HISTORY', direction: 'next' });
      }
    },
    [resetTabCycle],
  );

  const displaySuggestions = useMemo(
    () =>
      state.matchingSuggestions.length > 0
        ? state.matchingSuggestions
        : getClosestSuggestions(state.inputValue),
    [state.inputValue, state.matchingSuggestions],
  );

  return {
    state,
    displaySuggestions,
    canExecute: resolveExecutableCommand(state) !== null,
    setInput,
    selectSuggestion,
    executeCurrentCommand,
    completeHighlightedSuggestion,
    completeAndExecuteHighlighted,
    onInputKeyPress,
    setHighlightedSuggestion: (index: number) =>
      dispatch({ type: 'SET_HIGHLIGHTED_SUGGESTION', index }),
  };
}

export type TerminalController = ReturnType<typeof useTerminalController>;
