import type {
  CommandDefinition,
  CommandName,
  OpenCommandName,
  ParsedCommand,
} from '@/commands/command-types';

export type CanvasMode = 'idle' | 'active' | 'help';

export type UndoSnapshot = {
  activeCommand: OpenCommandName | null;
  progressIndex: number;
  canvasMode: CanvasMode;
};

export type TerminalState = {
  inputValue: string;
  matchingSuggestions: CommandDefinition[];
  highlightedSuggestionIndex: number;
  suggestionExplicitlySelected: boolean;
  activeCommand: OpenCommandName | null;
  progressIndex: number;
  commandHistory: CommandName[];
  historyCursor: number | null;
  historyDraft: string;
  lastExecutedCommand: CommandName | null;
  error: string | null;
  canvasMode: CanvasMode;
  undoStack: UndoSnapshot[];
};

export type TerminalAction =
  | { type: 'SET_INPUT'; value: string }
  | { type: 'SELECT_SUGGESTION'; command: CommandName }
  | { type: 'SET_ACTIVE_COMMAND'; command: OpenCommandName }
  | { type: 'EXECUTE_COMMAND'; command: ParsedCommand }
  | { type: 'MOVE_SUGGESTION'; direction: 'next' | 'previous' }
  | { type: 'SET_HIGHLIGHTED_SUGGESTION'; index: number }
  | { type: 'BROWSE_HISTORY'; direction: 'previous' | 'next' }
  | { type: 'NAVIGATE'; direction: 'next' | 'back' }
  | { type: 'UNDO' }
  | { type: 'SET_ERROR'; message: string | null };
