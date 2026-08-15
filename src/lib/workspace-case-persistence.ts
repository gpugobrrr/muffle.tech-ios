import { findCommandNode } from '@/lib/command-registry';
import {
  applyFieldSetValue,
  applyFieldValue,
  findFieldDefinition,
  resolveFieldSetValue,
  resolveFieldValue,
} from '@/lib/field-schema';
import { createEmptyInspectionRecord } from '@/lib/inspection-record';
import { resolveFindingFieldValue, commitInspectionFindingField } from '@/lib/level-2-finding-capture';
import {
  DEFAULT_CASE_STORAGE_KEY,
  loadCase,
  saveCase,
  type CaseStorageAdapter,
  type InspectionCase,
} from '@/lib/case-persistence';
import {
  entryDraftPathKey,
  type SvyrEntryDraftsByPath,
} from '@/lib/svyr-entry-drafts';
import type { SvyrNotesByPath } from '@/lib/svyr-notes';
import type { ActiveJob, InspectionBrief } from '@/types/workspace';

/** Default committed workspace state used before hydration completes. */
export const INITIAL_INSPECTION_BRIEF: InspectionBrief = {
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
export const INITIAL_ACTIVE_JOB: ActiveJob = {
  property: {
    displayAddress: '18 Market Street',
    instructionType: 'Level 2 Building Survey',
  },
  inspection: createEmptyInspectionRecord(),
};

export type WorkspaceCommittedState = {
  activeJob: ActiveJob;
  inspectionBrief: InspectionBrief;
  notesByPath: SvyrNotesByPath;
};

export const INITIAL_WORKSPACE_COMMITTED_STATE: WorkspaceCommittedState = {
  activeJob: INITIAL_ACTIVE_JOB,
  inspectionBrief: INITIAL_INSPECTION_BRIEF,
  notesByPath: {},
};

export const WORKSPACE_AUTOSAVE_DEBOUNCE_MS = 1000;

export type WorkspaceActiveEntryDraft = {
  path: string[];
  valueText: string;
};

/** Transient entry state that must never be written into the persisted case. */
export type WorkspaceDraftExclusionContext = {
  entryDraftsByPath: SvyrEntryDraftsByPath;
  activeEntry?: WorkspaceActiveEntryDraft | null;
  /** Last successfully persisted committed snapshot. */
  persistedBaseline: WorkspaceCommittedState;
};

type UncommittedDraft = {
  path: string[];
  pathKey: string;
  text?: string;
  values?: readonly string[];
};

function pathSegmentsFromKey(pathKey: string): string[] {
  return pathKey.split('/').filter(Boolean);
}

function nullableBriefFieldValue(
  brief: InspectionBrief,
  fieldId: string,
): string | null {
  const value = resolveFieldValue(brief, fieldId);
  return value?.trim() ? value : null;
}

function revertBriefFieldValue(
  brief: InspectionBrief,
  fieldId: string,
  baselineValue: string | null,
): InspectionBrief {
  if (baselineValue?.trim()) {
    return applyFieldValue(brief, fieldId, baselineValue);
  }

  switch (fieldId) {
    case 'instruction.instructingParty':
      return {
        ...brief,
        instruction: { ...brief.instruction, instructingParty: null },
      };
    case 'instruction.client':
      return {
        ...brief,
        instruction: { ...brief.instruction, client: null },
      };
    case 'instruction.reference':
      return {
        ...brief,
        instruction: { ...brief.instruction, reference: null },
      };
    case 'instruction.source':
      return {
        ...brief,
        instruction: { ...brief.instruction, source: null },
      };
    case 'purpose':
      return { ...brief, purpose: null };
    case 'deliverable':
      return { ...brief, deliverable: null };
    case 'limitation':
      return { ...brief, limitation: null };
    default: {
      if (!(fieldId in (brief.controlledFacts ?? {}))) return brief;
      const controlledFacts = { ...(brief.controlledFacts ?? {}) };
      delete controlledFacts[fieldId];
      return {
        ...brief,
        controlledFacts:
          Object.keys(controlledFacts).length > 0 ? controlledFacts : undefined,
      };
    }
  }
}

function revertBriefFieldSetValue(
  brief: InspectionBrief,
  fieldId: string,
  baselineValues: readonly string[],
): InspectionBrief {
  if (baselineValues.length === 0) {
    if (!(fieldId in (brief.controlledFactSets ?? {}))) return brief;
    const controlledFactSets = { ...(brief.controlledFactSets ?? {}) };
    delete controlledFactSets[fieldId];
    return {
      ...brief,
      controlledFactSets:
        Object.keys(controlledFactSets).length > 0
          ? controlledFactSets
          : undefined,
    };
  }
  return applyFieldSetValue(brief, fieldId, baselineValues);
}

function valuesEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function collectUncommittedDrafts(
  context: WorkspaceDraftExclusionContext,
): UncommittedDraft[] {
  const drafts: UncommittedDraft[] = [];
  const seen = new Set<string>();

  for (const [pathKey, draft] of Object.entries(context.entryDraftsByPath)) {
    if (draft.kind === 'text' && draft.text.trim()) {
      drafts.push({
        path: pathSegmentsFromKey(pathKey),
        pathKey,
        text: draft.text,
      });
      seen.add(pathKey);
    }
    if (draft.kind === 'multiSelect' && draft.values.length > 0) {
      drafts.push({
        path: pathSegmentsFromKey(pathKey),
        pathKey,
        values: draft.values,
      });
      seen.add(pathKey);
    }
  }

  const activeEntry = context.activeEntry;
  if (!activeEntry?.valueText.trim()) return drafts;

  const pathKey = entryDraftPathKey(activeEntry.path);
  if (seen.has(pathKey)) return drafts;

  const fieldDefinition = findFieldDefinition(activeEntry.path);
  const node = findCommandNode(activeEntry.path);
  if (node?.findingTarget) {
    const baselineValue = resolveFindingFieldValue(
      context.persistedBaseline.activeJob.inspection,
      node.findingTarget,
    );
    if (activeEntry.valueText !== (baselineValue ?? '')) {
      drafts.push({
        path: activeEntry.path,
        pathKey,
        text: activeEntry.valueText,
      });
    }
    return drafts;
  }

  if (!fieldDefinition) return drafts;

  const baselineValue = nullableBriefFieldValue(
    context.persistedBaseline.inspectionBrief,
    fieldDefinition.fieldId,
  );
  if (activeEntry.valueText !== (baselineValue ?? '')) {
    drafts.push({
      path: activeEntry.path,
      pathKey,
      text: activeEntry.valueText,
    });
  }

  return drafts;
}

/** Remove transient entry text from committed state before persistence. */
export function excludeTransientEntryDrafts(
  state: WorkspaceCommittedState,
  context: WorkspaceDraftExclusionContext,
): WorkspaceCommittedState {
  let inspectionBrief = state.inspectionBrief;
  let notesByPath = state.notesByPath;
  let activeJob = state.activeJob;

  for (const draft of collectUncommittedDrafts(context)) {
    const node = findCommandNode(draft.path);
    if (node?.findingTarget) {
      const currentValue = resolveFindingFieldValue(
        activeJob.inspection,
        node.findingTarget,
      );
      const baselineValue = resolveFindingFieldValue(
        context.persistedBaseline.activeJob.inspection,
        node.findingTarget,
      );
      if (
        draft.text &&
        currentValue === draft.text &&
        currentValue !== baselineValue
      ) {
        if (baselineValue) {
          const committed = commitInspectionFindingField(
            activeJob.inspection,
            node.findingTarget,
            baselineValue,
          );
          if (committed.ok) {
            activeJob = {
              ...activeJob,
              inspection: committed.result.inspection,
            };
          }
        } else {
          const findings = { ...activeJob.inspection.findings };
          const existing = findings[node.findingTarget.findingId];
          if (existing) {
            const nextFinding = { ...existing };
            if (node.findingTarget.field === 'evidence') {
              delete nextFinding.evidence;
            } else {
              delete nextFinding[node.findingTarget.field];
            }
            findings[node.findingTarget.findingId] = nextFinding;
          }
          activeJob = {
            ...activeJob,
            inspection: { ...activeJob.inspection, findings },
          };
        }
      }
      continue;
    }

    const fieldDefinition = findFieldDefinition(draft.path);
    if (!fieldDefinition) continue;

    if (draft.values) {
      const currentValues =
        resolveFieldSetValue(inspectionBrief, fieldDefinition.fieldId) ?? [];
      const baselineValues =
        resolveFieldSetValue(
          context.persistedBaseline.inspectionBrief,
          fieldDefinition.fieldId,
        ) ?? [];
      if (
        valuesEqual(currentValues, draft.values) &&
        !valuesEqual(currentValues, baselineValues)
      ) {
        inspectionBrief = revertBriefFieldSetValue(
          inspectionBrief,
          fieldDefinition.fieldId,
          baselineValues,
        );
      }
      continue;
    }

    if (!draft.text) continue;

    const currentValue = nullableBriefFieldValue(
      inspectionBrief,
      fieldDefinition.fieldId,
    );
    const baselineValue = nullableBriefFieldValue(
      context.persistedBaseline.inspectionBrief,
      fieldDefinition.fieldId,
    );
    if (currentValue === draft.text && currentValue !== baselineValue) {
      inspectionBrief = revertBriefFieldValue(
        inspectionBrief,
        fieldDefinition.fieldId,
        baselineValue,
      );
    }

    const currentNote = notesByPath[draft.pathKey];
    const baselineNote = context.persistedBaseline.notesByPath[draft.pathKey];
    if (currentNote === draft.text && currentNote !== baselineNote) {
      notesByPath = { ...notesByPath };
      if (baselineNote === undefined) {
        delete notesByPath[draft.pathKey];
      } else {
        notesByPath[draft.pathKey] = baselineNote;
      }
    }
  }

  return {
    activeJob,
    inspectionBrief,
    notesByPath,
  };
}

/** Build the persisted case envelope from committed workspace state only. */
export function buildPersistedInspectionCase(
  state: WorkspaceCommittedState,
  draftExclusion?: WorkspaceDraftExclusionContext,
): InspectionCase {
  const committed = draftExclusion
    ? excludeTransientEntryDrafts(state, draftExclusion)
    : state;

  return {
    job: committed.activeJob,
    brief: committed.inspectionBrief,
    notesByPath: committed.notesByPath,
  };
}

/** Apply a loaded case or fall back to the initial committed workspace state. */
export function resolveHydratedWorkspaceState(
  loaded: InspectionCase | null,
  defaults: WorkspaceCommittedState = INITIAL_WORKSPACE_COMMITTED_STATE,
): WorkspaceCommittedState {
  if (!loaded) return defaults;
  return {
    activeJob: loaded.job,
    inspectionBrief: loaded.brief,
    notesByPath: loaded.notesByPath,
  };
}

export async function hydrateWorkspaceCase(
  adapter: CaseStorageAdapter,
  key: string = DEFAULT_CASE_STORAGE_KEY,
  defaults: WorkspaceCommittedState = INITIAL_WORKSPACE_COMMITTED_STATE,
): Promise<WorkspaceCommittedState> {
  const loaded = await loadCase(adapter, key);
  return resolveHydratedWorkspaceState(loaded, defaults);
}

export type WorkspaceAutosaveScheduler = {
  schedule: (inspectionCase: InspectionCase) => void;
  cancel: () => void;
  flush: () => Promise<void>;
};

export function createWorkspaceAutosaveScheduler(options: {
  adapter: CaseStorageAdapter;
  key?: string;
  debounceMs?: number;
  saveCaseFn?: typeof saveCase;
  onSave?: (inspectionCase: InspectionCase) => void;
}): WorkspaceAutosaveScheduler {
  const key = options.key ?? DEFAULT_CASE_STORAGE_KEY;
  const debounceMs = options.debounceMs ?? WORKSPACE_AUTOSAVE_DEBOUNCE_MS;
  const saveCaseFn = options.saveCaseFn ?? saveCase;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: InspectionCase | null = null;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  const flush = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return;
    const inspectionCase = pending;
    pending = null;
    options.onSave?.(inspectionCase);
    await saveCaseFn(options.adapter, key, inspectionCase);
  };

  const schedule = (inspectionCase: InspectionCase) => {
    pending = inspectionCase;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, debounceMs);
  };

  return { schedule, cancel, flush };
}

export type WorkspacePersistenceController = {
  readonly isHydrated: boolean;
  readonly state: WorkspaceCommittedState;
  hydrate: () => Promise<void>;
  updateCommitted: (next: WorkspaceCommittedState) => void;
  dispose: () => void;
  flush: () => Promise<void>;
};

export function createWorkspacePersistenceController(options: {
  adapter: CaseStorageAdapter;
  key?: string;
  defaults?: WorkspaceCommittedState;
  debounceMs?: number;
  saveCaseFn?: typeof saveCase;
  loadCaseFn?: typeof loadCase;
  onSave?: (inspectionCase: InspectionCase) => void;
}): WorkspacePersistenceController {
  const defaults = options.defaults ?? INITIAL_WORKSPACE_COMMITTED_STATE;
  const loadCaseFn = options.loadCaseFn ?? loadCase;
  const key = options.key ?? DEFAULT_CASE_STORAGE_KEY;
  let isHydrated = false;
  let state = defaults;
  const scheduler = createWorkspaceAutosaveScheduler({
    adapter: options.adapter,
    key,
    debounceMs: options.debounceMs,
    saveCaseFn: options.saveCaseFn,
    onSave: options.onSave,
  });

  return {
    get isHydrated() {
      return isHydrated;
    },
    get state() {
      return state;
    },
    async hydrate() {
      const loaded = await loadCaseFn(options.adapter, key);
      state = resolveHydratedWorkspaceState(loaded, defaults);
      isHydrated = true;
    },
    updateCommitted(next) {
      state = next;
      if (!isHydrated) return;
      scheduler.schedule(buildPersistedInspectionCase(state));
    },
    dispose() {
      scheduler.cancel();
    },
    flush() {
      return scheduler.flush();
    },
  };
}
