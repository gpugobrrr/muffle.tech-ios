import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyActiveJobTransition,
  resolveActiveJobUpdate,
  resolveHydratedActiveJob,
  shouldPersistActiveJob,
} from '../src/lib/active-job-state';
import {
  captureAndCommitInspectionEvidencePhoto,
  commitInspectionEvidencePhoto,
} from '../src/lib/evidence-capture';
import type { EvidenceFileStore } from '../src/lib/evidence-files';
import {
  evidenceJobDirectory,
  evidencePhotoRelativePath,
} from '../src/lib/evidence-files';
import { commitInspectionFindingField } from '../src/lib/finding-capture';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import {
  createInitialActiveJob,
  deserializeActiveJob,
  serializeActiveJob,
} from '../src/lib/job-persistence';
import { servicesFindingConfig } from '../src/lib/services-findings';
import type { ActiveJob } from '../src/types/workspace';

function mockFileStore(
  overrides: Partial<EvidenceFileStore> = {},
): EvidenceFileStore {
  const files = new Map<string, string>();
  return {
    async ensureJobEvidenceDirectory(jobId: string) {
      return `/persistent/${evidenceJobDirectory(jobId)}/`;
    },
    async copyPhotoToEvidenceDirectory(jobId, evidenceId, temporaryUri) {
      const destination = `/persistent/${evidencePhotoRelativePath(jobId, evidenceId)}`;
      files.set(destination, temporaryUri);
      return destination;
    },
    async deleteEvidenceFile(uri: string) {
      files.delete(uri);
    },
    ...overrides,
  };
}

test('ActiveJob transition updates imperative current immediately', () => {
  const electricity = servicesFindingConfig('electricity');
  let refJob = createInitialActiveJob();
  let stateJob = refJob;

  assert.deepEqual(refJob.inspection.findings, {});

  const next = applyActiveJobTransition(
    refJob,
    (current) => ({
      ...current,
      inspection: {
        ...current.inspection,
        findings: {
          [electricity.findingId]: {
            id: electricity.findingId,
            elementConceptId: electricity.elementConceptId,
            observation: 'Consumer unit appears dated.',
          },
        },
      },
    }),
    (value) => {
      refJob = value;
      stateJob = value;
    },
  );

  assert.equal(
    next.inspection.findings[electricity.findingId]?.observation,
    'Consumer unit appears dated.',
  );
  assert.equal(
    refJob.inspection.findings[electricity.findingId]?.observation,
    'Consumer unit appears dated.',
  );
  assert.equal(
    stateJob.inspection.findings[electricity.findingId]?.observation,
    'Consumer unit appears dated.',
  );
  assert.equal(refJob, stateJob);
  assert.equal(refJob, next);
});

test('finding commit then evidence commit succeeds against the same ActiveJob', async () => {
  const electricity = servicesFindingConfig('electricity');
  let activeJob: ActiveJob = createInitialActiveJob();

  const observed = commitInspectionFindingField(
    activeJob.inspection,
    {
      findingId: electricity.findingId,
      elementConceptId: electricity.elementConceptId,
      field: 'observation',
    },
    'Consumer unit appears dated.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;

  activeJob = applyActiveJobTransition(
    activeJob,
    (current) => ({
      ...current,
      inspection: observed.result.inspection,
    }),
    (next) => {
      activeJob = next;
    },
  );

  assert.ok(activeJob.inspection.findings[electricity.findingId]);
  assert.equal(
    activeJob.inspection.findings[electricity.findingId]?.observation,
    'Consumer unit appears dated.',
  );

  const evidence = await captureAndCommitInspectionEvidencePhoto({
    inspection: activeJob.inspection,
    target: {
      findingId: electricity.findingId,
      elementConceptId: electricity.elementConceptId,
    },
    jobId: activeJob.id,
    temporaryUri: 'file:///tmp/evidence.jpg',
    fileStore: mockFileStore(),
    createId: () => 'evidence.photo.synced',
  });
  assert.equal(evidence.ok, true);
  if (!evidence.ok) return;

  activeJob = applyActiveJobTransition(
    activeJob,
    (current) => ({
      ...current,
      inspection: evidence.result.inspection,
    }),
    (next) => {
      activeJob = next;
    },
  );

  assert.equal(
    activeJob.inspection.findings[electricity.findingId]?.evidence?.[0]?.id,
    'evidence.photo.synced',
  );
  assert.equal(
    activeJob.inspection.evidence?.['evidence.photo.synced']?.kind,
    'photo',
  );
});

test('hydration does not overwrite local mutations and persistence waits', () => {
  assert.equal(shouldPersistActiveJob(false), false);
  assert.equal(shouldPersistActiveJob(true), true);

  const restored = createInitialActiveJob();
  restored.inspection.findings = {
    'finding.service.electrical_installation.1': {
      id: 'finding.service.electrical_installation.1',
      elementConceptId: 'service_system.electrical_installation',
      observation: 'Stored observation.',
    },
  };

  assert.equal(
    resolveHydratedActiveJob({
      restored,
      mutatedBeforeHydration: true,
    }),
    null,
  );
  assert.equal(
    resolveHydratedActiveJob({
      restored,
      mutatedBeforeHydration: false,
    }),
    restored,
  );
  assert.equal(
    resolveHydratedActiveJob({
      restored: null,
      mutatedBeforeHydration: false,
    }),
    null,
  );
});

test('resolveActiveJobUpdate accepts value or updater', () => {
  const base = createInitialActiveJob();
  const replaced = resolveActiveJobUpdate(base, {
    ...base,
    id: 'job.replaced',
  });
  assert.equal(replaced.id, 'job.replaced');

  const updated = resolveActiveJobUpdate(base, (current) => ({
    ...current,
    id: `${current.id}.next`,
  }));
  assert.equal(updated.id, 'job.demo.18-market-street.next');
});

test('serialized ActiveJob round-trips findings used by evidence commit', () => {
  const electricity = servicesFindingConfig('electricity');
  const job = createInitialActiveJob();
  job.inspection.findings[electricity.findingId] = {
    id: electricity.findingId,
    elementConceptId: electricity.elementConceptId,
    observation: 'Consumer unit appears dated.',
  };

  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.ok(restored);
  assert.equal(
    restored?.inspection.findings[electricity.findingId]?.observation,
    'Consumer unit appears dated.',
  );

  const originalError = console.error;
  console.error = () => {};
  try {
    const rejectedWithoutObservation = commitInspectionEvidencePhoto(
      createEmptyInspectionRecord(),
      {
        findingId: electricity.findingId,
        elementConceptId: electricity.elementConceptId,
      },
      {
        id: 'evidence.photo.x',
        kind: 'photo',
        uri: '/persistent/x.jpg',
      },
    );
    assert.equal(rejectedWithoutObservation.ok, false);

    const accepted = commitInspectionEvidencePhoto(
      restored!.inspection,
      {
        findingId: electricity.findingId,
        elementConceptId: electricity.elementConceptId,
      },
      {
        id: 'evidence.photo.x',
        kind: 'photo',
        uri: '/persistent/x.jpg',
      },
    );
    assert.equal(accepted.ok, true);
  } finally {
    console.error = originalError;
  }
});
