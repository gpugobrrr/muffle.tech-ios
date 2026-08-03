import { getMatchingSuggestions } from '@/commands/command-suggestions';
import type {
  CommandName,
  OpenCommandName,
  ParsedCommand,
} from '@/commands/command-types';

import type {
  TerminalAction,
  TerminalState,
  UndoSnapshot,
} from './terminal-types';

const MAX_PROGRESS = 10;
const MAX_HISTORY = 20;
const ACTIVE_ELEMENT = 'external-walls';

function suggestionsFor(
  inputValue: string,
  activeCommand: OpenCommandName | null,
) {
  return getMatchingSuggestions(inputValue, {
    activeElement: ACTIVE_ELEMENT,
    activeCommand,
  });
}

export function createInitialTerminalState(): TerminalState {
  return {
    inputValue: '',
    matchingSuggestions: suggestionsFor('', null),
    highlightedSuggestionIndex: 0,
    suggestionExplicitlySelected: false,
    activeCommand: null,
    progressIndex: 1,
    commandHistory: [],
    historyCursor: null,
    historyDraft: '',
    lastExecutedCommand: null,
    error: null,
    canvasMode: 'idle',
    undoStack: [],
  };
}

function appendHistory(
  history: CommandName[],
  command: CommandName,
): CommandName[] {
  if (history.at(-1) === command) return history;
  return [...history, command].slice(-MAX_HISTORY);
}

function snapshot(state: TerminalState): UndoSnapshot {
  return {
    activeCommand: state.activeCommand,
    progressIndex: state.progressIndex,
    canvasMode: state.canvasMode,
  };
}

function canonicalName(command: ParsedCommand): CommandName {
  if (command.type === 'OPEN_COMMAND') return command.command;
  if (command.type === 'NAVIGATE') return command.direction;
  if (command.type === 'UNDO') return 'undo';
  return 'help';
}

function executeCommand(
  state: TerminalState,
  command: ParsedCommand,
): TerminalState {
  const name = canonicalName(command);
  const common = {
    commandHistory: appendHistory(state.commandHistory, name),
    lastExecutedCommand: name,
    historyCursor: null,
    historyDraft: '',
    error: null,
  };

  if (command.type === 'OPEN_COMMAND') {
    return {
      ...state,
      ...common,
      activeCommand: command.command,
      canvasMode: 'active',
      undoStack: [...state.undoStack, snapshot(state)],
    };
  }

  if (command.type === 'NAVIGATE') {
    const progressIndex =
      command.direction === 'next'
        ? Math.min(MAX_PROGRESS, state.progressIndex + 1)
        : Math.max(1, state.progressIndex - 1);

    return {
      ...state,
      ...common,
      progressIndex,
      undoStack:
        progressIndex === state.progressIndex
          ? state.undoStack
          : [...state.undoStack, snapshot(state)],
    };
  }

  if (command.type === 'UNDO') {
    const previous = state.undoStack.at(-1);
    if (!previous) {
      return { ...state, error: 'Nothing to undo.' };
    }

    return {
      ...state,
      ...previous,
      ...common,
      undoStack: state.undoStack.slice(0, -1),
    };
  }

  return {
    ...state,
    ...common,
    canvasMode: 'help',
  };
}

function setInput(state: TerminalState, value: string): TerminalState {
  const matchingSuggestions = suggestionsFor(value, state.activeCommand);
  return {
    ...state,
    inputValue: value,
    matchingSuggestions,
    highlightedSuggestionIndex: matchingSuggestions.length > 0 ? 0 : -1,
    suggestionExplicitlySelected: false,
    historyCursor: null,
    historyDraft: value,
    error: null,
  };
}

function browseHistory(
  state: TerminalState,
  direction: 'previous' | 'next',
): TerminalState {
  if (state.commandHistory.length === 0) return state;

  const nextCursor =
    direction === 'previous'
      ? state.historyCursor === null
        ? state.commandHistory.length - 1
        : Math.max(0, state.historyCursor - 1)
      : state.historyCursor === null
        ? null
        : state.historyCursor >= state.commandHistory.length - 1
          ? null
          : state.historyCursor + 1;
  const inputValue =
    nextCursor === null ? state.historyDraft : state.commandHistory[nextCursor];
  const matchingSuggestions = suggestionsFor(inputValue, state.activeCommand);

  return {
    ...state,
    historyCursor: nextCursor,
    inputValue,
    matchingSuggestions,
    highlightedSuggestionIndex: matchingSuggestions.length > 0 ? 0 : -1,
    suggestionExplicitlySelected: false,
    error: null,
  };
}

export function terminalReducer(
  state: TerminalState,
  action: TerminalAction,
): TerminalState {
  switch (action.type) {
    case 'SET_INPUT':
      return setInput(state, action.value);
    case 'SELECT_SUGGESTION': {
      const matchingSuggestions = suggestionsFor(
        action.command,
        state.activeCommand,
      );
      return {
        ...state,
        inputValue: action.command,
        matchingSuggestions,
        highlightedSuggestionIndex: 0,
        suggestionExplicitlySelected: true,
        error: null,
      };
    }
    case 'SET_ACTIVE_COMMAND':
      return executeCommand(state, {
        type: 'OPEN_COMMAND',
        command: action.command,
      });
    case 'EXECUTE_COMMAND':
      return executeCommand(state, action.command);
    case 'MOVE_SUGGESTION': {
      const count = state.matchingSuggestions.length;
      if (count === 0) return state;
      const delta = action.direction === 'next' ? 1 : -1;
      return {
        ...state,
        highlightedSuggestionIndex:
          (state.highlightedSuggestionIndex + delta + count) % count,
        suggestionExplicitlySelected: true,
      };
    }
    case 'SET_HIGHLIGHTED_SUGGESTION':
      return {
        ...state,
        highlightedSuggestionIndex: action.index,
        suggestionExplicitlySelected: true,
      };
    case 'BROWSE_HISTORY':
      return browseHistory(state, action.direction);
    case 'NAVIGATE':
      return executeCommand(state, {
        type: 'NAVIGATE',
        direction: action.direction,
      });
    case 'UNDO':
      return executeCommand(state, { type: 'UNDO' });
    case 'SET_ERROR':
      return { ...state, error: action.message };
    default:
      return state;
  }
}
