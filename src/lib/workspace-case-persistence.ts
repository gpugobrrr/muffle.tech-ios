import { createEmptyInspectionRecord } from '@/lib/inspection-record';
import {
  DEFAULT_CASE_STORAGE_KEY,
  loadCase,
  saveCase,
  type CaseStorageAdapter,
  type InspectionCase,
} from '@/lib/case-persistence';
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

/** Build the persisted case envelope from committed workspace state only. */
export function buildPersistedInspectionCase(
  state: WorkspaceCommittedState,
): InspectionCase {
  return {
    job: state.activeJob,
    brief: state.inspectionBrief,
    notesByPath: state.notesByPath,
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
