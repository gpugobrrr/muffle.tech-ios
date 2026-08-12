import assert from 'node:assert/strict';
import test from 'node:test';

import { parseEditableCommand } from '../src/lib/command-edit';
import { findCommandNode } from '../src/lib/command-registry';
import {
  applyActiveJobTransition,
} from '../src/lib/active-job-state';
import {
  captureAndCommitInspectionEvidencePhoto,
} from '../src/lib/evidence-capture';
import type { EvidenceFileStore } from '../src/lib/evidence-files';
import {
  evidenceJobDirectory,
  evidencePhotoRelativePath,
} from '../src/lib/evidence-files';
import { commitInspectionFindingField } from '../src/lib/finding-capture';
import {
  commitFindingEntrySession,
  openFindingEntrySession,
  resolveFindingEntryCommitTarget,
} from '../src/lib/finding-entry-session';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import { createInitialActiveJob } from '../src/lib/job-persistence';
import { servicesFindingConfig } from '../src/lib/services-findings';
import type { ActiveJob } from '../src/types/workspace';

function mockFileStore(): EvidenceFileStore {
  return {
    async ensureJobEvidenceDirectory(jobId: string) {
      return `/persistent/${evidenceJobDirectory(jobId)}/`;
    },
    async copyPhotoToEvidenceDirectory(jobId, evidenceId) {
      return `/persistent/${evidencePhotoRelativePath(jobId, evidenceId)}`;
    },
    async deleteEvidenceFile() {},
  };
}

test('observation target survives sibling selection change before commit', () => {
  const observe = findCommandNode(['services', 'electricity', 'observe'])!;
  const defect = findCommandNode(['services', 'electricity', 'defect'])!;
  assert.ok(observe.findingTarget);
  assert.ok(defect.findingTarget);

  // Session opened on Observation.
  const session = openFindingEntrySession(
    ['services', 'electricity', 'observe'],
    observe.findingTarget!,
  );

  // Live selection drifts to Defect before the commit callback runs.
  const liveSelection = {
    path: ['services', 'electricity', 'defect'] as string[],
    findingTarget: defect.findingTarget!,
  };
  assert.equal(liveSelection.findingTarget.field, 'defect');

  const target = resolveFindingEntryCommitTarget(
    session,
    liveSelection.findingTarget,
  );
  assert.equal(target?.field, 'observation');
  assert.equal(
    target?.findingId,
    'finding.service.electrical_installation.1',
  );

  const committed = commitFindingEntrySession(
    createEmptyInspectionRecord(),
    session,
    'eeeeee',
    liveSelection.findingTarget,
  );
  assert.equal(committed.ok, true);
  if (!committed.ok) return;
  assert.equal(
    committed.result.inspection.findings[
      'finding.service.electrical_installation.1'
    ]?.observation,
    'eeeeee',
  );
});

test('ENTER observation creates finding and does not return Record observation first', () => {
  const observe = findCommandNode(['services', 'electricity', 'observe'])!;
  const session = openFindingEntrySession(
    ['services', 'electricity', 'observe'],
    observe.findingTarget!,
  );
  const result = commitFindingEntrySession(
    createEmptyInspectionRecord(),
    session,
    'eeeeee',
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.notEqual(result.message, 'Record observation first');
  assert.ok(
    result.result.inspection.findings[
      'finding.service.electrical_installation.1'
    ],
  );
});

test('navigate away from observation commits then leaves finding in place', () => {
  const observe = findCommandNode(['services', 'electricity', 'observe'])!;
  const session = openFindingEntrySession(
    ['services', 'electricity', 'observe'],
    observe.findingTarget!,
  );
  let activeJob: ActiveJob = createInitialActiveJob();
  const activeJobRef = { current: activeJob };

  const committed = commitFindingEntrySession(
    activeJobRef.current.inspection,
    session,
    'eeeeee',
  );
  assert.equal(committed.ok, true);
  if (!committed.ok) return;

  activeJob = applyActiveJobTransition(
    activeJobRef.current,
    (current) => ({
      ...current,
      inspection: committed.result.inspection,
    }),
    (next) => {
      activeJobRef.current = next;
      activeJob = next;
    },
  );

  assert.equal(
    activeJobRef.current.inspection.findings[
      'finding.service.electrical_installation.1'
    ]?.observation,
    'eeeeee',
  );
});

test('defect before observation still returns Record observation first', () => {
  const defect = findCommandNode(['services', 'electricity', 'defect'])!;
  const session = openFindingEntrySession(
    ['services', 'electricity', 'defect'],
    defect.findingTarget!,
  );
  const rejected = commitFindingEntrySession(
    createEmptyInspectionRecord(),
    session,
    'Signs of thermal discolouration.',
  );
  assert.equal(rejected.ok, false);
  if (rejected.ok) return;
  assert.equal(rejected.message, 'Record observation first');
});

test('defect after observation succeeds on the same finding', () => {
  const electricity = servicesFindingConfig('electricity');
  const observe = findCommandNode(['services', 'electricity', 'observe'])!;
  const defect = findCommandNode(['services', 'electricity', 'defect'])!;

  const observed = commitFindingEntrySession(
    createEmptyInspectionRecord(),
    openFindingEntrySession(
      ['services', 'electricity', 'observe'],
      observe.findingTarget!,
    ),
    'eeeeee',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;

  const defected = commitFindingEntrySession(
    observed.result.inspection,
    openFindingEntrySession(
      ['services', 'electricity', 'defect'],
      defect.findingTarget!,
    ),
    'Signs of thermal discolouration.',
  );
  assert.equal(defected.ok, true);
  if (!defected.ok) return;
  assert.equal(
    defected.result.inspection.findings[electricity.findingId]?.defect,
    'Signs of thermal discolouration.',
  );
  assert.equal(
    defected.result.inspection.findings[electricity.findingId]?.observation,
    'eeeeee',
  );
});

test('suffix value is available for immediate ENTER without a React render', () => {
  let commandSuffix = 'services/electricity/observe ';
  const suffixRef = { current: commandSuffix };
  const setCommandSuffix = (value: string) => {
    suffixRef.current = value;
    commandSuffix = value;
  };

  setCommandSuffix('services/electricity/observe eeeeee');
  const value = parseEditableCommand(suffixRef.current).valueText.trim();
  assert.equal(value, 'eeeeee');
});

test('successful observation commit is immediately visible on activeJobRef', () => {
  const observe = findCommandNode(['services', 'electricity', 'observe'])!;
  let activeJob: ActiveJob = createInitialActiveJob();
  const activeJobRef = { current: activeJob };

  const committed = commitFindingEntrySession(
    activeJobRef.current.inspection,
    openFindingEntrySession(
      ['services', 'electricity', 'observe'],
      observe.findingTarget!,
    ),
    'eeeeee',
  );
  assert.equal(committed.ok, true);
  if (!committed.ok) return;

  applyActiveJobTransition(
    activeJobRef.current,
    (current) => ({
      ...current,
      inspection: committed.result.inspection,
    }),
    (next) => {
      activeJobRef.current = next;
    },
  );

  assert.equal(
    activeJobRef.current.inspection.findings[
      'finding.service.electrical_installation.1'
    ]?.observation,
    'eeeeee',
  );
});

test('Type 7 immediately after Type 6 session commit sees the finding', async () => {
  const electricity = servicesFindingConfig('electricity');
  const observe = findCommandNode(['services', 'electricity', 'observe'])!;
  let activeJob: ActiveJob = createInitialActiveJob();
  const activeJobRef = { current: activeJob };

  const observed = commitFindingEntrySession(
    activeJobRef.current.inspection,
    openFindingEntrySession(
      ['services', 'electricity', 'observe'],
      observe.findingTarget!,
    ),
    'eeeeee',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;

  applyActiveJobTransition(
    activeJobRef.current,
    (current) => ({
      ...current,
      inspection: observed.result.inspection,
    }),
    (next) => {
      activeJobRef.current = next;
    },
  );

  const evidence = await captureAndCommitInspectionEvidencePhoto({
    inspection: activeJobRef.current.inspection,
    target: {
      findingId: electricity.findingId,
      elementConceptId: electricity.elementConceptId,
    },
    jobId: activeJobRef.current.id,
    temporaryUri: 'file:///tmp/evidence.jpg',
    fileStore: mockFileStore(),
    createId: () => 'evidence.photo.session',
  });
  assert.equal(evidence.ok, true);
});

test('direct defect commit against empty inspection still gates observation-first', () => {
  const defectTarget = findCommandNode(['services', 'electricity', 'defect'])!
    .findingTarget!;
  const rejected = commitInspectionFindingField(
    createEmptyInspectionRecord(),
    defectTarget,
    'premature',
  );
  assert.equal(rejected.ok, false);
  if (rejected.ok) return;
  assert.equal(rejected.message, 'Record observation first');
});
