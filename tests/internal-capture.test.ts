import assert from 'node:assert/strict';
import test from 'node:test';

import { getOntologyConcept } from '../src/domain/ontology/muffle-ontology.v1';
import { parseCommand } from '../src/lib/command-parser';
import { findCommandNode } from '../src/lib/command-registry';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import {
  captureAndCommitInspectionEvidencePhoto,
  countFindingPhotoEvidence,
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
import {
  isInspectionElementConceptId,
} from '../src/lib/inspection-finding-elements';
import { INTERNAL_FINDING_CONFIGS } from '../src/lib/internal-findings';
import { EXTERNAL_FINDING_CONFIGS } from '../src/lib/external-findings';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import {
  activeJobContainsEmbeddedImageData,
  createInitialActiveJob,
  deserializeActiveJob,
  serializeActiveJob,
} from '../src/lib/job-persistence';
import { SERVICES_FINDING_CONFIGS } from '../src/lib/services-findings';
import {
  executeInspectionOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
import type { InspectionBrief, InspectionFinding } from '../src/types/workspace';

const CEILING = INTERNAL_FINDING_CONFIGS[0]!;
const CEILING_ROUTE = [...CEILING.route] as const;

const UNRESOLVED_INTERNAL = [
  ['internal', 'limitation'],
  ['internal', 'roof-structure'],
  ['internal', 'walls-partitions'],
  ['internal', 'floors'],
  ['internal', 'fireplaces-flues'],
  ['internal', 'built-ins'],
  ['internal', 'woodwork'],
  ['internal', 'bathroom'],
  ['internal', 'other'],
] as const;

function emptyBrief(): InspectionBrief {
  return {
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
}

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

test('Internal ceilings is Engine-backed Type 6/7 with a stable finding ID', () => {
  assert.equal(CEILING.findingId, 'finding.ceiling.1');
  assert.equal(CEILING.elementConceptId, 'building_element.ceiling');
  assert.equal(isInspectionElementConceptId(CEILING.elementConceptId), true);
  assert.equal(getOntologyConcept('building_element.ceiling')?.maturity, 'engine-backed');
  assert.equal(findCommandNode([...CEILING_ROUTE])?.workflowOnly, undefined);
  assert.ok(findCommandNode([...CEILING_ROUTE, 'observe'])?.findingTarget);
  assert.ok(findCommandNode([...CEILING_ROUTE, 'photo'])?.evidenceCaptureTarget);
});

test('unresolved Internal routes remain workflow placeholders without Engine writes', () => {
  for (const path of UNRESOLVED_INTERNAL) {
    const node = findCommandNode([...path]);
    assert.ok(node, path.join('/'));
    assert.equal(node?.workflowOnly, true, path.join('/'));
    assert.equal(node?.findingTarget, undefined, path.join('/'));
    assert.equal(node?.evidenceCaptureTarget, undefined, path.join('/'));
    assert.equal(node?.operationId, undefined, path.join('/'));
    assert.equal(findCommandNode([...path, 'observe']), null, path.join('/'));
    assert.notEqual(parseCommand(path.join('/')).type, 'operation', path.join('/'));
  }
});

test('fireplace/flue grouping is not collapsed onto External chimney truth', () => {
  const fireplace = findCommandNode(['internal', 'fireplaces-flues']);
  const chimney = findCommandNode(['external', 'chimney']);
  assert.equal(fireplace?.coverage?.canonicalConceptId, 'building_element.fireplace');
  assert.equal(chimney?.coverage?.canonicalConceptId, 'building_element.chimney');
  assert.notEqual(
    fireplace?.coverage?.canonicalConceptId,
    chimney?.coverage?.canonicalConceptId,
  );
  assert.equal(getOntologyConcept('building_element.fireplace')?.maturity, 'type-only');
  assert.equal(isInspectionElementConceptId('building_element.fireplace'), false);
  assert.equal(isInspectionElementConceptId('building_element.chimney'), true);
});

test('Engine finding upsert accepts ceiling and rejects type-only fireplace', () => {
  const rejected = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        id: 'finding.fireplace.1',
        elementConceptId: 'building_element.fireplace',
        observation: 'Open fireplace with no damper.',
      } as unknown as InspectionFinding,
    },
  });
  assert.equal(rejected, null);

  const accepted = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        id: CEILING.findingId,
        elementConceptId: CEILING.elementConceptId,
        observation: 'Hairline cracking at the ceiling/wall junction.',
      },
    },
  });
  assert.ok(accepted);
  assert.equal(accepted?.finding.id, CEILING.findingId);
});

test('Internal ceilings observation-first gates condition, defect, recommendation, and photo', async () => {
  const observe = findCommandNode([...CEILING_ROUTE, 'observe'])!.findingTarget!;
  const condition = findCommandNode([...CEILING_ROUTE, 'condition'])!.findingTarget!;
  const defect = findCommandNode([...CEILING_ROUTE, 'defect'])!.findingTarget!;
  const recommend = findCommandNode([...CEILING_ROUTE, 'recommend'])!.findingTarget!;
  const photo = findCommandNode([...CEILING_ROUTE, 'photo'])!.evidenceCaptureTarget!;

  for (const target of [condition, defect, recommend]) {
    const rejected = commitInspectionFindingField(
      createEmptyInspectionRecord(),
      target,
      'premature',
    );
    assert.equal(rejected.ok, false);
  }
  const photoFirst = await captureAndCommitInspectionEvidencePhoto({
    inspection: createEmptyInspectionRecord(),
    target: photo,
    jobId: 'job.internal.ceiling',
    temporaryUri: 'file:///tmp/ceiling-premature.jpg',
    fileStore: mockFileStore(),
    createId: () => 'evidence.photo.ceiling-premature',
  });
  assert.equal(photoFirst.ok, false);

  const observed = commitInspectionFindingField(
    createEmptyInspectionRecord(),
    observe,
    'Hairline cracking at the ceiling/wall junction.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  let inspection = observed.result.inspection;

  const conditioned = commitInspectionFindingField(
    inspection,
    condition,
    'Generally serviceable with local cracking.',
  );
  assert.equal(conditioned.ok, true);
  if (!conditioned.ok) return;
  inspection = conditioned.result.inspection;

  const defected = commitInspectionFindingField(
    inspection,
    defect,
    'Cracking follows the partition line.',
  );
  assert.equal(defected.ok, true);
  if (!defected.ok) return;
  inspection = defected.result.inspection;

  const recommended = commitInspectionFindingField(
    inspection,
    recommend,
    'Monitor and decorate after movement settles.',
  );
  assert.equal(recommended.ok, true);
  if (!recommended.ok) return;
  inspection = recommended.result.inspection;

  const finding = inspection.findings[CEILING.findingId];
  assert.equal(finding?.observation, 'Hairline cracking at the ceiling/wall junction.');
  assert.equal(finding?.condition, 'Generally serviceable with local cracking.');
  assert.equal(finding?.defect, 'Cracking follows the partition line.');
  assert.equal(finding?.recommendation, 'Monitor and decorate after movement settles.');
});

test('frozen Internal ceiling session commits observation when live selection is defect', () => {
  const observe = findCommandNode([...CEILING_ROUTE, 'observe'])!;
  const defect = findCommandNode([...CEILING_ROUTE, 'defect'])!;
  const session = openFindingEntrySession(
    [...CEILING_ROUTE, 'observe'],
    observe.findingTarget!,
    observe.token,
  );
  assert.equal(
    resolveFindingEntryCommitTarget(session, defect.findingTarget)?.field,
    'observation',
  );
  const committed = commitFindingEntrySession(
    createEmptyInspectionRecord(),
    session,
    'Ceiling observation from frozen session.',
    defect.findingTarget,
  );
  assert.equal(committed.ok, true);
  if (!committed.ok) return;
  assert.equal(
    committed.result.inspection.findings[CEILING.findingId]?.observation,
    'Ceiling observation from frozen session.',
  );
  assert.equal(
    committed.result.inspection.findings[CEILING.findingId]?.defect,
    undefined,
  );
});

test('Internal ceiling photos stay isolated from External and Services findings', async () => {
  const walls = EXTERNAL_FINDING_CONFIGS[0]!;
  const electricity = SERVICES_FINDING_CONFIGS[0]!;
  let inspection = createEmptyInspectionRecord();

  for (const config of [CEILING, walls, electricity]) {
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

  const photo = findCommandNode([...CEILING_ROUTE, 'photo'])!.evidenceCaptureTarget!;
  const first = await captureAndCommitInspectionEvidencePhoto({
    inspection,
    target: photo,
    jobId: 'job.internal.isolation',
    temporaryUri: 'file:///tmp/ceiling-a.jpg',
    fileStore: mockFileStore(),
    createId: () => 'evidence.photo.ceiling-a',
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  inspection = first.result.inspection;

  const second = await captureAndCommitInspectionEvidencePhoto({
    inspection,
    target: photo,
    jobId: 'job.internal.isolation',
    temporaryUri: 'file:///tmp/ceiling-b.jpg',
    fileStore: mockFileStore(),
    createId: () => 'evidence.photo.ceiling-b',
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  inspection = second.result.inspection;

  assert.equal(countFindingPhotoEvidence(inspection, CEILING.findingId), 2);
  assert.equal(countFindingPhotoEvidence(inspection, walls.findingId), 0);
  assert.equal(countFindingPhotoEvidence(inspection, electricity.findingId), 0);
  assert.deepEqual(inspection.findings[CEILING.findingId]?.evidence, [
    { id: 'evidence.photo.ceiling-a' },
    { id: 'evidence.photo.ceiling-b' },
  ]);
  assert.equal(inspection.evidence?.['evidence.photo.ceiling-a']?.kind, 'photo');
  assert.equal(inspection.evidence?.['evidence.photo.ceiling-a']?.uri.includes('base64'), false);
});

test('ActiveJob persistence round-trips Internal, External, and Services findings', async () => {
  const walls = EXTERNAL_FINDING_CONFIGS[0]!;
  const electricity = SERVICES_FINDING_CONFIGS[0]!;
  let job = createInitialActiveJob();

  const subjects = [
    {
      config: CEILING,
      observation: 'Hairline cracking at the ceiling/wall junction.',
      defect: 'Cracking follows the partition line.',
    },
    {
      config: walls,
      observation: 'Stepped cracking above the opening.',
      defect: 'Movement at the lintel.',
    },
    {
      config: electricity,
      observation: 'Consumer unit appears dated.',
      defect: 'No recent test documentation.',
    },
  ];

  for (const subject of subjects) {
    const observe = findCommandNode([...subject.config.route, 'observe'])!.findingTarget!;
    const defect = findCommandNode([...subject.config.route, 'defect'])!.findingTarget!;
    const observed = commitInspectionFindingField(
      job.inspection,
      observe,
      subject.observation,
    );
    assert.equal(observed.ok, true);
    if (!observed.ok) return;
    job = { ...job, inspection: observed.result.inspection };
    const defected = commitInspectionFindingField(
      job.inspection,
      defect,
      subject.defect,
    );
    assert.equal(defected.ok, true);
    if (!defected.ok) return;
    job = { ...job, inspection: defected.result.inspection };
  }

  const photo = findCommandNode([...CEILING_ROUTE, 'photo'])!.evidenceCaptureTarget!;
  const photoed = await captureAndCommitInspectionEvidencePhoto({
    inspection: job.inspection,
    target: photo,
    jobId: job.id,
    temporaryUri: 'file:///tmp/ceiling-persist.jpg',
    fileStore: mockFileStore(),
    createId: () => 'evidence.photo.ceiling-persist',
  });
  assert.equal(photoed.ok, true);
  if (!photoed.ok) return;
  job = { ...job, inspection: photoed.result.inspection };

  assert.equal(activeJobContainsEmbeddedImageData(job), false);
  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.ok(restored);
  for (const subject of subjects) {
    assert.equal(
      restored!.inspection.findings[subject.config.findingId]?.elementConceptId,
      subject.config.elementConceptId,
    );
    assert.equal(
      restored!.inspection.findings[subject.config.findingId]?.observation,
      subject.observation,
    );
    assert.equal(
      restored!.inspection.findings[subject.config.findingId]?.defect,
      subject.defect,
    );
  }
  assert.equal(
    countFindingPhotoEvidence(restored!.inspection, CEILING.findingId),
    1,
  );
  assert.equal(activeJobContainsEmbeddedImageData(restored!), false);
});

test('Internal findings stay optional and do not change directory completion', () => {
  for (const token of ['observe', 'condition', 'defect', 'recommend', 'evidence']) {
    const node = findCommandNode([...CEILING_ROUTE, token]);
    assert.equal(node?.optional, true, token);
    assert.notEqual(node?.required, true, token);
  }
  const completion = resolveDirectoryCompletion(['internal'], emptyBrief());
  assert.equal(completion?.completed, 0);
  assert.equal(completion?.total, 0);
});
