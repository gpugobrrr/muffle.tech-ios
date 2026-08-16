import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { createAsyncStorageCaseAdapter } from '@/lib/async-storage-case-adapter';
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
    type CommandNode,
} from '@/lib/command-registry';
import {
    formatExecutionResult,
    structuredCommandPathFromInput,
    type SvyrExecutionResult,
} from '@/lib/field-information';
import { findFieldDefinition, normalizeFieldInputValue, resolveFieldValue } from '@/lib/field-schema';
import {
  allocateProspectiveFindingId,
  buildFindingFieldMenu,
  type FindingHubItem,
  buildFindingHubItems,
} from '@/lib/finding-hub';
import {
  labelForInspectionElement,
  type InspectionElementConceptId,
} from '@/lib/inspection-finding-elements';
import {
  orderMultiChoiceValues,
  prepareMultiChoiceCommit,
  toggleMultiChoiceValue,
} from '@/lib/multi-choice';
import {
  buildFindingLeaf,
  commitInspectionFindingField,
  resolveFindingFieldValue,
} from '@/lib/level-2-finding-capture';
import { EXTERNAL_WALL_FINDING_LEAVES } from '@/lib/level-2-capture';
import {
  buildPersistedInspectionCase,
  createWorkspaceAutosaveScheduler,
  hydrateWorkspaceCase,
  INITIAL_ACTIVE_JOB,
  INITIAL_INSPECTION_BRIEF,
  INITIAL_WORKSPACE_COMMITTED_STATE,
  resolveHydratedWorkspaceState,
  type WorkspaceCommittedState,
} from '@/lib/workspace-case-persistence';
import { resolveLookup } from '@/lib/lookup';
import { suffixForPath } from '@/lib/pin-context';
import { executeSurveyOperation } from '@/lib/survey-operations';
import {
  clearEntryDraft,
  clearFindingEntryDraft,
  readEntryDraft,
  readFindingEntryDraft,
  readMultiChoiceEntryDraft,
  stashEntryDraft,
  stashFindingEntryDraft,
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

const INITIAL_BRIEF = INITIAL_INSPECTION_BRIEF;
const INITIAL_JOB = INITIAL_ACTIVE_JOB;

function announce(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}

function formatLookupTemporary(label: string, value: string): string {
  return `${label.toUpperCase()} · ${value}`;
}

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

export type ActiveFindingHub = {
  path: string[];
  elementConceptId: InspectionElementConceptId;
  baseFindingId: string;
};

function resolveFindingCaptureNode(
  path: string[],
  findingId: string | null,
  hub: ActiveFindingHub | null,
): CommandNode | null {
  const node = findCommandNode(path);
  if (!node) return null;
  if (!findingId || !node.findingTarget) return node;

  const leafToken = path.at(-1);
  const leaf = EXTERNAL_WALL_FINDING_LEAVES.find(
    (item) => item.kind === 'finding' && item.token === leafToken,
  );
  if (leaf && hub) {
    return buildFindingLeaf(leaf, {
      findingId,
      elementConceptId: hub.elementConceptId,
      subjectLabel: labelForInspectionElement(hub.elementConceptId),
    });
  }

  return {
    ...node,
    findingTarget: { ...node.findingTarget, findingId },
  };
}

/**
 * Single source of SVYR command state for the landscape Power User workspace.
 * The registry, parser, command path, and suggestions all resolve here.
 */
export type SvyrController = {
  commandSuffix: string;
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
  temporaryAutocompleteContent: string | null;
  focusToken: number;
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
  /** True after local case hydration has completed. */
  isHydrated: boolean;

  // ── Finding hub ────────────────────────────────────────────────────
  /** Active finding hub, set when navigation enters a findingHubTarget node. */
  activeFindingHub: ActiveFindingHub | null;
  /** Finding currently being edited inside the hub. */
  selectedFindingId: string | null;
  /** Ordered hub items for the active finding hub. */
  findingHubItems: readonly FindingHubItem[];
  /** Dynamic field menu for the selected finding. */
  findingFieldSuggestions: CommandSuggestion[];
  /** Select an existing finding to edit its fields. */
  selectFinding: (findingId: string) => void;
  /** Start a new finding — opens Observation immediately. */
  selectNewFinding: () => void;
};

export function useSvyrController(): SvyrController {
  const [commandSuffix, setCommandSuffix] = useState('');
  const [dataEntryDirectory, setDataEntryDirectory] = useState<string[]>([]);
  const [temporaryAutocompleteContent, setTemporaryAutocompleteContent] =
    useState<string | null>(null);
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
  const [isHydrated, setIsHydrated] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    null,
  );
  const suffixRef = useRef('');
  const briefRef = useRef<InspectionBrief>(INITIAL_BRIEF);
  const activeJobRef = useRef<ActiveJob>(INITIAL_JOB);
  const activeEntryRef = useRef<ActiveEntryField | null>(null);
  const activeCompoundCaptureRef = useRef<ActiveCompoundCapture | null>(null);
  const dataEntryDirectoryRef = useRef<string[]>([]);
  const entryDraftsByPathRef = useRef<SvyrEntryDraftsByPath>({});
  const caseStorageAdapterRef = useRef(createAsyncStorageCaseAdapter());
  const lastPersistedCommittedRef = useRef<WorkspaceCommittedState>(
    INITIAL_WORKSPACE_COMMITTED_STATE,
  );
  const autosaveSchedulerRef = useRef(
    createWorkspaceAutosaveScheduler({
      adapter: caseStorageAdapterRef.current,
      onSave: (inspectionCase) => {
        lastPersistedCommittedRef.current = resolveHydratedWorkspaceState(
          inspectionCase,
          INITIAL_WORKSPACE_COMMITTED_STATE,
        );
      },
    }),
  );
  const isHydratedRef = useRef(false);
  const activeFindingHubRef = useRef<ActiveFindingHub | null>(null);
  const selectedFindingIdRef = useRef<string | null>(null);

  // Kept in sync during render, not in an effect: gesture and native-input
  // callbacks fire outside React's commit order and must never act on a
  // stale command path.
  suffixRef.current = commandSuffix;
  briefRef.current = inspectionBrief;
  activeJobRef.current = activeJob;
  activeEntryRef.current = activeEntryField;
  activeCompoundCaptureRef.current = activeCompoundCapture;
  dataEntryDirectoryRef.current = dataEntryDirectory;
  entryDraftsByPathRef.current = entryDraftsByPath;
  isHydratedRef.current = isHydrated;
  selectedFindingIdRef.current = selectedFindingId;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const hydrated = await hydrateWorkspaceCase(
        caseStorageAdapterRef.current,
        undefined,
        INITIAL_WORKSPACE_COMMITTED_STATE,
      );
      if (cancelled) return;

      setActiveJobState(hydrated.activeJob);
      setInspectionBrief(hydrated.inspectionBrief);
      setNotesByPath(hydrated.notesByPath);
      lastPersistedCommittedRef.current = hydrated;
      isHydratedRef.current = true;
      setIsHydrated(true);
    })();

    return () => {
      cancelled = true;
      autosaveSchedulerRef.current.cancel();
    };
  }, []);

  const suggestions = useMemo(
    () => getCommandAssistance(commandSuffix),
    [commandSuffix],
  );

  /**
   * Shared structural directory for autocomplete and completion
   * (free-text values ignored).
   */
  const fullCommandPath = useMemo(
    () => structuredCommandPathFromInput(commandSuffix),
    [commandSuffix],
  );

  const fullCommandText = commandSuffix;

  /** Grammar-based split of the editable suffix into path and free text. */
  const editableCommand = useMemo(
    () => parseEditableCommand(commandSuffix),
    [commandSuffix],
  );
  const editablePath = editableCommand.structuredTokens;
  const entryValue = editableCommand.valueText;

  useEffect(() => {
    if (!isHydrated) return;

    autosaveSchedulerRef.current.schedule(
      buildPersistedInspectionCase(
        {
          activeJob,
          inspectionBrief,
          notesByPath,
        },
        {
          entryDraftsByPath,
          activeEntry: activeEntryField
            ? { path: activeEntryField.path, valueText: entryValue }
            : null,
          persistedBaseline: lastPersistedCommittedRef.current,
        },
      ),
    );
  }, [
    activeEntryField,
    activeJob,
    entryDraftsByPath,
    entryValue,
    inspectionBrief,
    isHydrated,
    notesByPath,
  ]);

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

  /** Active finding hub, auto-derived from the current structural path. */
  const activeFindingHub = useMemo((): ActiveFindingHub | null => {
    const hubPath = activeEntryField
      ? activeEntryField.path.slice(0, -1)
      : editablePath;
    const node = findCommandNode(hubPath);
    if (!node?.findingHubTarget) return null;
    return {
      path: hubPath,
      elementConceptId: node.findingHubTarget.elementConceptId,
      baseFindingId: node.findingHubTarget.baseFindingId,
    };
  }, [activeEntryField, editablePath]);

  activeFindingHubRef.current = activeFindingHub;

  // Reset selected finding ID if the surveyor navigates away from the hub.
  useEffect(() => {
    if (!activeFindingHub) {
      selectedFindingIdRef.current = null;
      setSelectedFindingId(null);
    }
  }, [activeFindingHub]);

  // ── Finding hub derived state ─────────────────────────────────────────────
  const findingHubItems = useMemo((): readonly FindingHubItem[] => {
    if (!activeFindingHub) return [];
    return buildFindingHubItems(
      activeJob.inspection,
      activeFindingHub.elementConceptId,
    );
  }, [activeFindingHub, activeJob.inspection]);

  const findingFieldSuggestions = useMemo((): CommandSuggestion[] => {
    if (!activeFindingHub || !selectedFindingId) return [];
    const menuNodes = buildFindingFieldMenu(
      selectedFindingId,
      activeFindingHub.elementConceptId,
      labelForInspectionElement(activeFindingHub.elementConceptId),
      EXTERNAL_WALL_FINDING_LEAVES,
    );
    // Convert to suggestions matching the hub path
    const hubPath = activeFindingHub.path;
    return menuNodes.map((node): CommandSuggestion => ({
      type: 'token',
      id: `${hubPath.join('/')}-${node.token}`,
      label: node.label,
      description: node.description,
      insertion: suffixForPath([...hubPath, node.token]),
      commandPath: [...hubPath, node.token],
      available: node.available !== false,
      isTerminal: !node.children?.length,
      requiresValue: Boolean(node.requiresValue),
      compoundCapture: Boolean(node.compoundCapture),
      workflowOnly: Boolean(node.workflowOnly),
    }));
  }, [activeFindingHub, selectedFindingId]);

  const assignSelectedFinding = useCallback((findingId: string | null) => {
    selectedFindingIdRef.current = findingId;
    setSelectedFindingId(findingId);
  }, []);

  const clearActiveEntry = useCallback(() => {
    setActiveEntryField(null);
    setActiveCompoundCapture(null);
    setEntryError(null);
  }, []);

  const openRootNavigation = useCallback(() => {
    setCommandSuffix('');
    setDataEntryDirectory([]);
    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    assignSelectedFinding(null);
    clearActiveEntry();
    setFocusToken((token) => token + 1);
  }, [assignSelectedFinding, clearActiveEntry]);

  const setDataEntryDirectoryForPath = useCallback((path: string[]) => {
    const nextPath = [...path];
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
      `${suffixForPath(field.path).replace(/\s+$/, '')} ${value}`,
    );
  }, []);

  // ── Command execution ─────────────────────────────────────────────

  const executeCommand = useCallback(
    (rawCommand: string, options?: { fromDataEntry?: boolean }) => {
      const fromDataEntry = Boolean(options?.fromDataEntry);
      const parsed = parseCommand(rawCommand);

      switch (parsed.type) {
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
            setCommandSuffix(suffixForPath(entryParent));
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
            suffixForPath(parsed.path.slice(0, -1)),
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
    [clearActiveEntry, setDataEntryDirectoryForPath],
  );

  const executeTerminalInput = useCallback(
    (raw: string) => {
      if (!raw.trim()) return false;
      return executeCommand(raw);
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

      // Override finding ID from the dynamically selected finding.
      const dynamicFindingId = selectedFindingIdRef.current;
      const resolvedTarget = dynamicFindingId
        ? { ...target, findingId: dynamicFindingId }
        : target;

      const committed = commitInspectionFindingField(
        activeJobRef.current.inspection,
        resolvedTarget,
        value,
      );
      if (!committed.ok) {
        setEntryError(committed.message);
        setFocusToken((n) => n + 1);
        announce(committed.message);
        return false;
      }

      const submittedCommand = `${formatCommandPath(field.path)} ${value.trim()}`;
      setActiveJobState((current) => ({
        ...current,
        inspection: committed.result.inspection,
      }));
      setLastExecutionResult({
        operationId: committed.result.operationId,
        label: field.node.entryLabel ?? resolvedTarget.field,
        value: value.trim(),
        executedCommand: submittedCommand,
      });

      // Clear draft with finding-scoped key.
      if (dynamicFindingId) {
        setEntryDraftsByPath((current) =>
          clearFindingEntryDraft(current, field.path, dynamicFindingId),
        );
      } else {
        setEntryDraftsByPath((current) => clearEntryDraft(current, field.path));
      }

      // Clear entry field but keep selectedFindingId so we return to
      // the finding's field menu inside the hub.
      setActiveEntryField(null);
      setActiveCompoundCapture(null);
      setEntryError(null);
      setTemporaryAutocompleteContent(null);

      // Navigate back to the hub path (field menu of the selected finding).
      const hub = activeFindingHubRef.current;
      if (hub) {
        setDataEntryDirectoryForPath(hub.path);
        setCommandSuffix(suffixForPath(hub.path));
      } else {
        const entryParent = field.path.slice(0, -1);
        if (entryParent.length > 0) {
          setDataEntryDirectoryForPath(entryParent);
          setCommandSuffix(suffixForPath(entryParent));
        } else {
          setDataEntryDirectory([]);
          setCommandSuffix('');
        }
      }
      announce(`${field.node.entryLabel ?? resolvedTarget.field} recorded`);
      return true;
    },
    [setDataEntryDirectoryForPath],
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
    const findingId = selectedFindingIdRef.current;
    const hub = activeFindingHubRef.current;
    const node = resolveFindingCaptureNode(
      suggestion.commandPath,
      findingId,
      hub,
    );
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

    const stashedDraft = findingId
      ? readFindingEntryDraft(
          entryDraftsByPathRef.current,
          suggestion.commandPath,
          findingId,
        )
      : readEntryDraft(entryDraftsByPathRef.current, suggestion.commandPath);

    const canonicalFindingValue = node.findingTarget
      ? resolveFindingFieldValue(
          activeJobRef.current.inspection,
          node.findingTarget,
        )
      : null;
    const committedFieldValue =
      fieldDefinition?.fieldId && !node.findingTarget
        ? resolveFieldValue(briefRef.current, fieldDefinition.fieldId)
        : null;
    setCommandSuffix(
      suffixForDataEntryReentry({
        path: suggestion.commandPath,
        draft:
          stashedDraft ??
          canonicalFindingValue ??
          committedFieldValue ??
          undefined,
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
      suffixForPath(path.slice(0, -1)),
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
    const draft = parseEditableCommand(suffixRef.current).valueText;
    const findingId = selectedFindingIdRef.current;
    if (findingId) {
      setEntryDraftsByPath((current) =>
        stashFindingEntryDraft(current, field.path, findingId, draft),
      );
    } else {
      setEntryDraftsByPath((current) =>
        stashEntryDraft(current, field.path, draft),
      );
    }
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
      setCommandSuffix(suffixForPath(entryParent));
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
    return parseEditableCommand(suffixRef.current).structuredTokens;
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
      setCommandSuffix(suffixForPath(targetDirectory));

      const hub = activeFindingHubRef.current;
      const stillInHub =
        Boolean(hub) &&
        targetDirectory.length >= (hub?.path.length ?? 0) &&
        (hub?.path.every((segment, index) => targetDirectory[index] === segment) ??
          false);
      if (!stillInHub) {
        assignSelectedFinding(null);
      }

      setFocusToken((token) => token + 1);
      return true;
    },
    [assignSelectedFinding, stashActiveEntryDraft],
  );

  const selectFinding = useCallback((findingId: string) => {
    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    setEntryError(null);
    assignSelectedFinding(findingId);
    if (activeFindingHubRef.current) {
      setDataEntryDirectoryForPath(activeFindingHubRef.current.path);
      setCommandSuffix(suffixForPath(activeFindingHubRef.current.path));
    }
    setFocusToken((n) => n + 1);
  }, [assignSelectedFinding, setDataEntryDirectoryForPath]);

  const selectNewFinding = useCallback(() => {
    const hub = activeFindingHubRef.current;
    if (!hub) return;

    const prospectiveId = allocateProspectiveFindingId(
      activeJobRef.current.inspection,
      hub.baseFindingId,
    );
    assignSelectedFinding(prospectiveId);
    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    setEntryError(null);

    const observePath = [...hub.path, 'observe'];
    const observeNode = findCommandNode(observePath);
    if (observeNode) {
      beginDataEntry({
        type: 'token',
        id: `${hub.path.join('/')}-observe`,
        label: observeNode.label,
        description: observeNode.description,
        insertion: suffixForPath(observePath),
        commandPath: observePath,
        available: true,
        isTerminal: false,
        requiresValue: true,
      });
    }
  }, [assignSelectedFinding, beginDataEntry]);

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
   * Same path result as atomic Backspace. Ignores free-text values.
   */
  const moveUpDirectory = useCallback(() => {
    // Dedicated entry: stash any uncommitted draft, then leave without commit.
    if (activeEntryRef.current || activeCompoundCaptureRef.current) {
      if (activeEntryRef.current) {
        stashActiveEntryDraft();
      }
      const currentSelectedId = selectedFindingIdRef.current;
      cancelDataEntry();
      // If the prospective finding was never committed, clear selectedFindingId
      // so the user returns to the finding hub list.
      if (
        currentSelectedId &&
        !activeJobRef.current.inspection.findings[currentSelectedId]
      ) {
        assignSelectedFinding(null);
      }
      setFocusToken((n) => n + 1);
      return true;
    }

    // Inside finding hub with a selected finding: return to finding hub list.
    if (activeFindingHubRef.current && selectedFindingIdRef.current) {
      assignSelectedFinding(null);
      setTemporaryAutocompleteContent(null);
      setLastExecutionResult(null);
      setFocusToken((n) => n + 1);
      return true;
    }

    const current = suffixRef.current;
    if (!canRemoveLastEditableCommandSegment(current)) {
      return false;
    }

    const next = removeLastEditableCommandSegment(current);
    if (next === current) {
      return false;
    }

    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    assignSelectedFinding(null);
    setDataEntryDirectory((c) => c.slice(0, -1));
    setCommandSuffix(next);
    setFocusToken((n) => n + 1);
    return true;
  }, [assignSelectedFinding, cancelDataEntry, stashActiveEntryDraft]);

  /**
   * Shared semantic delete action. TextInput decides when native character
   * deletion is appropriate; atomic command deletion delegates here.
   * Non-empty drafts stay in the field — backspace edits text, it does not leave.
   */
  const deletePreviousPart = useCallback(() => {
    if (activeEntryRef.current) {
      const parsed = parseEditableCommand(suffixRef.current);
      if (parsed.valueText.length > 0) return;
      stashActiveEntryDraft();
      const currentSelectedId = selectedFindingIdRef.current;
      cancelDataEntry();
      if (
        currentSelectedId &&
        !activeJobRef.current.inspection.findings[currentSelectedId]
      ) {
        assignSelectedFinding(null);
      }
      setFocusToken((n) => n + 1);
      return;
    }

    if (activeFindingHubRef.current && selectedFindingIdRef.current) {
      assignSelectedFinding(null);
      setTemporaryAutocompleteContent(null);
      setLastExecutionResult(null);
      setFocusToken((n) => n + 1);
      return;
    }

    const current = suffixRef.current;
    if (!current) return;

    const next = deletePreviousCommandPart(current);
    if (next === current) return;

    setTemporaryAutocompleteContent(null);
    setLastExecutionResult(null);
    assignSelectedFinding(null);
    setCommandSuffix(next);
    setFocusToken((n) => n + 1);
  }, [assignSelectedFinding, cancelDataEntry, stashActiveEntryDraft]);

  /**
   * Return key inside the dedicated value field — the only submission
   * affordance. Empty values stay in entry mode with a compact error.
   */
  const submitDataEntry = useCallback((): boolean => {
    const field = activeEntryRef.current;
    if (!field) return false;

    const parsed = parseEditableCommand(suffixRef.current);
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
    const currentSelectedId = selectedFindingIdRef.current;
    cancelDataEntry();
    if (
      currentSelectedId &&
        !activeJobRef.current.inspection.findings[currentSelectedId]
      ) {
        assignSelectedFinding(null);
      }
    return true;
  }, [assignSelectedFinding, cancelDataEntry, stashActiveEntryDraft]);

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
    suggestions,
    lastExecutionResult,
    temporaryAutocompleteContent,
    infoBarText,
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
    isHydrated,
    activeFindingHub,
    selectedFindingId,
    findingHubItems,
    findingFieldSuggestions,
    selectFinding,
    selectNewFinding,
  };
}
