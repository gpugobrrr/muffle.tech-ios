import assert from 'node:assert/strict';
import test from 'node:test';

import { findCommandNode } from '../src/lib/command-registry';
import {
  captureAndCommitInspectionEvidencePhoto,
  countFindingPhotoEvidence,
  isEvidenceCaptureNode,
} from '../src/lib/evidence-capture';
import type { EvidenceFileStore } from '../src/lib/evidence-files';
import {
  evidenceJobDirectory,
  evidencePhotoRelativePath,
} from '../src/lib/evidence-files';
import {
  commitInspectionFindingField,
  isFindingCaptureNode,
} from '../src/lib/finding-capture';
import {
  commitFindingEntrySession,
  openFindingEntrySession,
  resolveFindingEntryCommitTarget,
} from '../src/lib/finding-entry-session';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import {
  activeJobContainsEmbeddedImageData,
  createInitialActiveJob,
  deserializeActiveJob,
  serializeActiveJob,
} from '../src/lib/job-persistence';
import {
  SERVICES_FINDING_CONFIGS,
  SERVICES_GAS_FINDING_CONFIG,
} from '../src/lib/services-findings';
import type { InspectionElementConceptId } from '../src/lib/inspection-finding-elements';

/** All configured Type 6 finding routes from the live registry. */
const FINDING_ROUTES = [
  ...SERVICES_FINDING_CONFIGS.map((config) => ({
    label: config.label,
    route: [...config.route],
    findingId: config.findingId,
    elementConceptId: config.elementConceptId,
  })),
  {
    label: SERVICES_GAS_FINDING_CONFIG.label,
    route: [...SERVICES_GAS_FINDING_CONFIG.route],
    findingId: SERVICES_GAS_FINDING_CONFIG.findingId,
    elementConceptId: SERVICES_GAS_FINDING_CONFIG.elementConceptId,
  },
  {
    label: 'External walls',
    route: ['external', 'walls'],
    findingId: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as InspectionElementConceptId,
  },
] as const;

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

test('configured finding routes expose observation, defect, and Add photo leaves', () => {
  for (const route of FINDING_ROUTES) {
    const observe = findCommandNode([...route.route, 'observe']);
    const defect = findCommandNode([...route.route, 'defect']);
    const photo = findCommandNode([...route.route, 'photo']);

    assert.ok(observe, `${route.label}: missing observe`);
    assert.ok(defect, `${route.label}: missing defect`);
    assert.ok(photo, `${route.label}: missing photo`);
    assert.equal(isFindingCaptureNode(observe), true);
    assert.equal(isFindingCaptureNode(defect), true);
    assert.equal(isEvidenceCaptureNode(photo), true);

    assert.deepEqual(observe!.findingTarget, {
      findingId: route.findingId,
      elementConceptId: route.elementConceptId,
      field: 'observation',
    });
    assert.deepEqual(defect!.findingTarget, {
      findingId: route.findingId,
      elementConceptId: route.elementConceptId,
      field: 'defect',
    });
    assert.deepEqual(photo!.evidenceCaptureTarget, {
      findingId: route.findingId,
      elementConceptId: route.elementConceptId,
    });
  }
});

test('Type 6 smoke: observation creates stable finding; defect updates same id; defect-first gates', () => {
  for (const route of FINDING_ROUTES) {
    const observe = findCommandNode([...route.route, 'observe'])!.findingTarget!;
    const defect = findCommandNode([...route.route, 'defect'])!.findingTarget!;

    const rejected = commitInspectionFindingField(
      createEmptyInspectionRecord(),
      defect,
      `${route.label} premature defect.`,
    );
    assert.equal(rejected.ok, false, `${route.label}: defect-first should fail`);
    if (!rejected.ok) {
      assert.equal(rejected.message, 'Record observation first');
    }

    const observed = commitInspectionFindingField(
      createEmptyInspectionRecord(),
      observe,
      `${route.label} observation.`,
    );
    assert.equal(observed.ok, true, `${route.label}: observation should commit`);
    if (!observed.ok) continue;

    const finding = observed.result.inspection.findings[route.findingId];
    assert.ok(finding, `${route.label}: stable finding missing`);
    assert.equal(finding.id, route.findingId);
    assert.equal(finding.elementConceptId, route.elementConceptId);
    assert.equal(finding.observation, `${route.label} observation.`);

    const defected = commitInspectionFindingField(
      observed.result.inspection,
      defect,
      `${route.label} defect.`,
    );
    assert.equal(defected.ok, true, `${route.label}: defect after observation`);
    if (!defected.ok) continue;
    assert.equal(Object.keys(defected.result.inspection.findings).length, 1);
    assert.equal(
      defected.result.inspection.findings[route.findingId]?.defect,
      `${route.label} defect.`,
    );
    assert.equal(
      defected.result.inspection.findings[route.findingId]?.observation,
      `${route.label} observation.`,
    );
  }
});

test('Type 6 smoke: finding IDs and element concepts stay route-isolated', () => {
  let inspection = createEmptyInspectionRecord();
  for (const route of FINDING_ROUTES) {
    const observe = findCommandNode([...route.route, 'observe'])!.findingTarget!;
    const observed = commitInspectionFindingField(
      inspection,
      observe,
      `${route.label} isolated observation.`,
    );
    assert.equal(observed.ok, true);
    if (!observed.ok) return;
    inspection = observed.result.inspection;
  }

  assert.equal(Object.keys(inspection.findings).length, FINDING_ROUTES.length);
  for (const route of FINDING_ROUTES) {
    assert.equal(
      inspection.findings[route.findingId]?.elementConceptId,
      route.elementConceptId,
    );
    assert.equal(
      inspection.findings[route.findingId]?.observation,
      `${route.label} isolated observation.`,
    );
  }
});

test('Type 7 smoke: each evidence-capable route attaches photo to its own finding', async () => {
  for (const route of FINDING_ROUTES) {
    const observe = findCommandNode([...route.route, 'observe'])!.findingTarget!;
    const photo = findCommandNode([...route.route, 'photo'])!;
    assert.ok(photo.evidenceCaptureTarget);

    let inspection = createEmptyInspectionRecord();
    const observed = commitInspectionFindingField(
      inspection,
      observe,
      `${route.label} photo observation.`,
    );
    assert.equal(observed.ok, true);
    if (!observed.ok) continue;
    inspection = observed.result.inspection;

    const evidenceId = `evidence.photo.${route.findingId.replace(/\./g, '-')}`;
    const committed = await captureAndCommitInspectionEvidencePhoto({
      inspection,
      target: photo.evidenceCaptureTarget!,
      jobId: 'job.smoke.evidence',
      temporaryUri: `file:///tmp/${route.label}.jpg`,
      fileStore: mockFileStore(),
      createId: () => evidenceId,
    });
    assert.equal(committed.ok, true, `${route.label}: evidence.add`);
    if (!committed.ok) continue;

    assert.equal(
      committed.result.inspection.evidence?.[evidenceId]?.kind,
      'photo',
    );
    assert.deepEqual(
      committed.result.inspection.findings[route.findingId]?.evidence,
      [{ id: evidenceId }],
    );
    assert.equal(countFindingPhotoEvidence(committed.result.inspection, route.findingId), 1);
  }
});

test('Type 7 smoke: two photos attach as distinct evidence IDs on one finding', async () => {
  const electricity = FINDING_ROUTES.find((route) => route.label === 'Electricity')!;
  const observe = findCommandNode([...electricity.route, 'observe'])!.findingTarget!;
  const photo = findCommandNode([...electricity.route, 'photo'])!.evidenceCaptureTarget!;

  let inspection = createEmptyInspectionRecord();
  const observed = commitInspectionFindingField(
    inspection,
    observe,
    'Consumer unit appears dated.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  inspection = observed.result.inspection;

  for (const evidenceId of ['evidence.photo.one', 'evidence.photo.two']) {
    const committed = await captureAndCommitInspectionEvidencePhoto({
      inspection,
      target: photo,
      jobId: 'job.smoke.evidence',
      temporaryUri: `file:///tmp/${evidenceId}.jpg`,
      fileStore: mockFileStore(),
      createId: () => evidenceId,
    });
    assert.equal(committed.ok, true);
    if (!committed.ok) return;
    inspection = committed.result.inspection;
  }

  assert.equal(Object.keys(inspection.findings).length, 1);
  assert.equal(countFindingPhotoEvidence(inspection, electricity.findingId), 2);
  assert.deepEqual(
    inspection.findings[electricity.findingId]?.evidence,
    [{ id: 'evidence.photo.one' }, { id: 'evidence.photo.two' }],
  );
  assert.equal(Object.keys(inspection.evidence ?? {}).length, 2);
});

test('persistence smoke: ActiveJob round-trip keeps finding fields and evidence refs without image bytes', async () => {
  const electricity = FINDING_ROUTES.find((route) => route.label === 'Electricity')!;
  const observe = findCommandNode([...electricity.route, 'observe'])!.findingTarget!;
  const defect = findCommandNode([...electricity.route, 'defect'])!.findingTarget!;
  const photo = findCommandNode([...electricity.route, 'photo'])!.evidenceCaptureTarget!;

  let job = createInitialActiveJob();
  const observed = commitInspectionFindingField(
    job.inspection,
    observe,
    'Consumer unit appears dated.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  job = { ...job, inspection: observed.result.inspection };

  const defected = commitInspectionFindingField(
    job.inspection,
    defect,
    'Signs of thermal discolouration.',
  );
  assert.equal(defected.ok, true);
  if (!defected.ok) return;
  job = { ...job, inspection: defected.result.inspection };

  for (const evidenceId of ['evidence.photo.persist-1', 'evidence.photo.persist-2']) {
    const committed = await captureAndCommitInspectionEvidencePhoto({
      inspection: job.inspection,
      target: photo,
      jobId: job.id,
      temporaryUri: `file:///tmp/${evidenceId}.jpg`,
      fileStore: mockFileStore(),
      createId: () => evidenceId,
    });
    assert.equal(committed.ok, true);
    if (!committed.ok) return;
    job = { ...job, inspection: committed.result.inspection };
  }

  assert.equal(activeJobContainsEmbeddedImageData(job), false);

  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.ok(restored);
  assert.equal(
    restored!.inspection.findings[electricity.findingId]?.observation,
    'Consumer unit appears dated.',
  );
  assert.equal(
    restored!.inspection.findings[electricity.findingId]?.defect,
    'Signs of thermal discolouration.',
  );
  assert.equal(
    countFindingPhotoEvidence(restored!.inspection, electricity.findingId),
    2,
  );
  assert.equal(
    restored!.inspection.evidence?.['evidence.photo.persist-1']?.kind,
    'photo',
  );
  assert.equal(
    restored!.inspection.evidence?.['evidence.photo.persist-2']?.uri.includes(
      'evidence.photo.persist-2.jpg',
    ),
    true,
  );
  assert.equal(activeJobContainsEmbeddedImageData(restored!), false);
});

test('frozen entry-session identity still commits observation when live selection is defect', () => {
  const observe = findCommandNode(['services', 'electricity', 'observe'])!;
  const defect = findCommandNode(['services', 'electricity', 'defect'])!;
  const session = openFindingEntrySession(
    ['services', 'electricity', 'observe'],
    observe.findingTarget!,
    observe.token,
  );
  const liveSelection = defect.findingTarget!;
  assert.equal(liveSelection.field, 'defect');
  assert.equal(
    resolveFindingEntryCommitTarget(session, liveSelection)?.field,
    'observation',
  );

  const committed = commitFindingEntrySession(
    createEmptyInspectionRecord(),
    session,
    'test',
    liveSelection,
  );
  assert.equal(committed.ok, true);
  if (!committed.ok) return;
  assert.equal(
    committed.result.inspection.findings[
      'finding.service.electrical_installation.1'
    ]?.observation,
    'test',
  );
});

test('oil remains blocked and has no finding capture leaves', () => {
  const oil = findCommandNode(['services', 'gas-oil', 'oil']);
  assert.ok(oil);
  assert.equal(oil!.workflowOnly, true);
  assert.equal(findCommandNode(['services', 'gas-oil', 'oil', 'observe']), null);
  assert.equal(findCommandNode(['services', 'gas-oil', 'oil', 'photo']), null);
});
