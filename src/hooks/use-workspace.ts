import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { verifyCommandContract } from '@/lib/command-contract';
import {
    canRemoveLastEditableCommandSegment,
    deletePreviousCommandPart,
    parseEditableCommand,
    removeLastEditableCommandSegment,
} from '@/lib/command-edit';
import {
    composeSuggestionCommand,
    getCommandAssistance,
    parseCommand,
    type CommandSuggestion,
    type TokenSuggestion,
} from '@/lib/command-parser';
import {
    findCommandNode,
    formatCommandPath,
    formatSvyrPathForDisplay,
    type CommandNode,
} from '@/lib/command-registry';
import {
    formatExecutionResult,
    structuredCommandPathFromInput,
    type SvyrExecutionResult,
} from '@/lib/field-information';
import { findFieldDefinition, normalizeFieldInputValue } from '@/lib/field-schema';
import {
  orderMultiChoiceValues,
  prepareMultiChoiceCommit,
  toggleMultiChoiceValue,
} from '@/lib/multi-choice';
import { createEmptyInspectionRecord } from '@/lib/inspection-record';
import { commitInspectionFindingField, resolveFindingFieldValue } from '@/lib/level-2-finding-capture';
import { resolveLookup } from '@/lib/lookup';
import {
    composeFullCommand,
    isPinnablePath,
    pathKey,
    pinCommandForPath,
    suffixForPath,
} from '@/lib/pin-context';
import { executeSurveyOperation } from '@/lib/survey-operations';
import {
  clearEntryDraft,
  readEntryDraft,
  readMultiChoiceEntryDraft,
  stashEntryDraft,
  stashMultiChoiceEntryDraft,
  suffixForDataEntryReentry,
  type SvyrEntryDraftsByPath,
} from '@/lib/svyr-entry-drafts';
import {
  resolveSvyrBarRootTarget,
  resolveSvyrBarSegmentTarget,
} from '@/lib/svyr-bar-navigation';
import type { SvyrNotesByPath } from '@/lib/svyr-notes';
import type {
  ActiveJob,
  ActiveProperty,
  InspectionBrief,
} from '@/types/workspace';

if (__DEV__) {
  // Single Power User presentation consumes this hook — one contract check
  // covers the shared registry, parser, and suggestion resolver.
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
    source: null,
  },
  purpose: null,
  deliverable: null,
  limitation: null,
};

/** Demo job site — presentation reads this; it never hard-codes the address. */
const INITIAL_JOB: ActiveJob = {
  property: {
    displayAddress: '18 Market Street',
    instructionType: 'Level 2 Building Survey',
  },
  inspection: createEmptyInspectionRecord(),
};

function announce(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}

function formatLookupTemporary(label: string, value: string): string {
  return `${label.toUpperCase()} · ${value}`;
}

/** Pin acknowledgement lifetime — long enough to read, short enough to forget. */
const TRANSIENT_FEEDBACK_MS = 1000;

/**
 * Interaction acknowledgement (pinning), kept apart from execution results
 * so a pin can never look like a command output.
 */
export type SvyrTransientFeedback = {
  message: string;
  expiresAt: number;
} | null;

/**
 * Structural navigation versus free-text entry. Only a value-bearing command
 * opens data entry, so the keyboard and caret never appear while browsing
 * the hierarchy.
 */
export type SvyrInputMode = 'navigation' | 'data-entry';

/**
 * The active value-bearing command while the dedicated entry panel is open.
 * The structural path stays available for canonical resolution but is not
 * rendered in Power User data-entry mode.
 */
export type ActiveEntryField = {
  path: string[];
  node: CommandNode;
};

export type ActiveCompoundCapture = {
  path: string[];
  node: CommandNode;
};

/**
 * Single source of SVYR command state for the landscape Power User workspace.
 * The registry, parser, command path, and suggestions all resolve here.
 */
export type SvyrController = {
  commandSuffix: string;
  pinnedCommandPrefix: string[];
  /** Recognised structural segments of the editable suffix. */
  editablePath: string[];
  /** Data-entry SVYR directory, updated only by accepted navigation changes. */
  dataEntryDirectory: string[];
  /** Free text typed after a value-bearing path. */
  entryValue: string;
  inputMode: SvyrInputMode;
  /** Active value-bearing field while the dedicated entry panel is open. */
  activeEntryField: ActiveEntryField | null;
  /** Grouped controlled capture surface for a compound registry branch. */
  activeCompoundCapture: ActiveCompoundCapture | null;
  /** Compact validation message inside the entry panel — never a nav dock error. */
  entryError: string | null;
  fullCommandPath: string[];
  fullCommandText: string;
  suggestions: CommandSuggestion[];
  lastExecutionResult: SvyrExecutionResult;
  inspectionBrief: InspectionBrief;
  /** Active survey job — header property and future job-scoped state. */
  activeJob: ActiveJob;
  setActiveProperty: (property: ActiveProperty) => void;
  /** Derived from lastExecutionResult only — never from the live path. */
  infoBarText: string | null;
  /** Brief pin acknowledgement — expires on its own. */
  transientFeedbackText: string | null;
  temporaryAutocompleteContent: string | null;
  focusToken: number;
  /** Long-press eligibility for the currently visible structural path. */
  canPinCurrentPath: boolean;
  /** True when the visible path is exactly what is already pinned. */
  isCurrentPathPinned: boolean;
  setCommandSuffix: (value: string) => void;
  /** Open root SVYR navigation without changing canonical survey state. */
  openRootNavigation: () => void;
  setEntryValue: (value: string) => void;
  beginDataEntry: (suggestion: TokenSuggestion) => void;
  /** Guarded cancel: never discards a value the surveyor has typed. */
  cancelCurrentInteraction: () => boolean;
  submitCommand: () => void;
  /** Returns true only after a value-bearing command executes successfully. */
  submitDataEntry: () => boolean;
  commitFieldValue: (path: string[], value: string) => boolean;
  /** Immediate controlled-fact commit used by grouped capture surfaces. */
  commitControlledFieldValue: (path: string[], value: string) => boolean;
  /** Immediate controlled-fact set commit used by grouped capture surfaces. */
  commitControlledSetFieldValue: (
    path: string[],
    values: readonly string[],
  ) => boolean;
  /** Working multi-choice selection for the active field (transient draft). */
  activeMultiChoiceValues: readonly string[];
  toggleMultiChoiceDraft: (canonicalValue: string) => void;
  /**
   * Explicit multi-choice commit. Validates the whole set; does not invent
   * scalar Engine encoding when set-valued writes are unavailable.
   */
  commitMultiChoiceField: () => boolean;
  selectSuggestion: (suggestion: CommandSuggestion) => void;
  /**
   * Shared SVYR bar segment navigation. Earlier segments jump to that level;
   * the final segment performs one-level BACK. Never commits field values.
   */
  navigateToDataEntrySegment: (index: number) => boolean;
  /** Shared SVYR root press — never pops below an empty editable path. */
  navigateToSvyrRoot: () => boolean;
  deletePreviousPart: () => void;
  moveUpDirectory: () => boolean;
  /** Returns true only when the current path is newly pinned. */
  toggleCurrentPathPin: () => boolean;
  requestTerminalFocus: () => void;
  /**
   * Freeform notes keyed by ASCII command path. Separate from job-record
   * field values and completion counts.
   */
  notesByPath: SvyrNotesByPath;
  setPathNote: (pathKey: string, note: string) => void;
  /**
   * Transient uncommitted text-entry drafts keyed by field path.
   * Never canonical Engine state, notes, or completion.
   */
  entryDraftsByPath: SvyrEntryDraftsByPath;
};

export function useSvyrController(): SvyrController {
  const [commandSuffix, setCommandSuffix] = useState('');
  const [dataEntryDirectory, setDataEntryDirectory] = useState<string[]>([]);
  const [pinnedCommandPrefix, setPinnedCommandPrefix] = useState<string[]>([]);
  const [temporaryAutocompleteContent, setTemporaryAutocompleteContent] =
    useState<string | null>(null);
  const [transientFeedback, setTransientFeedback] =
    useState<SvyrTransientFeedback>(null);
  const [lastExecutionResult, setLastExecutionResult] =
    useState<SvyrExecutionResult>(null);
  const [focusToken, setFocusToken] = useState(0);
  /**
   * Active value-bearing field. Presence alone defines data-entry mode —
   * never inferred from a trailing space in the raw command string.
   */
  const [activeEntryField, setActiveEntryField] =
    useState<ActiveEntryField | null>(null);
  const [activeCompoundCapture, setActiveCompoundCapture] =
    useState<ActiveCompoundCapture | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [notesByPath, setNotesByPath] = useState<SvyrNotesByPath>({});
  const [entryDraftsByPath, setEntryDraftsByPath] =
    useState<SvyrEntryDraftsByPath>({});
  const [inspectionBrief, setInspectionBrief] =
    useState<InspectionBrief>(INITIAL_BRIEF);
  const [activeJob, setActiveJobState] = useState<ActiveJob>(INITIAL_JOB);
  const pinnedRef = useRef<string[]>([]);
  const suffixRef = useRef('');
  const briefRef = useRef<InspectionBrief>(INITIAL_BRIEF);
  const activeJobRef = useRef<ActiveJob>(INITIAL_JOB);
  const activeEntryRef = useRef<ActiveEntryField | null>(null);
  const activeCompoundCaptureRef = useRef<ActiveCompoundCapture | null>(null);
  const dataEntryDirectoryRef = useRef<string[]>([]);
  const entryDraftsByPathRef = useRef<SvyrEntryDraftsByPath>({});
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kept in sync during render, not in an effect: gesture and native-input
  // callbacks fire outside React's commit order and must never act on a
  // stale command path.
  pinnedRef.current = pinnedCommandPrefix;
  suffixRef.current = commandSuffix;
  briefRef.current = inspectionBrief;
  activeJobRef.current = activeJob;
  activeEntryRef.current = activeEntryField;
  activeCompoundCaptureRef.current = activeCompoundCapture;
  dataEntryDirectoryRef.current = dataEntryDirectory;
  entryDraftsByPathRef.current = entryDraftsByPath;

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  /** Acknowledge an interaction without leaving anything on screen. */
  const showTransientFeedback = useCallback((message: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setTransientFeedback({
      message,
      expiresAt: Date.now() + TRANSIENT_FEEDBACK_MS,
    });
    feedbackTimer.current = setTimeout(
      () => setTransientFeedback(null),
      TRANSIENT_FEEDBACK_MS,
    );
    announce(message);
  }, []);

  const suggestions = useMemo(
    () => getCommandAssistance(commandSuffix, pinnedCommandPrefix),
    [commandSuffix, pinnedCommandPrefix],
  );

  /**
   * Shared structural directory for autocomplete, completion, and pinning
   * (free-text values ignored).
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

  /** Grammar-based split of the editable suffix into path and free text. */
  const editableCommand = useMemo(
    () => parseEditableCommand(commandSuffix, pinnedCommandPrefix),
    [commandSuffix, pinnedCommandPrefix],
  );
  const editablePath = editableCommand.structuredTokens;
  const entryValue = editableCommand.valueText;

  /**
   * Dedicated entry mode is explicit: an active field means the navigation
   * dock is replaced entirely. Leaving clears the field, never the reverse.
   */
  const inputMode: SvyrInputMode =
    activeEntryField || activeCompoundCapture ? 'data-entry' : 'navigation';

  /** Visible only after a successful execution — never from path resolution. */
  const infoBarText = lastExecutionResult
    ? formatExecutionResult(lastExecutionResult)
    : null;

  const clearActiveEntry = useCallback(() => {
    setActiveEntryField(null);
    setActiveCompoundCapture(null);
    setEntryError(null);
  }, []);

  const openRootNavigation = useCallback(() => {
    setPinnedCommandPrefix([]);
    setCommandSuffix('');
    setDataEntryDirectory([]);
    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    clearActiveEntry();
    setFocusToken((token) => token + 1);
  }, [clearActiveEntry]);

  const setDataEntryDirectoryForPath = useCallback((path: string[]) => {
    const pinned = pinnedRef.current;
    const isPinnedPrefix = pinned.every(
      (segment, index) => path[index] === segment,
    );
    const nextPath = isPinnedPrefix ? path.slice(pinned.length) : [...path];
    setDataEntryDirectory((current) => {
      const sharesCurrentPrefix =
        current.length + 1 === nextPath.length &&
        current.every((segment, index) => nextPath[index] === segment);
      const nextSegment = nextPath.at(-1);
      if (sharesCurrentPrefix && nextSegment) {
        return [...current, nextSegment];
      }
      return nextPath;
    });
  }, []);

  const handleCommandSuffixChange = useCallback((value: string) => {
    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    setEntryError(null);
    setCommandSuffix(value);
  }, []);

  /**
   * Only the free text is editable — the structural path is rebuilt from the
   * active entry field, so no keystroke can damage it.
   */
  const setEntryValue = useCallback((value: string) => {
    const field = activeEntryRef.current;
    if (!field) return;

    setEntryError(null);
    setLastExecutionResult(null);
    setTemporaryAutocompleteContent(null);
    setCommandSuffix(
      `${suffixForPath(field.path, pinnedRef.current).replace(/\s+$/, '')} ${value}`,
    );
  }, []);

  const applyPinContext = useCallback(
    (path: string[]) => {
      setPinnedCommandPrefix(path);
      setDataEntryDirectory([]);
      setCommandSuffix('');
      clearActiveEntry();
      setLastExecutionResult(null);
      setTemporaryAutocompleteContent(null);
      showTransientFeedback(
        `${formatSvyrPathForDisplay(formatCommandPath(path))} pinned`,
      );
    },
    [clearActiveEntry, showTransientFeedback],
  );

  const applyUnpinContext = useCallback(() => {
    setPinnedCommandPrefix([]);
    setDataEntryDirectory([]);
    setCommandSuffix('');
    clearActiveEntry();
    setLastExecutionResult(null);
    setTemporaryAutocompleteContent(null);
    showTransientFeedback('context released');
  }, [clearActiveEntry, showTransientFeedback]);

  // ── Command execution ─────────────────────────────────────────────

  const executeCommand = useCallback(
    (rawCommand: string, options?: { fromDataEntry?: boolean }) => {
      const fromDataEntry = Boolean(options?.fromDataEntry);
      const parsed = parseCommand(rawCommand);

      switch (parsed.type) {
        case 'pin-context':
          applyPinContext(parsed.path);
          return true;

        case 'unpin-context':
          applyUnpinContext();
          return true;

        case 'cannot-pin':
          setLastExecutionResult(null);
          if (fromDataEntry) {
            setEntryError('Cannot pin value command');
            setFocusToken((n) => n + 1);
          } else {
            setTemporaryAutocompleteContent('CANNOT PIN VALUE COMMAND');
          }
          announce('Cannot pin that command');
          return false;

        case 'operation': {
          const result = executeSurveyOperation(
            briefRef.current,
            parsed.operation,
          );

          if (!result) {
            setLastExecutionResult(null);
            if (fromDataEntry) {
              setEntryError('Not yet implemented');
              setFocusToken((n) => n + 1);
            } else {
              setTemporaryAutocompleteContent(
                `${parsed.path[parsed.path.length - 1].toUpperCase()} NOT YET IMPLEMENTED`,
              );
              clearActiveEntry();
            }
            return false;
          }

          // Capture parent before clearing entry so navigation restores context.
          const submittedEntryPath = activeEntryRef.current?.path ?? null;
          const entryParent =
            fromDataEntry && submittedEntryPath
              ? submittedEntryPath.slice(0, -1)
              : null;

          setInspectionBrief(result.brief);
          setLastExecutionResult({
            operationId: result.operationId,
            label: result.label,
            value: result.value,
            executedCommand: rawCommand.trim(),
          });

          if (fromDataEntry && submittedEntryPath) {
            setEntryDraftsByPath((current) =>
              clearEntryDraft(current, submittedEntryPath),
            );
          }
          clearActiveEntry();
          setTemporaryAutocompleteContent(null);
          if (entryParent && entryParent.length > 0) {
            setDataEntryDirectoryForPath(entryParent);
            setCommandSuffix(suffixForPath(entryParent, pinnedRef.current));
          } else {
            setDataEntryDirectory([]);
            setCommandSuffix('');
          }
          announce(
            formatExecutionResult({
              operationId: result.operationId,
              label: result.label,
              value: result.value,
              executedCommand: rawCommand.trim(),
            }),
          );
          return true;
        }

        case 'placeholder': {
          const leaf = parsed.path[parsed.path.length - 1];

          if (fromDataEntry) {
            setEntryError('Not yet implemented');
            setFocusToken((n) => n + 1);
            announce(`${leaf} registered. Workflow not yet implemented`);
            return false;
          }

          // Stay on the parent branch so sibling commands remain available.
          setCommandSuffix(
            suffixForPath(parsed.path.slice(0, -1), pinnedRef.current),
          );
          clearActiveEntry();
          setLastExecutionResult(null);
          setTemporaryAutocompleteContent(
            `${leaf.toUpperCase()} NOT YET IMPLEMENTED`,
          );
          announce(`${leaf} registered. Workflow not yet implemented`);
          return false;
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
            clearActiveEntry();
            setFocusToken((n) => n + 1);
            announce(info);
            return true;
          }
          if (resolved.type === 'empty') {
            setLastExecutionResult(null);
            setTemporaryAutocompleteContent('ENTER LOOKUP PATH');
            return false;
          }
          setLastExecutionResult(null);
          setTemporaryAutocompleteContent('UNKNOWN COMMAND');
          announce('Unknown command');
          return false;
        }

        case 'incomplete':
          setLastExecutionResult(null);
          if (fromDataEntry) {
            setEntryError(parsed.prompt);
            setFocusToken((n) => n + 1);
          } else {
            setTemporaryAutocompleteContent(parsed.prompt);
          }
          announce(parsed.prompt);
          return false;

        case 'unknown':
        default:
          setLastExecutionResult(null);
          if (fromDataEntry) {
            setEntryError('Unknown command');
            setFocusToken((n) => n + 1);
          } else {
            setTemporaryAutocompleteContent('UNKNOWN COMMAND');
          }
          announce('Unknown command');
          return false;
      }
    },
    [applyPinContext, applyUnpinContext, clearActiveEntry, setDataEntryDirectoryForPath],
  );

  const executeTerminalInput = useCallback(
    (raw: string) => {
      const full = composeFullCommand(pinnedRef.current, raw);
      if (!full.trim()) return false;
      return executeCommand(full);
    },
    [executeCommand],
  );

  const commitControlledFieldValue = useCallback(
    (path: string[], value: string): boolean => {
      const fieldDefinition = findFieldDefinition(path);
      const normalizedValue = normalizeFieldInputValue(fieldDefinition, value);
      if (!normalizedValue || !fieldDefinition?.operationId) {
        setEntryError('Choose an available option');
        setFocusToken((token) => token + 1);
        announce('Choose an available option');
        return false;
      }

      const result = executeSurveyOperation(briefRef.current, {
        operationId: fieldDefinition.operationId,
        arguments: {
          fieldId: fieldDefinition.fieldId,
          value: normalizedValue,
        },
      });

      if (!result) {
        setEntryError('Not yet implemented');
        setFocusToken((token) => token + 1);
        announce('Not yet implemented');
        return false;
      }

      setInspectionBrief(result.brief);
      setLastExecutionResult({
        operationId: result.operationId,
        label: result.label,
        value: result.value,
        executedCommand: `${formatCommandPath(path)} ${normalizedValue}`,
      });
      setEntryError(null);
      setTemporaryAutocompleteContent(null);
      announce(
        formatExecutionResult({
          operationId: result.operationId,
          label: result.label,
          value: result.value,
          executedCommand: `${formatCommandPath(path)} ${normalizedValue}`,
        }),
      );
      return true;
    },
    [],
  );

  const commitControlledSetFieldValue = useCallback(
    (path: string[], values: readonly string[]): boolean => {
      const fieldDefinition = findFieldDefinition(path);
      if (!fieldDefinition || fieldDefinition.valueType !== 'multiSelect') {
        return false;
      }

      const prepared = prepareMultiChoiceCommit(fieldDefinition, values);
      if (!prepared.ok) {
        setEntryError(prepared.message);
        setFocusToken((token) => token + 1);
        announce(prepared.message);
        return false;
      }

      if (!prepared.engineWritable) {
        setEntryError('Not yet implemented');
        setFocusToken((token) => token + 1);
        announce('Not yet implemented');
        return false;
      }

      const result = executeSurveyOperation(briefRef.current, {
        operationId: fieldDefinition.operationId!,
        arguments: {
          fieldId: fieldDefinition.fieldId,
          values: prepared.values,
        },
      });

      if (!result) {
        setEntryError('Not yet implemented');
        setFocusToken((token) => token + 1);
        announce('Not yet implemented');
        return false;
      }

      setInspectionBrief(result.brief);
      setLastExecutionResult({
        operationId: result.operationId,
        label: result.label,
        value: result.value,
        executedCommand: `${formatCommandPath(path)} [done]`,
      });
      setEntryError(null);
      setTemporaryAutocompleteContent(null);
      announce(
        formatExecutionResult({
          operationId: result.operationId,
          label: result.label,
          value: result.value,
          executedCommand: `${formatCommandPath(path)} [done]`,
        }),
      );
      return true;
    },
    [],
  );

  const commitFieldValue = useCallback(
    (path: string[], value: string): boolean => {
      const fieldDefinition = findFieldDefinition(path);
      const normalizedValue = normalizeFieldInputValue(fieldDefinition, value);
      const activeEntry = activeEntryRef.current;
      const fromDataEntry =
        activeEntry?.path.length === path.length &&
        activeEntry.path.every((segment, index) => segment === path[index]);
      if (!normalizedValue) {
        if (fromDataEntry) {
          setEntryError('Choose an available option');
          setFocusToken((token) => token + 1);
        }
        return false;
      }
      return executeCommand(`${formatCommandPath(path)} ${normalizedValue}`, {
        fromDataEntry,
      });
    },
    [executeCommand],
  );

  const commitFindingDataEntry = useCallback(
    (field: ActiveEntryField, value: string): boolean => {
      const target = field.node.findingTarget;
      if (!target) return false;

      const committed = commitInspectionFindingField(
        activeJobRef.current.inspection,
        target,
        value,
      );
      if (!committed.ok) {
        setEntryError(committed.message);
        setFocusToken((n) => n + 1);
        announce(committed.message);
        return false;
      }

      const submittedCommand = `${formatCommandPath(field.path)} ${value.trim()}`;
      const entryParent = field.path.slice(0, -1);
      setActiveJobState((current) => ({
        ...current,
        inspection: committed.result.inspection,
      }));
      setLastExecutionResult({
        operationId: committed.result.operationId,
        label: field.node.entryLabel ?? target.field,
        value: value.trim(),
        executedCommand: submittedCommand,
      });
      setEntryDraftsByPath((current) => clearEntryDraft(current, field.path));
      clearActiveEntry();
      setTemporaryAutocompleteContent(null);
      if (entryParent.length > 0) {
        setDataEntryDirectoryForPath(entryParent);
        setCommandSuffix(suffixForPath(entryParent, pinnedRef.current));
      } else {
        setDataEntryDirectory([]);
        setCommandSuffix('');
      }
      announce(`${field.node.entryLabel ?? target.field} recorded`);
      return true;
    },
    [clearActiveEntry, setDataEntryDirectoryForPath],
  );

  const requestTerminalFocus = useCallback(() => {
    setFocusToken((n) => n + 1);
  }, []);

  const submitCommand = useCallback(() => {
    executeTerminalInput(suffixRef.current);
    setFocusToken((n) => n + 1);
  }, [executeTerminalInput]);

  /**
   * The only route into data entry: a value-bearing command was chosen, so
   * free text is genuinely required. The structural path is preserved
   * internally; the navigation dock is replaced by the entry panel.
   */
  const beginDataEntry = useCallback((suggestion: TokenSuggestion) => {
    const node = findCommandNode(suggestion.commandPath);
    if (!node?.requiresValue) return;

    const fieldDefinition = findFieldDefinition(suggestion.commandPath);
    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    setEntryError(null);
    setActiveEntryField({ path: suggestion.commandPath, node });
    setDataEntryDirectoryForPath(suggestion.commandPath);

    if (fieldDefinition?.valueType === 'multiSelect') {
      // Working set lives in the typed draft map — not commandSuffix free text.
      if (
        readMultiChoiceEntryDraft(
          entryDraftsByPathRef.current,
          suggestion.commandPath,
        ) === undefined
      ) {
        setEntryDraftsByPath((current) =>
          stashMultiChoiceEntryDraft(current, suggestion.commandPath, []),
        );
      }
      setCommandSuffix(suggestion.insertion);
      setFocusToken((n) => n + 1);
      return;
    }

    const stashedDraft = readEntryDraft(
      entryDraftsByPathRef.current,
      suggestion.commandPath,
    );
    const canonicalFindingValue = node.findingTarget
      ? resolveFindingFieldValue(
          activeJobRef.current.inspection,
          node.findingTarget,
        )
      : null;
    setCommandSuffix(
      suffixForDataEntryReentry({
        path: suggestion.commandPath,
        pinnedPrefix: pinnedRef.current,
        draft: stashedDraft ?? canonicalFindingValue,
        defaultInsertion: suggestion.insertion,
        suffixForPath,
      }),
    );
    setFocusToken((n) => n + 1);
  }, [setDataEntryDirectoryForPath]);

  const beginCompoundCapture = useCallback(
    (suggestion: TokenSuggestion) => {
      const node = findCommandNode(suggestion.commandPath);
      if (!node?.compoundCapture) return;

      setTemporaryAutocompleteContent(null);
      setLastExecutionResult(null);
      setEntryError(null);
      setActiveEntryField(null);
      setActiveCompoundCapture({ path: suggestion.commandPath, node });
      setDataEntryDirectoryForPath(suggestion.commandPath);
      setCommandSuffix(suggestion.insertion);
      setFocusToken((token) => token + 1);
    },
    [setDataEntryDirectoryForPath],
  );

  /** Leave data entry and restore the parent structural path (no Engine write). */
  const cancelDataEntry = useCallback(() => {
    const field = activeEntryRef.current;
    const compound = activeCompoundCaptureRef.current;
    if (!field && !compound) return;

    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    setEntryError(null);
    setActiveEntryField(null);
    setActiveCompoundCapture(null);
    const path = field?.path ?? compound?.path ?? [];
    setDataEntryDirectory((current) => current.slice(0, -1));
    setCommandSuffix(
      suffixForPath(path.slice(0, -1), pinnedRef.current),
    );
  }, []);

  /**
   * Stash the active field's uncommitted text under its path key.
   * Multi-choice working sets are already path-keyed in entryDraftsByPath.
   * Empty text drafts clear any prior text stash so re-entry starts fresh.
   */
  const stashActiveEntryDraft = useCallback(() => {
    const field = activeEntryRef.current;
    if (!field) return;
    const fieldDefinition = findFieldDefinition(field.path);
    if (fieldDefinition?.valueType === 'multiSelect') return;
    const draft = parseEditableCommand(
      suffixRef.current,
      pinnedRef.current,
    ).valueText;
    setEntryDraftsByPath((current) =>
      stashEntryDraft(current, field.path, draft),
    );
  }, []);

  const activeMultiChoiceValues = useMemo((): readonly string[] => {
    if (!activeEntryField) return [];
    return (
      readMultiChoiceEntryDraft(entryDraftsByPath, activeEntryField.path) ?? []
    );
  }, [activeEntryField, entryDraftsByPath]);

  const toggleMultiChoiceDraft = useCallback((canonicalValue: string) => {
    const field = activeEntryRef.current;
    if (!field) return;
    const fieldDefinition = findFieldDefinition(field.path);
    if (fieldDefinition?.valueType !== 'multiSelect') return;

    setEntryError(null);
    setLastExecutionResult(null);
    setEntryDraftsByPath((current) => {
      const selected =
        readMultiChoiceEntryDraft(current, field.path) ?? [];
      const next = orderMultiChoiceValues(
        fieldDefinition,
        toggleMultiChoiceValue(selected, canonicalValue),
      );
      return stashMultiChoiceEntryDraft(current, field.path, next);
    });
  }, []);

  /**
   * Explicit [done] commit for multi-choice. Validates the whole selection.
   * Until Engine operations accept set-valued payloads, refuses to write and
   * does not invent comma-separated scalar encoding.
   */
  const commitMultiChoiceField = useCallback((): boolean => {
    const field = activeEntryRef.current;
    if (!field) return false;
    const fieldDefinition = findFieldDefinition(field.path);
    if (!fieldDefinition || fieldDefinition.valueType !== 'multiSelect') {
      return false;
    }

    const selected =
      readMultiChoiceEntryDraft(entryDraftsByPathRef.current, field.path) ??
      [];
    const prepared = prepareMultiChoiceCommit(fieldDefinition, selected);
    if (!prepared.ok) {
      setEntryError(prepared.message);
      setFocusToken((token) => token + 1);
      announce(prepared.message);
      return false;
    }

    if (!prepared.engineWritable) {
      setEntryError('Not yet implemented');
      setFocusToken((token) => token + 1);
      announce('Not yet implemented');
      return false;
    }

    const result = executeSurveyOperation(briefRef.current, {
      operationId: fieldDefinition.operationId!,
      arguments: {
        fieldId: fieldDefinition.fieldId,
        values: prepared.values,
      },
    });

    if (!result) {
      setEntryError('Not yet implemented');
      setFocusToken((token) => token + 1);
      announce('Not yet implemented');
      return false;
    }

    setInspectionBrief(result.brief);
    setLastExecutionResult({
      operationId: result.operationId,
      label: result.label,
      value: result.value,
      executedCommand: `${formatCommandPath(field.path)} [done]`,
    });
    setEntryDraftsByPath((current) => clearEntryDraft(current, field.path));
    clearActiveEntry();
    setTemporaryAutocompleteContent(null);
    const entryParent = field.path.slice(0, -1);
    if (entryParent.length > 0) {
      setDataEntryDirectoryForPath(entryParent);
      setCommandSuffix(suffixForPath(entryParent, pinnedRef.current));
    } else {
      setDataEntryDirectory([]);
      setCommandSuffix('');
    }
    announce(
      formatExecutionResult({
        operationId: result.operationId,
        label: result.label,
        value: result.value,
        executedCommand: `${formatCommandPath(field.path)} [done]`,
      }),
    );
    return true;
  }, [clearActiveEntry, setDataEntryDirectoryForPath]);

  /**
   * Shared SVYR bar path for navigation handlers. Data-entry mode prefers the
   * dedicated directory; otherwise use the parsed editable structural path.
   */
  const currentSvyrBarPath = useCallback((): string[] => {
    if (activeEntryRef.current) {
      return dataEntryDirectoryRef.current;
    }
    if (activeCompoundCaptureRef.current) {
      return dataEntryDirectoryRef.current;
    }
    return parseEditableCommand(suffixRef.current, pinnedRef.current)
      .structuredTokens;
  }, []);

  /**
   * Apply a structural path from the shared SVYR bar without committing values.
   * Always navigates — uncommitted text is stashed by field path, never blocks.
   */
  const applySvyrBarPath = useCallback(
    (targetDirectory: string[]): boolean => {
      stashActiveEntryDraft();

      setTemporaryAutocompleteContent(null);
      setLastExecutionResult(null);
      setEntryError(null);
      setActiveEntryField(null);
      setActiveCompoundCapture(null);
      setDataEntryDirectory(targetDirectory);
      setCommandSuffix(suffixForPath(targetDirectory, pinnedRef.current));
      setFocusToken((token) => token + 1);
      return true;
    },
    [stashActiveEntryDraft],
  );
  /**
   * Shared SVYR bar segment press:
   * - earlier segment → jump directly to that path level
   * - final segment → one-level BACK
   */
  const navigateToDataEntrySegment = useCallback(
    (index: number): boolean => {
      const targetDirectory = resolveSvyrBarSegmentTarget(
        currentSvyrBarPath(),
        index,
      );
      if (!targetDirectory) return false;
      return applySvyrBarPath(targetDirectory);
    },
    [applySvyrBarPath, currentSvyrBarPath],
  );

  const navigateToSvyrRoot = useCallback((): boolean => {
    const current = currentSvyrBarPath();
    const targetDirectory = resolveSvyrBarRootTarget(current);
    if (current.length === 0) return false;
    return applySvyrBarPath(targetDirectory);
  }, [applySvyrBarPath, currentSvyrBarPath]);

  const selectSuggestion = useCallback(
    (suggestion: CommandSuggestion) => {
      if (suggestion.type === 'input-hint') return;

      setTemporaryAutocompleteContent(null);
      setLastExecutionResult(null);
      setEntryError(null);

      // Value-bearing leaves are the only commands that open the keyboard.
      if (suggestion.requiresValue) {
        beginDataEntry(suggestion);
        return;
      }

      if (suggestion.compoundCapture) {
        beginCompoundCapture(suggestion);
        return;
      }

      if (suggestion.workflowOnly) {
        const node = findCommandNode(suggestion.commandPath);
        clearActiveEntry();
        setDataEntryDirectoryForPath(suggestion.commandPath);
        setCommandSuffix(suggestion.insertion);
        setTemporaryAutocompleteContent(
          node?.coverage?.status === 'derived-publication'
            ? 'DERIVED FROM CANONICAL CAPTURE'
            : node?.coverage?.status === 'pre-populated'
              ? 'PRE-POPULATED FROM PROPERTY SELECTION'
              : 'CAPTURE NOT YET SUPPORTED',
        );
        setFocusToken((n) => n + 1);
        return;
      }

      // Terminal argument-free suggestions execute immediately on tap.
      if (suggestion.isTerminal) {
        clearActiveEntry();
        if (executeCommand(composeSuggestionCommand(suggestion))) {
          setDataEntryDirectoryForPath(suggestion.commandPath);
        }
        setFocusToken((n) => n + 1);
        return;
      }

      // Branches insert and reveal what comes next — still keyboard-free.
      clearActiveEntry();
      setDataEntryDirectoryForPath(suggestion.commandPath);
      setCommandSuffix(suggestion.insertion);
      setFocusToken((n) => n + 1);
    },
    [beginCompoundCapture, beginDataEntry, clearActiveEntry, executeCommand, setDataEntryDirectoryForPath],
  );

  /**
   * Right-swipe / directory-up: remove one editable structural segment.
   * Same path result as atomic Backspace. Ignores free-text values and
   * never mutates the pinned prefix.
   */
  const moveUpDirectory = useCallback(() => {
    // Dedicated entry: stash any uncommitted draft, then leave without commit.
    if (activeEntryRef.current || activeCompoundCaptureRef.current) {
      if (activeEntryRef.current) {
        stashActiveEntryDraft();
      }
      cancelDataEntry();
      setFocusToken((n) => n + 1);
      return true;
    }

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
    setDataEntryDirectory((current) => current.slice(0, -1));
    setCommandSuffix(next);
    setFocusToken((n) => n + 1);
    return true;
  }, [cancelDataEntry, stashActiveEntryDraft]);

  /**
   * Shared semantic delete action. TextInput decides when native character
   * deletion is appropriate; atomic command deletion delegates here.
   * Non-empty drafts stay in the field — backspace edits text, it does not leave.
   */
  const deletePreviousPart = useCallback(() => {
    if (activeEntryRef.current) {
      const parsed = parseEditableCommand(
        suffixRef.current,
        pinnedRef.current,
      );
      if (parsed.valueText.length > 0) return;
      stashActiveEntryDraft();
      cancelDataEntry();
      setFocusToken((n) => n + 1);
      return;
    }

    const current = suffixRef.current;
    if (!current) return;

    const next = deletePreviousCommandPart(current, pinnedRef.current);
    if (next === current) return;

    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    setCommandSuffix(next);
    setFocusToken((n) => n + 1);
  }, [cancelDataEntry, stashActiveEntryDraft]);

  /**
   * Return key inside the dedicated value field — the only submission
   * affordance. Empty values stay in entry mode with a compact error.
   */
  const submitDataEntry = useCallback((): boolean => {
    const field = activeEntryRef.current;
    if (!field) return false;

    const parsed = parseEditableCommand(suffixRef.current, pinnedRef.current);
    const value = parsed.valueText.trim();
    if (!value) {
      setEntryError('Value is required');
      setFocusToken((n) => n + 1);
      announce('Value is required');
      return false;
    }

    const submittedCommand = [formatCommandPath(field.path), value].join(' ');
    if (field.node.findingTarget) {
      return commitFindingDataEntry(field, value);
    }
    return executeCommand(submittedCommand, { fromDataEntry: true });
  }, [commitFindingDataEntry, executeCommand]);

  /**
   * Shared cancel for gestures and assistive actions. Uncommitted text is
   * stashed by field path so navigation never traps the surveyor.
   */
  const cancelCurrentInteraction = useCallback(() => {
    if (!activeEntryRef.current && !activeCompoundCaptureRef.current) {
      return false;
    }
    if (activeEntryRef.current) {
      stashActiveEntryDraft();
    }
    cancelDataEntry();
    return true;
  }, [cancelDataEntry, stashActiveEntryDraft]);

  const isCurrentPathPinned =
    pinnedCommandPrefix.length > 0 &&
    pathKey(pinnedCommandPrefix) === pathKey(fullCommandPath);

  /**
   * Long-press eligibility. Structural navigation only: no free text, no
   * value-bearing leaf awaiting input, and the path must resolve through the
   * registry's own pinnability rule rather than any hard-coded token.
   */
  const canPinCurrentPath =
    inputMode === 'navigation' &&
    fullCommandPath.length > 0 &&
    !editableCommand.valueText &&
    !editableCommand.expectsValue &&
    !editableCommand.trailingPartial &&
    (isCurrentPathPinned || isPinnablePath(fullCommandPath));

  /**
   * Long-press on the visible path: pin it, release it when it is already the
   * pinned context, or replace a shallower pin. There is no visible control.
   */
  const toggleCurrentPathPin = useCallback((): boolean => {
    if (!canPinCurrentPath) return false;

    if (isCurrentPathPinned) {
      executeCommand('unpin');
      return false;
    }

    return Boolean(executeCommand(pinCommandForPath(fullCommandPath)));
  }, [canPinCurrentPath, executeCommand, fullCommandPath, isCurrentPathPinned]);

  const setPathNote = useCallback((pathKey: string, note: string) => {
    setNotesByPath((current) => {
      const trimmedKey = pathKey.trim();
      if (!trimmedKey) return current;
      if (!note) {
        if (!(trimmedKey in current)) return current;
        const next = { ...current };
        delete next[trimmedKey];
        return next;
      }
      return { ...current, [trimmedKey]: note };
    });
  }, []);

  const setActiveProperty = useCallback((property: ActiveProperty) => {
    setActiveJobState((current) => ({ ...current, property }));
  }, []);

  return {
    inspectionBrief,
    activeJob,
    setActiveProperty,
    fullCommandPath,
    fullCommandText,
    commandSuffix,
    setCommandSuffix: handleCommandSuffixChange,
    openRootNavigation,
    editablePath,
    dataEntryDirectory,
    entryValue,
    inputMode,
    activeEntryField,
    activeCompoundCapture,
    entryError,
    setEntryValue,
    beginDataEntry,
    cancelCurrentInteraction,
    pinnedCommandPrefix,
    canPinCurrentPath,
    isCurrentPathPinned,
    toggleCurrentPathPin,
    suggestions,
    lastExecutionResult,
    temporaryAutocompleteContent,
    infoBarText,
    transientFeedbackText: transientFeedback?.message ?? null,
    focusToken,
    requestTerminalFocus,
    submitCommand,
    submitDataEntry,
    commitFieldValue,
    commitControlledFieldValue,
    commitControlledSetFieldValue,
    activeMultiChoiceValues,
    toggleMultiChoiceDraft,
    commitMultiChoiceField,
    selectSuggestion,
    navigateToDataEntrySegment,
    navigateToSvyrRoot,
    deletePreviousPart,
    moveUpDirectory,
    notesByPath,
    setPathNote,
    entryDraftsByPath,
  };
}
