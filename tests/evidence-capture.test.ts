import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWebSessionLocalMediaStore,
  isBrowserSessionMediaUri,
  nativeFilesystemCopyUri,
} from '../src/core/local-media-store';
import { findCommandNode } from '../src/lib/command-registry';
import { externalFindingConfig } from '../src/lib/external-findings';
import {
  resolveSvyrNodeDataEntryType,
  SVYR_DATA_ENTRY_TYPES,
} from '../src/lib/data-entry-types';
import {
  captureAndCommitInspectionEvidencePhoto,
  commitInspectionEvidencePhoto,
  countFindingPhotoEvidence,
  createEvidencePhotoId,
  isEvidenceCaptureNode,
  SURVEY_EVIDENCE_ADD,
} from '../src/lib/evidence-capture';
import type { EvidenceFileStore } from '../src/lib/evidence-files';
import {
  evidenceJobDirectory,
  evidencePhotoFilename,
  evidencePhotoRelativePath,
} from '../src/lib/evidence-files';
import { commitInspectionFindingField } from '../src/lib/finding-capture';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import {
  activeJobContainsEmbeddedImageData,
  deserializeActiveJob,
  serializeActiveJob,
} from '../src/lib/job-persistence';
import { servicesFindingConfig } from '../src/lib/services-findings';
import type { InspectionElementConceptId } from '../src/lib/inspection-finding-elements';
import {
  executeInspectionOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
import type { ActiveJob } from '../src/types/workspace';

function mockFileStore(
  overrides: Partial<EvidenceFileStore> = {},
): EvidenceFileStore {
  const files = new Map<string, string>();
  return {
    async ensureJobEvidenceDirectory(jobId: string) {
      return `/persistent/${evidenceJobDirectory(jobId)}/`;
    },
    async copyPhotoToEvidenceDirectory(jobId, evidenceId, source) {
      const destination = `/persistent/${evidencePhotoRelativePath(jobId, evidenceId)}`;
      const uri = typeof source === 'string' ? source : source.uri;
      files.set(destination, uri);
      return destination;
    },
    async deleteEvidenceFile(uri: string) {
      files.delete(uri);
    },
    ...overrides,
  };
}

function createJob(inspection = createEmptyInspectionRecord()): ActiveJob {
  return {
    id: 'job.test.evidence',
    property: {
      displayAddress: '18 Market Street',
    },
    inspection,
  };
}

test('photo capture node resolves as data entry type 7', () => {
  const photo = findCommandNode(['services', 'electricity', 'photo']);
  const observe = findCommandNode(['services', 'electricity', 'observe']);
  assert.ok(photo);
  assert.ok(observe);
  assert.equal(isEvidenceCaptureNode(photo), true);
  assert.equal(
    resolveSvyrNodeDataEntryType(photo!),
    SVYR_DATA_ENTRY_TYPES.evidenceCapture,
  );
  assert.equal(
    resolveSvyrNodeDataEntryType(observe!),
    SVYR_DATA_ENTRY_TYPES.findingCapture,
  );
});

test('valid photo evidence creates one canonical evidence record and finding link', () => {
  const electricity = servicesFindingConfig('electricity');
  const observe = findCommandNode(['services', 'electricity', 'observe'])!
    .findingTarget!;
  let inspection = createEmptyInspectionRecord();
  const observed = commitInspectionFindingField(
    inspection,
    observe,
    'Consumer unit appears dated.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  inspection = observed.result.inspection;

  const evidenceId = 'evidence.photo.test-1';
  const committed = commitInspectionEvidencePhoto(
    inspection,
    photoTarget(electricity.findingId, electricity.elementConceptId),
    {
      id: evidenceId,
      kind: 'photo',
      uri: '/persistent/muffle/jobs/job.test.evidence/evidence/evidence.photo.test-1.jpg',
    },
  );
  assert.equal(committed.ok, true);
  if (!committed.ok) return;
  assert.equal(committed.evidence.id, evidenceId);
  assert.equal(committed.result.inspection.evidence?.[evidenceId]?.kind, 'photo');
  assert.deepEqual(
    committed.result.inspection.findings[electricity.findingId]?.evidence,
    [{ id: evidenceId }],
  );
  assert.equal(
    committed.result.operationId,
    SURVEY_EVIDENCE_ADD,
  );
});

test('evidence commit rejects unknown finding and missing observation', () => {
  const errors: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  try {
    const electricity = servicesFindingConfig('electricity');
    const inspection = createEmptyInspectionRecord();
    const rejected = commitInspectionEvidencePhoto(
      inspection,
      photoTarget(electricity.findingId, electricity.elementConceptId),
      {
        id: 'evidence.photo.missing-finding',
        kind: 'photo',
        uri: '/persistent/photo.jpg',
      },
    );
    assert.equal(rejected.ok, false);
    if (rejected.ok) return;
    assert.equal(rejected.message, 'Record observation first');
    assert.equal(Object.keys(inspection.evidence ?? {}).length, 0);
    assert.ok(
      errors.some(
        (entry) =>
          Array.isArray(entry) &&
          entry[0] === '[evidence-photo] Evidence commit rejected',
      ),
    );
  } finally {
    console.error = originalError;
  }
});

test('multiple photos create multiple evidence records on one finding', async () => {
  const electricity = servicesFindingConfig('electricity');
  const observe = findCommandNode(['services', 'electricity', 'observe'])!
    .findingTarget!;
  let inspection = createEmptyInspectionRecord();
  const observed = commitInspectionFindingField(
    inspection,
    observe,
    'Consumer unit appears dated.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  inspection = observed.result.inspection;

  const ids = ['evidence.photo.a', 'evidence.photo.b', 'evidence.photo.c'];
  for (const [index, evidenceId] of ids.entries()) {
    const committed = await captureAndCommitInspectionEvidencePhoto({
      inspection,
      target: photoTarget(electricity.findingId, electricity.elementConceptId),
      jobId: 'job.test.evidence',
      temporaryUri: `file:///tmp/photo-${index}.jpg`,
      fileStore: mockFileStore(),
      createId: () => evidenceId,
    });
    assert.equal(committed.ok, true);
    if (!committed.ok) return;
    inspection = committed.result.inspection;
  }

  assert.equal(Object.keys(inspection.findings).length, 1);
  assert.equal(countFindingPhotoEvidence(inspection, electricity.findingId), 3);
  assert.equal(Object.keys(inspection.evidence ?? {}).length, 3);
});

test('duplicate evidence IDs and duplicate finding references are rejected', () => {
  const electricity = servicesFindingConfig('electricity');
  const observe = findCommandNode(['services', 'electricity', 'observe'])!
    .findingTarget!;
  let inspection = createEmptyInspectionRecord();
  const observed = commitInspectionFindingField(
    inspection,
    observe,
    'Consumer unit appears dated.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  inspection = observed.result.inspection;

  const target = photoTarget(electricity.findingId, electricity.elementConceptId);
  const evidence = {
    id: 'evidence.photo.duplicate',
    kind: 'photo' as const,
    uri: '/persistent/photo.jpg',
  };
  const first = commitInspectionEvidencePhoto(inspection, target, evidence);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(
    executeInspectionOperation(first.result.inspection, {
      operationId: SURVEY_OPERATIONS.addInspectionEvidence,
      arguments: {
        findingId: electricity.findingId,
        evidence,
      },
    }),
    null,
  );
});

test('water and electricity evidence remain independent', async () => {
  const electricity = servicesFindingConfig('electricity');
  const water = servicesFindingConfig('water');
  let inspection = createEmptyInspectionRecord();

  for (const config of [electricity, water]) {
    const observe = findCommandNode([...config.route, 'observe'])!.findingTarget!;
    const observed = commitInspectionFindingField(
      inspection,
      observe,
      `${config.label} observation.`,
    );
    assert.equal(observed.ok, true);
    if (!observed.ok) return;
    inspection = observed.result.inspection;
  }

  const electricityPhoto = await captureAndCommitInspectionEvidencePhoto({
    inspection,
    target: photoTarget(electricity.findingId, electricity.elementConceptId),
    jobId: 'job.test.evidence',
    temporaryUri: 'file:///tmp/electric.jpg',
    fileStore: mockFileStore(),
    createId: () => 'evidence.photo.electric',
  });
  assert.equal(electricityPhoto.ok, true);
  if (!electricityPhoto.ok) return;
  inspection = electricityPhoto.result.inspection;

  const waterPhoto = await captureAndCommitInspectionEvidencePhoto({
    inspection,
    target: photoTarget(water.findingId, water.elementConceptId),
    jobId: 'job.test.evidence',
    temporaryUri: 'file:///tmp/water.jpg',
    fileStore: mockFileStore(),
    createId: () => 'evidence.photo.water',
  });
  assert.equal(waterPhoto.ok, true);
  if (!waterPhoto.ok) return;

  assert.equal(
    countFindingPhotoEvidence(waterPhoto.result.inspection, electricity.findingId),
    1,
  );
  assert.equal(
    countFindingPhotoEvidence(waterPhoto.result.inspection, water.findingId),
    1,
  );
});

test('serialized active job stores evidence metadata without embedded image bytes', () => {
  const job = createJob({
    findings: {
      'finding.service.electrical_installation.1': {
        id: 'finding.service.electrical_installation.1',
        elementConceptId: 'service_system.electrical_installation',
        observation: 'Dated consumer unit.',
        evidence: [{ id: 'evidence.photo.1' }],
      },
    },
    evidence: {
      'evidence.photo.1': {
        id: 'evidence.photo.1',
        kind: 'photo',
        uri: '/persistent/muffle/jobs/job.test.evidence/evidence/evidence.photo.1.jpg',
      },
    },
  });
  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.ok(restored);
  assert.equal(restored?.inspection.evidence?.['evidence.photo.1']?.uri.endsWith('.jpg'), true);
  assert.equal(activeJobContainsEmbeddedImageData(job), false);
});

test('file helper derives deterministic job evidence paths', () => {
  assert.equal(
    evidencePhotoRelativePath('job.demo', 'evidence.photo.abc'),
    'muffle/jobs/job.demo/evidence/evidence.photo.abc.jpg',
  );
  assert.equal(evidencePhotoFilename('evidence.photo.abc'), 'evidence.photo.abc.jpg');
});

test('failed engine commit cleans up copied photo file', async () => {
  const deleted: string[] = [];
  const fileStore = mockFileStore({
    async deleteEvidenceFile(uri: string) {
      deleted.push(uri);
    },
  });
  const electricity = servicesFindingConfig('electricity');
  const result = await captureAndCommitInspectionEvidencePhoto({
    inspection: createEmptyInspectionRecord(),
    target: photoTarget(electricity.findingId, electricity.elementConceptId),
    jobId: 'job.test.evidence',
    temporaryUri: 'file:///tmp/orphan.jpg',
    fileStore,
    createId: () => 'evidence.photo.orphan',
  });
  assert.equal(result.ok, false);
  assert.equal(deleted.length, 1);
});

test('createEvidencePhotoId uses stable evidence prefix', () => {
  assert.match(createEvidencePhotoId(123), /^evidence\.photo\./);
});

test('expo evidence file store uses File/Directory API not legacy filesystem helpers', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const testsDir = path.dirname(fileURLToPath(import.meta.url));
  const adapter = readFileSync(
    path.join(testsDir, '../src/lib/evidence-files.ts'),
    'utf8',
  );
  const store = readFileSync(
    path.join(testsDir, '../src/core/local-media-store.ts'),
    'utf8',
  );
  assert.match(adapter, /createPlatformLocalMediaStore/);
  assert.match(adapter, /SURVEY_EVIDENCE_MEDIA_PATH/);
  assert.doesNotMatch(adapter, /\.makeDirectoryAsync\b/);
  assert.doesNotMatch(adapter, /\.copyAsync\b/);
  assert.doesNotMatch(adapter, /\.deleteAsync\b/);
  assert.doesNotMatch(adapter, /expo-file-system\/legacy/);
  assert.doesNotMatch(adapter, /\.documentDirectory\b/);
  assert.match(store, /createWebSessionLocalMediaStore/);
  assert.match(store, /nativeFilesystemCopyUri/);
  assert.match(store, /\{ Directory, File, Paths \}/);
  assert.match(store, /directory\.create\(\{ intermediates: true/);
  assert.match(store, /source\.bytes\(\)/);
  assert.match(store, /destination\.write\(bytes\)/);
  assert.match(store, /source\.copy\(destination\)/);
  assert.doesNotMatch(store, /\.makeDirectoryAsync\b/);
  assert.doesNotMatch(store, /\.copyAsync\b/);
  assert.doesNotMatch(store, /\.deleteAsync\b/);
  assert.doesNotMatch(store, /expo-file-system\/legacy/);
  assert.doesNotMatch(store, /\.documentDirectory\b/);
});

test('photo save failure keeps generic UI message after file store throws', async () => {
  const errors: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };
  try {
    const electricity = servicesFindingConfig('electricity');
    const result = await captureAndCommitInspectionEvidencePhoto({
      inspection: createEmptyInspectionRecord(),
      target: photoTarget(electricity.findingId, electricity.elementConceptId),
      jobId: 'job.test.evidence',
      temporaryUri: 'file:///tmp/missing.jpg',
      fileStore: mockFileStore({
        async copyPhotoToEvidenceDirectory() {
          throw new Error('simulated filesystem failure');
        },
      }),
      createId: () => 'evidence.photo.fail',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, 'Photo could not be saved');
    }
    assert.ok(
      errors.some(
        (entry) =>
          Array.isArray(entry) &&
          entry[0] === '[evidence-photo] Failed to save photo',
      ),
    );
  } finally {
    console.error = originalError;
  }
});

function photoTarget(
  findingId: string,
  elementConceptId: InspectionElementConceptId,
) {
  return { findingId, elementConceptId };
}

function webSessionFileStore(): EvidenceFileStore {
  const store = createWebSessionLocalMediaStore();
  return {
    ensureJobEvidenceDirectory(jobId) {
      return store.ensureRecordDirectory(jobId);
    },
    copyPhotoToEvidenceDirectory(jobId, evidenceId, source) {
      return store.copyFileIntoDirectory(jobId, evidenceId, source);
    },
    deleteEvidenceFile(uri) {
      return store.deleteFile(uri);
    },
  };
}

test('web picker File produces a same-session URI through evidence.add without native copy', async () => {
  const chimney = externalFindingConfig('chimney');
  const walls = externalFindingConfig('walls');
  let inspection = createEmptyInspectionRecord();

  for (const config of [chimney, walls]) {
    const observe = findCommandNode([...config.route, 'observe'])!.findingTarget!;
    const observed = commitInspectionFindingField(
      inspection,
      observe,
      `${config.label} observation.`,
    );
    assert.equal(observed.ok, true);
    if (!observed.ok) return;
    inspection = observed.result.inspection;
  }

  const inner = webSessionFileStore();
  const nativeCopyAttempts: unknown[] = [];
  const fileStore: EvidenceFileStore = {
    ...inner,
    async copyPhotoToEvidenceDirectory(jobId, evidenceId, source) {
      nativeCopyAttempts.push(source);
      assert.throws(() => nativeFilesystemCopyUri(source));
      return inner.copyPhotoToEvidenceDirectory(jobId, evidenceId, source);
    },
  };

  const first = await captureAndCommitInspectionEvidencePhoto({
    inspection,
    target: photoTarget(chimney.findingId, chimney.elementConceptId),
    jobId: 'job.test.evidence',
    temporaryUri: 'blob:https://localhost/picker-1',
    file: new Blob([Uint8Array.from([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
    fileStore,
    createId: () => 'evidence.photo.chimney-a',
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  inspection = first.result.inspection;

  const second = await captureAndCommitInspectionEvidencePhoto({
    inspection,
    target: photoTarget(chimney.findingId, chimney.elementConceptId),
    jobId: 'job.test.evidence',
    temporaryUri: 'blob:https://localhost/picker-2',
    file: new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xdb])], {
      type: 'image/jpeg',
    }),
    fileStore,
    createId: () => 'evidence.photo.chimney-b',
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  inspection = second.result.inspection;

  assert.equal(first.result.operationId, SURVEY_EVIDENCE_ADD);
  assert.equal(isBrowserSessionMediaUri(first.evidence.uri), true);
  assert.equal(isBrowserSessionMediaUri(second.evidence.uri), true);
  assert.notEqual(first.evidence.uri, second.evidence.uri);
  assert.deepEqual(inspection.findings[chimney.findingId]?.evidence, [
    { id: 'evidence.photo.chimney-a' },
    { id: 'evidence.photo.chimney-b' },
  ]);
  assert.equal(inspection.findings[walls.findingId]?.evidence, undefined);
  assert.equal(countFindingPhotoEvidence(inspection, walls.findingId), 0);
  assert.equal(countFindingPhotoEvidence(inspection, chimney.findingId), 2);
  assert.equal(nativeCopyAttempts.length, 2);

  const job = createJob(inspection);
  assert.equal(activeJobContainsEmbeddedImageData(job), false);
  const serialized = serializeActiveJob(job);
  assert.equal(serialized.includes('data:image'), false);
  assert.ok(
    !Object.values(inspection.evidence ?? {}).some((record) => 'file' in record),
  );
});

test('web evidence still requires observation first', async () => {
  const chimney = externalFindingConfig('chimney');
  const result = await captureAndCommitInspectionEvidencePhoto({
    inspection: createEmptyInspectionRecord(),
    target: photoTarget(chimney.findingId, chimney.elementConceptId),
    jobId: 'job.test.evidence',
    temporaryUri: 'blob:https://localhost/picker-early',
    file: new Blob(['img'], { type: 'image/jpeg' }),
    fileStore: webSessionFileStore(),
    createId: () => 'evidence.photo.chimney-early',
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.message, 'Record observation first');
  }
});

