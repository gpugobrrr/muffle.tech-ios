import { useCallback, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  composeSuggestionCommand,
  getCommandAssistance,
  parseCommand,
  type CommandSuggestion,
} from '@/lib/command-parser';
import { verifyCommandContract } from '@/lib/command-contract';
import { resolveLookup } from '@/lib/lookup';
import {
  canRemoveLastEditableCommandSegment,
  deletePreviousCommandPart,
  removeLastEditableCommandSegment,
} from '@/lib/command-edit';
import {
  composeFullCommand,
  isPinnablePath,
  pinCommandForPath,
  pinUiState,
  suffixForPath,
  type PinState,
} from '@/lib/pin-context';
import { formatCommandPath } from '@/lib/command-registry';
import {
  formatExecutionResult,
  structuredCommandPathFromInput,
  type SvyrExecutionResult,
} from '@/lib/field-information';
import { executeSurveyOperation } from '@/lib/survey-operations';
import type { InspectionBrief } from '@/types/workspace';

if (__DEV__) {
  // Both renderers consume this hook, so a single check covers portrait and
  // Power User mode: identical suggestions, registered commands only.
  const contractFailures = verifyCommandContract();
  if (contractFailures.length > 0) {
    console.warn(`SVYR command contract:\n${contractFailures.join('\n')}`);
  }
}

const INITIAL_BRIEF: InspectionBrief = {
  instruction: {
    instructingParty: null,
    client: null,
    reference: null,
  },
};

function announce(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}

function formatLookupTemporary(label: string, value: string): string {
  return `${label.toUpperCase()} · ${value}`;
}

/**
 * Single source of SVYR command state. Both orientations consume this hook,
 * so the registry, parser, command path, and suggestions never diverge.
 */
export type SvyrController = {
  commandSuffix: string;
  pinnedCommandPrefix: string[];
  fullCommandPath: string[];
  fullCommandText: string;
  suggestions: CommandSuggestion[];
  lastExecutionResult: SvyrExecutionResult;
  pinState: PinState;
  inspectionBrief: InspectionBrief;
  /** Derived from lastExecutionResult only — never from the live path. */
  infoBarText: string | null;
  temporaryAutocompleteContent: string | null;
  focusToken: number;
  setCommandSuffix: (value: string) => void;
  submitCommand: () => void;
  selectSuggestion: (suggestion: CommandSuggestion) => void;
  deletePreviousPart: () => void;
  moveUpDirectory: () => boolean;
  togglePin: () => void;
  requestTerminalFocus: () => void;
};

export function useSvyrController(): SvyrController {
  const [commandSuffix, setCommandSuffix] = useState('');
  const [pinnedCommandPrefix, setPinnedCommandPrefix] = useState<string[]>([]);
  const [isPinArmed, setIsPinArmed] = useState(false);
  const [temporaryAutocompleteContent, setTemporaryAutocompleteContent] =
    useState<string | null>(null);
  const [lastExecutionResult, setLastExecutionResult] =
    useState<SvyrExecutionResult>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [inspectionBrief, setInspectionBrief] =
    useState<InspectionBrief>(INITIAL_BRIEF);
  const pinnedRef = useRef<string[]>([]);
  const suffixRef = useRef('');
  const briefRef = useRef<InspectionBrief>(INITIAL_BRIEF);

  // Kept in sync during render, not in an effect: gesture and native-input
  // callbacks fire outside React's commit order and must never act on a
  // stale command path.
  pinnedRef.current = pinnedCommandPrefix;
  suffixRef.current = commandSuffix;
  briefRef.current = inspectionBrief;

  const pinState: PinState = useMemo(
    () => pinUiState(isPinArmed, pinnedCommandPrefix),
    [isPinArmed, pinnedCommandPrefix],
  );

  const suggestions = useMemo(
    () => getCommandAssistance(commandSuffix, pinnedCommandPrefix),
    [commandSuffix, pinnedCommandPrefix],
  );

  /**
   * Shared structural directory — portrait navigation and landscape CLI
   * both resolve against this recognised path (free-text values ignored).
   */
  const fullCommandPath = useMemo(
    () =>
      structuredCommandPathFromInput(commandSuffix, pinnedCommandPrefix),
    [commandSuffix, pinnedCommandPrefix],
  );

  const fullCommandText = useMemo(
    () => composeFullCommand(pinnedCommandPrefix, commandSuffix),
    [commandSuffix, pinnedCommandPrefix],
  );

  /** Visible only after a successful execution — never from path resolution. */
  const infoBarText = lastExecutionResult
    ? formatExecutionResult(lastExecutionResult)
    : null;

  const handleCommandSuffixChange = useCallback((value: string) => {
    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    setCommandSuffix(value);
  }, []);

  const applyPinContext = useCallback((path: string[]) => {
    setPinnedCommandPrefix(path);
    setIsPinArmed(false);
    setCommandSuffix('');
    setLastExecutionResult(null);
    setTemporaryAutocompleteContent(null);
    announce(`Pinned ${formatCommandPath(path)}`);
  }, []);

  const applyUnpinContext = useCallback(() => {
    setPinnedCommandPrefix([]);
    setIsPinArmed(false);
    setCommandSuffix('');
    setLastExecutionResult(null);
    setTemporaryAutocompleteContent(null);
    announce('Unpinned command');
  }, []);

  // ── Command execution ─────────────────────────────────────────────

  const executeCommand = useCallback(
    (rawCommand: string) => {
      const parsed = parseCommand(rawCommand);

      switch (parsed.type) {
        case 'pin-context':
          applyPinContext(parsed.path);
          return;

        case 'unpin-context':
          applyUnpinContext();
          return;

        case 'cannot-pin':
          setIsPinArmed(false);
          setLastExecutionResult(null);
          setTemporaryAutocompleteContent('CANNOT PIN VALUE COMMAND');
          announce('Cannot pin that command');
          return;

        case 'operation': {
          const result = executeSurveyOperation(
            briefRef.current,
            parsed.operation,
          );
          setIsPinArmed(false);

          if (!result) {
            setLastExecutionResult(null);
            setTemporaryAutocompleteContent(
              `${parsed.path[parsed.path.length - 1].toUpperCase()} NOT YET IMPLEMENTED`,
            );
            return;
          }

          setInspectionBrief(result.brief);
          setLastExecutionResult({
            operationId: result.operationId,
            label: result.label,
            value: result.value,
            executedCommand: rawCommand.trim(),
          });

          // One execution rule for both renderers: clear only the editable
          // suffix and preserve any protected pin.
          setCommandSuffix('');
          setTemporaryAutocompleteContent(null);
          announce(formatExecutionResult({
            operationId: result.operationId,
            label: result.label,
            value: result.value,
            executedCommand: rawCommand.trim(),
          }));
          return;
        }

        case 'placeholder': {
          const leaf = parsed.path[parsed.path.length - 1];

          // Stay on the parent branch so sibling commands remain available.
          setCommandSuffix(
            suffixForPath(parsed.path.slice(0, -1), pinnedRef.current),
          );
          setLastExecutionResult(null);
          setTemporaryAutocompleteContent(
            `${leaf.toUpperCase()} NOT YET IMPLEMENTED`,
          );
          announce(`${leaf} registered. Workflow not yet implemented`);
          setIsPinArmed(false);
          return;
        }

        case 'lookup': {
          const resolved = resolveLookup(
            `lookup ${parsed.query}`,
            briefRef.current,
          );
          if (resolved.type === 'result') {
            const info = formatLookupTemporary(
              resolved.result.label,
              resolved.result.value,
            );
            setLastExecutionResult({
              operationId: 'lookup',
              label: resolved.result.label,
              value: resolved.result.value,
              executedCommand: rawCommand.trim(),
            });
            setTemporaryAutocompleteContent(null);
            setCommandSuffix('');
            setFocusToken((n) => n + 1);
            announce(info);
            return;
          }
          if (resolved.type === 'empty') {
            setLastExecutionResult(null);
            setTemporaryAutocompleteContent('ENTER LOOKUP PATH');
            return;
          }
          setLastExecutionResult(null);
          setTemporaryAutocompleteContent('UNKNOWN COMMAND');
          announce('Unknown command');
          return;
        }

        case 'incomplete':
          setLastExecutionResult(null);
          setTemporaryAutocompleteContent(parsed.prompt);
          announce(parsed.prompt);
          return;

        case 'unknown':
        default:
          setIsPinArmed(false);
          setLastExecutionResult(null);
          setTemporaryAutocompleteContent('UNKNOWN COMMAND');
          announce('Unknown command');
      }
    },
    [applyPinContext, applyUnpinContext],
  );

  const executeTerminalInput = useCallback(
    (raw: string) => {
      const full = composeFullCommand(pinnedRef.current, raw);
      if (!full.trim()) return;
      executeCommand(full);
    },
    [executeCommand],
  );

  const requestTerminalFocus = useCallback(() => {
    setFocusToken((n) => n + 1);
  }, []);

  const submitCommand = useCallback(() => {
    executeTerminalInput(suffixRef.current);
    setFocusToken((n) => n + 1);
  }, [executeTerminalInput]);

  const selectSuggestion = useCallback(
    (suggestion: CommandSuggestion) => {
      if (suggestion.type === 'input-hint') return;

      setTemporaryAutocompleteContent(null);
      setLastExecutionResult(null);

      // Armed pin: pin the selected structural path instead of running it.
      if (isPinArmed) {
        if (suggestion.pinnable && isPinnablePath(suggestion.commandPath)) {
          executeCommand(pinCommandForPath(suggestion.commandPath));
          setFocusToken((n) => n + 1);
          return;
        }
        setIsPinArmed(false);
      }

      // Terminal argument-free suggestions execute immediately on tap.
      if (suggestion.isTerminal && !suggestion.requiresValue) {
        executeCommand(composeSuggestionCommand(suggestion));
        setFocusToken((n) => n + 1);
        return;
      }

      // Branches and value-bearing leaves insert and reveal what comes next.
      setCommandSuffix(suggestion.insertion);
      setFocusToken((n) => n + 1);
    },
    [executeCommand, isPinArmed],
  );

  /**
   * Right-swipe / directory-up: remove one editable structural segment.
   * Same path result as atomic Backspace. Ignores free-text values and
   * never mutates the pinned prefix.
   */
  const moveUpDirectory = useCallback(() => {
    const current = suffixRef.current;
    if (!canRemoveLastEditableCommandSegment(current, pinnedRef.current)) {
      return false;
    }

    const next = removeLastEditableCommandSegment(current, pinnedRef.current);
    if (next === current) {
      return false;
    }

    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    setCommandSuffix(next);
    setFocusToken((n) => n + 1);
    return true;
  }, []);

  /**
   * Shared semantic delete action. TextInput decides when native character
   * deletion is appropriate; atomic command deletion delegates here.
   */
  const deletePreviousPart = useCallback(() => {
    const current = suffixRef.current;
    if (!current) return;

    const next = deletePreviousCommandPart(current, pinnedRef.current);
    if (next === current) return;

    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    setCommandSuffix(next);
    setFocusToken((n) => n + 1);
  }, []);

  const togglePin = useCallback(() => {
    const state = pinUiState(isPinArmed, pinnedRef.current);

    if (state === 'inactive') {
      setIsPinArmed(true);
      announce('Pin armed');
      return;
    }

    if (state === 'armed') {
      setIsPinArmed(false);
      announce('Pin disarmed');
      return;
    }

    if (suffixRef.current.trim().length > 0) {
      setTemporaryAutocompleteContent('CLEAR OR SUBMIT BEFORE UNPINNING');
      announce('Clear or submit suffix before unpinning');
      return;
    }

    executeCommand('unpin');
  }, [executeCommand, isPinArmed]);

  return {
    inspectionBrief,
    fullCommandPath,
    fullCommandText,
    commandSuffix,
    setCommandSuffix: handleCommandSuffixChange,
    pinnedCommandPrefix,
    pinState,
    togglePin,
    suggestions,
    lastExecutionResult,
    temporaryAutocompleteContent,
    infoBarText,
    focusToken,
    requestTerminalFocus,
    submitCommand,
    selectSuggestion,
    deletePreviousPart,
    moveUpDirectory,
  };
}
