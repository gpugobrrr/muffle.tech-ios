import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { DEMO_EXTERNAL_WALL_FINDING } from '../src/lib/fixtures/demo-external-wall-finding';
import {
  createMemoryCaseStorageAdapter,
  DEFAULT_CASE_STORAGE_KEY,
  deserializeCase,
  saveCase,
  serializeCase,
} from '../src/lib/case-persistence';
import {
  buildPersistedInspectionCase,
  createWorkspaceAutosaveScheduler,
  createWorkspacePersistenceController,
  excludeTransientEntryDrafts,
  hydrateWorkspaceCase,
  INITIAL_WORKSPACE_COMMITTED_STATE,
  resolveHydratedWorkspaceState,
} from '../src/lib/workspace-case-persistence';
import { suffixForPath } from '../src/lib/pin-context';
import { resolveFieldValue } from '../src/lib/field-schema';
import {
  readEntryDraft,
  stashEntryDraft,
  suffixForDataEntryReentry,
  type SvyrEntryDraftsByPath,
} from '../src/lib/svyr-entry-drafts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function savedCase() {
  return {
    job: {
      property: {
        displayAddress: '42 Saved Street',
        instructionType: 'Level 2 Building Survey',
      },
      inspection: {
        findings: {
          [DEMO_EXTERNAL_WALL_FINDING.id]: { ...DEMO_EXTERNAL_WALL_FINDING },
        },
      },
    },
    brief: {
      instruction: {
        instructingParty: 'Saved Surveyors',
        client: 'Saved Client',
        reference: 'SAVED-001',
        source: 'email',
      },
      purpose: 'Saved purpose',
      deliverable: 'Saved deliverable',
      limitation: 'Saved limitation',
    },
    notesByPath: {
      'prep/brief/instr/party': 'Saved note',
    },
  };
}

test('hydration restores a saved case', async () => {
  const adapter = createMemoryCaseStorageAdapter();
  await saveCase(adapter, DEFAULT_CASE_STORAGE_KEY, savedCase());

  const hydrated = await hydrateWorkspaceCase(adapter);
  assert.equal(
    hydrated.inspectionBrief.instruction.instructingParty,
    'Saved Surveyors',
  );
  assert.equal(hydrated.activeJob.property?.displayAddress, '42 Saved Street');
  assert.deepEqual(hydrated.notesByPath, {
    'prep/brief/instr/party': 'Saved note',
  });
  assert.deepEqual(
    hydrated.activeJob.inspection.findings[DEMO_EXTERNAL_WALL_FINDING.id],
    DEMO_EXTERNAL_WALL_FINDING,
  );
});

test('empty storage uses initial defaults', async () => {
  const adapter = createMemoryCaseStorageAdapter();
  const hydrated = await hydrateWorkspaceCase(adapter);
  assert.deepEqual(hydrated, INITIAL_WORKSPACE_COMMITTED_STATE);
});

test('invalid storage falls back to initial defaults without throwing', async () => {
  const adapter = createMemoryCaseStorageAdapter({
    [DEFAULT_CASE_STORAGE_KEY]: '{not-json',
  });
  const hydrated = await hydrateWorkspaceCase(adapter);
  assert.deepEqual(hydrated, INITIAL_WORKSPACE_COMMITTED_STATE);
});

test('autosave does not run before hydration completes', async () => {
  const adapter = createMemoryCaseStorageAdapter();
  const saves: string[] = [];
  const controller = createWorkspacePersistenceController({
    adapter,
    saveCaseFn: async (_adapter, _key, inspectionCase) => {
      saves.push(inspectionCase.brief.instruction.instructingParty ?? '');
    },
    loadCaseFn: async () => null,
  });

  controller.updateCommitted({
    ...INITIAL_WORKSPACE_COMMITTED_STATE,
    inspectionBrief: {
      ...INITIAL_WORKSPACE_COMMITTED_STATE.inspectionBrief,
      instruction: {
        ...INITIAL_WORKSPACE_COMMITTED_STATE.inspectionBrief.instruction,
        instructingParty: 'Should not save yet',
      },
    },
  });
  assert.equal(controller.isHydrated, false);
  assert.deepEqual(saves, []);

  await controller.hydrate();
  assert.equal(controller.isHydrated, true);
  assert.deepEqual(saves, []);
});

test('rapid committed changes debounce to one save', async () => {
  const adapter = createMemoryCaseStorageAdapter();
  const saves: string[] = [];
  const scheduler = createWorkspaceAutosaveScheduler({
    adapter,
    debounceMs: 50,
    saveCaseFn: async (_adapter, _key, inspectionCase) => {
      saves.push(inspectionCase.brief.instruction.instructingParty ?? '');
    },
  });

  scheduler.schedule({
    ...savedCase(),
    brief: {
      ...savedCase().brief,
      instruction: {
        ...savedCase().brief.instruction,
        instructingParty: 'First',
      },
    },
  });
  scheduler.schedule({
    ...savedCase(),
    brief: {
      ...savedCase().brief,
      instruction: {
        ...savedCase().brief.instruction,
        instructingParty: 'Second',
      },
    },
  });
  scheduler.schedule({
    ...savedCase(),
    brief: {
      ...savedCase().brief,
      instruction: {
        ...savedCase().brief.instruction,
        instructingParty: 'Third',
      },
    },
  });

  assert.deepEqual(saves, []);
  await new Promise((resolve) => setTimeout(resolve, 60));
  await scheduler.flush();
  assert.deepEqual(saves, ['Third']);
});

test('unsubmitted purpose draft is excluded from autosave, hydration, and re-entry', async () => {
  const adapter = createMemoryCaseStorageAdapter();
  const purpPath = ['prep', 'brief', 'purp'];
  const committedPurpose = 'Committed purpose';
  const draftPurpose = 'Unique unsubmitted draft';

  const baseline = {
    ...INITIAL_WORKSPACE_COMMITTED_STATE,
    inspectionBrief: {
      ...INITIAL_WORKSPACE_COMMITTED_STATE.inspectionBrief,
      purpose: committedPurpose,
    },
  };

  await saveCase(
    adapter,
    DEFAULT_CASE_STORAGE_KEY,
    buildPersistedInspectionCase(baseline),
  );

  const drafts: SvyrEntryDraftsByPath = stashEntryDraft({}, purpPath, draftPurpose);
  const pollutedLive = {
    ...baseline,
    inspectionBrief: {
      ...baseline.inspectionBrief,
      purpose: draftPurpose,
    },
  };

  const persisted = buildPersistedInspectionCase(pollutedLive, {
    entryDraftsByPath: drafts,
    activeEntry: { path: purpPath, valueText: draftPurpose },
    persistedBaseline: baseline,
  });

  assert.equal(persisted.brief.purpose, committedPurpose);
  assert.equal(JSON.stringify(persisted).includes(draftPurpose), false);

  const scheduler = createWorkspaceAutosaveScheduler({
    adapter,
    debounceMs: 10,
  });
  scheduler.schedule(persisted);
  await scheduler.flush();

  const hydrated = await hydrateWorkspaceCase(adapter);
  assert.equal(hydrated.inspectionBrief.purpose, committedPurpose);

  const stashedAfterReload = readEntryDraft({}, purpPath);
  const reopened = suffixForDataEntryReentry({
    path: purpPath,
    draft:
      stashedAfterReload ??
      resolveFieldValue(hydrated.inspectionBrief, 'purpose') ??
      undefined,
    defaultInsertion: 'purp ',
    suffixForPath,
  });
  assert.match(reopened, /Committed purpose/);
  assert.doesNotMatch(reopened, /Unique unsubmitted draft/);
});

test('excludeTransientEntryDrafts keeps committed values when no draft is active', () => {
  const baseline = {
    ...INITIAL_WORKSPACE_COMMITTED_STATE,
    inspectionBrief: {
      ...INITIAL_WORKSPACE_COMMITTED_STATE.inspectionBrief,
      purpose: 'Committed purpose',
    },
  };

  const sanitized = excludeTransientEntryDrafts(baseline, {
    entryDraftsByPath: {},
    activeEntry: null,
    persistedBaseline: baseline,
  });

  assert.equal(sanitized.inspectionBrief.purpose, 'Committed purpose');
});

test('transient drafts do not appear in persisted case data', () => {
  const entryDraftsByPath: SvyrEntryDraftsByPath = {
    'prep/brief/instr/party': { kind: 'text', text: 'Uncommitted draft' },
  };
  const persisted = buildPersistedInspectionCase({
    activeJob: INITIAL_WORKSPACE_COMMITTED_STATE.activeJob,
    inspectionBrief: {
      ...INITIAL_WORKSPACE_COMMITTED_STATE.inspectionBrief,
      instruction: {
        ...INITIAL_WORKSPACE_COMMITTED_STATE.inspectionBrief.instruction,
        instructingParty: 'Committed party',
      },
    },
    notesByPath: INITIAL_WORKSPACE_COMMITTED_STATE.notesByPath,
  });

  assert.equal(
    persisted.brief.instruction.instructingParty,
    'Committed party',
  );
  assert.equal(JSON.stringify(persisted).includes('Uncommitted draft'), false);
  assert.equal(JSON.stringify(persisted).includes('entryDraftsByPath'), false);
  assert.equal(entryDraftsByPath['prep/brief/instr/party']?.kind, 'text');
});

test('hydrated controller persists committed state after hydration', async () => {
  const adapter = createMemoryCaseStorageAdapter();
  await saveCase(adapter, DEFAULT_CASE_STORAGE_KEY, savedCase());
  const controller = createWorkspacePersistenceController({ adapter });

  await controller.hydrate();
  controller.updateCommitted({
    ...controller.state,
    inspectionBrief: {
      ...controller.state.inspectionBrief,
      instruction: {
        ...controller.state.inspectionBrief.instruction,
        instructingParty: 'Updated after hydration',
      },
    },
  });

  await controller.flush();
  const payload = await adapter.get(DEFAULT_CASE_STORAGE_KEY);
  const reloaded = resolveHydratedWorkspaceState(
    payload ? deserializeCase(payload) : null,
  );
  assert.equal(
    reloaded.inspectionBrief.instruction.instructingParty,
    'Updated after hydration',
  );
});

test('invalid stored case does not crash hydration controller', async () => {
  const adapter = createMemoryCaseStorageAdapter({
    [DEFAULT_CASE_STORAGE_KEY]: serializeCase({
      ...savedCase(),
      job: {
        ...savedCase().job,
        inspection: {
          findings: {
            'finding.invalid': {
              id: 'finding.invalid',
              elementConceptId: 'building_element.external_wall',
            },
          },
        },
      },
    }),
  });
  const controller = createWorkspacePersistenceController({ adapter });

  await assert.doesNotReject(async () => {
    await controller.hydrate();
  });
  assert.deepEqual(controller.state, INITIAL_WORKSPACE_COMMITTED_STATE);
});

test('use-workspace hydrates and debounces autosave without persisting transient UI state', () => {
  const source = readFileSync(
    path.join(repoRoot, 'src/hooks/use-workspace.ts'),
    'utf8',
  );

  assert.match(source, /hydrateWorkspaceCase/);
  assert.match(source, /createWorkspaceAutosaveScheduler/);
  assert.match(source, /buildPersistedInspectionCase/);
  assert.match(source, /createAsyncStorageCaseAdapter/);
  assert.match(source, /if \(!isHydrated\) return;/);
  assert.match(source, /isHydrated/);
  assert.match(source, /lastPersistedCommittedRef/);
  assert.match(source, /entryDraftsByPath/);
  assert.match(source, /persistedBaseline: lastPersistedCommittedRef\.current/);
  assert.match(
    source,
    /buildPersistedInspectionCase\(\s*\{\s*activeJob,\s*inspectionBrief,\s*notesByPath,\s*\}/,
  );
});
