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
import {
  INTERNAL_FINDING_CONFIGS,
  internalFindingConfig,
  type InternalFindingConfig,
} from '../src/lib/internal-findings';
import { EXTERNAL_FINDING_CONFIGS } from '../src/lib/external-findings';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import {
  activeJobContainsEmbeddedImageData,
  createInitialActiveJob,
  deserializeActiveJob,
  serializeActiveJob,
} from '../src/lib/job-persistence';
import { buildSurveyReport } from '../src/lib/report/build-survey-report';
import { SERVICES_FINDING_CONFIGS } from '../src/lib/services-findings';
import {
  capabilityForRoute,
  SURVEY_CAPABILITY_KINDS,
  SURVEY_BLOCKED_REASONS,
} from '../src/lib/survey-capability';
import {
  executeInspectionOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
import type { InspectionBrief, InspectionFinding } from '../src/types/workspace';

const CEILING = internalFindingConfig('ceilings');
const CEILING_ROUTE = [...CEILING.route] as const;

const UNRESOLVED_INTERNAL = [
  ['internal', 'limitation'],
  ['internal', 'fireplaces-flues'],
  ['internal', 'built-ins'],
  ['internal', 'woodwork'],
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

function siblingConfig(config: InternalFindingConfig): InternalFindingConfig {
  return INTERNAL_FINDING_CONFIGS.find((item) => item.routeId !== config.routeId)!;
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

test('activated Internal subjects resolve with stable finding IDs and concepts', () => {
  const expected = {
    'roof-structure': {
      findingId: 'finding.roof-structure.1',
      elementConceptId: 'building_element.roof_structure',
    },
    ceilings: {
      findingId: 'finding.ceiling.1',
      elementConceptId: 'building_element.ceiling',
    },
    'walls-partitions': {
      findingId: 'finding.internal-wall.1',
      elementConceptId: 'building_element.internal_wall',
    },
    floors: {
      findingId: 'finding.floor.1',
      elementConceptId: 'building_element.floor',
    },
    bathroom: {
      findingId: 'finding.bathroom-fitting.1',
      elementConceptId: 'building_element.bathroom_fitting',
    },
  } as const;

  for (const config of INTERNAL_FINDING_CONFIGS) {
    const spec = expected[config.routeId];
    assert.equal(config.findingId, spec.findingId, config.routeId);
    assert.equal(config.elementConceptId, spec.elementConceptId, config.routeId);
    assert.equal(isInspectionElementConceptId(config.elementConceptId), true);
    assert.equal(
      getOntologyConcept(config.elementConceptId)?.maturity,
      'engine-backed',
      config.routeId,
    );
    const parent = findCommandNode([...config.route]);
    assert.ok(parent, config.route.join('/'));
    assert.equal(parent?.workflowOnly, undefined, config.routeId);
    assert.equal(parent?.coverage?.canonicalConceptId, config.elementConceptId);
    assert.equal(
      capabilityForRoute(config.route)?.kind,
      SURVEY_CAPABILITY_KINDS.navigation,
      config.routeId,
    );
    assert.ok(findCommandNode([...config.route, 'observe'])?.findingTarget);
    assert.ok(findCommandNode([...config.route, 'photo'])?.evidenceCaptureTarget);
    assert.equal(findCommandNode([...config.route, 'limit']), null, config.routeId);
    assert.equal(findCommandNode([...config.route, 'further']), null, config.routeId);
    assert.equal(findCommandNode([...config.route, 'risk']), null, config.routeId);
  }
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
  assert.equal(
    capabilityForRoute('internal/fireplaces-flues')?.blockedReason,
    SURVEY_BLOCKED_REASONS.ontologyTypeOnly,
  );
});

test('Internal walls stay distinct from External walls', () => {
  const internalWalls = internalFindingConfig('walls-partitions');
  const externalWalls = EXTERNAL_FINDING_CONFIGS.find((item) => item.routeId === 'walls')!;
  assert.notEqual(internalWalls.elementConceptId, externalWalls.elementConceptId);
  assert.notEqual(internalWalls.findingId, externalWalls.findingId);
  assert.equal(internalWalls.elementConceptId, 'building_element.internal_wall');
  assert.equal(externalWalls.elementConceptId, 'building_element.external_wall');
});

test('Internal roof structure stays distinct from External roof coverings', () => {
  const roofStructure = internalFindingConfig('roof-structure');
  const externalRoof = findCommandNode(['external', 'roof']);
  assert.equal(roofStructure.elementConceptId, 'building_element.roof_structure');
  assert.equal(getOntologyConcept('building_element.roof'), undefined);
  assert.equal(externalRoof?.coverage?.canonicalConceptId, 'building_element.roof_covering');
  assert.notEqual(
    roofStructure.elementConceptId,
    externalRoof?.coverage?.canonicalConceptId,
  );
  assert.equal(
    capabilityForRoute('external/roof')?.kind,
    SURVEY_CAPABILITY_KINDS.navigation,
  );
  assert.notEqual(findCommandNode(['external', 'roof', 'observe']), null);
});

test('Internal floors stay distinct from Property construction', () => {
  const floors = internalFindingConfig('floors');
  assert.equal(floors.elementConceptId, 'building_element.floor');
  assert.equal(
    capabilityForRoute('property/construction')?.kind,
    SURVEY_CAPABILITY_KINDS.blocked,
  );
  assert.equal(findCommandNode(['property', 'construction'])?.findingTarget, undefined);
  assert.equal(getOntologyConcept('construction'), undefined);
});

test('Bathroom fittings create no accommodation inventory', () => {
  const bathroom = internalFindingConfig('bathroom');
  assert.equal(bathroom.elementConceptId, 'building_element.bathroom_fitting');
  assert.equal(
    capabilityForRoute('property/accommodation')?.kind,
    SURVEY_CAPABILITY_KINDS.blocked,
  );
  assert.equal(findCommandNode(['property', 'accommodation'])?.findingTarget, undefined);
  assert.equal(findCommandNode(['internal', 'bathroom', 'inventory']), null);
});

test('Internal section limitation is not finding limitation', () => {
  const sectionLimit = findCommandNode(['internal', 'limitation']);
  const findingLimit = findCommandNode(['external', 'walls', 'limit']);
  assert.equal(sectionLimit?.workflowOnly, true);
  assert.equal(sectionLimit?.findingTarget, undefined);
  assert.equal(findingLimit?.findingTarget?.field, 'limitation');
  assert.equal(
    getOntologyConcept('limitation')?.bindings?.domainProperty,
    'InspectionFinding.limitation',
  );
  assert.notEqual(
    getOntologyConcept('inspection_brief.limitation')?.id,
    getOntologyConcept('limitation')?.id,
  );
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

test('activated Internal subjects are observation-first Type 6/7 with sibling isolation', async () => {
  for (const config of INTERNAL_FINDING_CONFIGS) {
    const observe = findCommandNode([...config.route, 'observe'])!.findingTarget!;
    const condition = findCommandNode([...config.route, 'condition'])!.findingTarget!;
    const defect = findCommandNode([...config.route, 'defect'])!.findingTarget!;
    const recommend = findCommandNode([...config.route, 'recommend'])!.findingTarget!;
    const photo = findCommandNode([...config.route, 'photo'])!.evidenceCaptureTarget!;
    const sibling = siblingConfig(config);

    for (const target of [condition, defect, recommend]) {
      const rejected = commitInspectionFindingField(
        createEmptyInspectionRecord(),
        target,
        'premature',
      );
      assert.equal(rejected.ok, false, `${config.routeId} ${target.field}`);
      if (!rejected.ok) {
        assert.equal(rejected.message, 'Record observation first');
      }
    }
    const photoFirst = await captureAndCommitInspectionEvidencePhoto({
      inspection: createEmptyInspectionRecord(),
      target: photo,
      jobId: `job.internal.${config.routeId}`,
      temporaryUri: `file:///tmp/${config.routeId}-premature.jpg`,
      fileStore: mockFileStore(),
      createId: () => `evidence.photo.${config.routeId}-premature`,
    });
    assert.equal(photoFirst.ok, false, config.routeId);

    const observed = commitInspectionFindingField(
      createEmptyInspectionRecord(),
      observe,
      `${config.label} observation.`,
    );
    assert.equal(observed.ok, true, config.routeId);
    if (!observed.ok) return;
    assert.equal(Object.keys(observed.result.inspection.findings).length, 1);
    assert.equal(
      observed.result.inspection.findings[config.findingId]?.observation,
      `${config.label} observation.`,
    );

    const siblingObserved = commitInspectionFindingField(
      observed.result.inspection,
      findCommandNode([...sibling.route, 'observe'])!.findingTarget!,
      `${sibling.label} observation.`,
    );
    assert.equal(siblingObserved.ok, true, sibling.routeId);
    if (!siblingObserved.ok) return;
    let inspection = siblingObserved.result.inspection;

    const defected = commitInspectionFindingField(
      inspection,
      defect,
      `${config.label} defect.`,
    );
    assert.equal(defected.ok, true, config.routeId);
    if (!defected.ok) return;
    inspection = defected.result.inspection;

    const recommended = commitInspectionFindingField(
      inspection,
      recommend,
      `${config.label} recommendation.`,
    );
    assert.equal(recommended.ok, true, config.routeId);
    if (!recommended.ok) return;
    inspection = recommended.result.inspection;

    const evidenced = await captureAndCommitInspectionEvidencePhoto({
      inspection,
      target: photo,
      jobId: `job.internal.${config.routeId}`,
      temporaryUri: `file:///tmp/${config.routeId}.jpg`,
      fileStore: mockFileStore(),
      createId: () => `evidence.photo.${config.routeId}`,
    });
    assert.equal(evidenced.ok, true, config.routeId);
    if (!evidenced.ok) return;
    inspection = evidenced.result.inspection;

    assert.equal(
      inspection.findings[config.findingId]?.defect,
      `${config.label} defect.`,
    );
    assert.equal(
      inspection.findings[config.findingId]?.recommendation,
      `${config.label} recommendation.`,
    );
    assert.equal(inspection.findings[sibling.findingId]?.defect, undefined);
    assert.equal(countFindingPhotoEvidence(inspection, config.findingId), 1);
    assert.equal(countFindingPhotoEvidence(inspection, sibling.findingId), 0);
  }
});

test('frozen Internal finding sessions commit the opened observation target', () => {
  for (const config of INTERNAL_FINDING_CONFIGS) {
    const observe = findCommandNode([...config.route, 'observe'])!;
    const defect = findCommandNode([...config.route, 'defect'])!;
    const session = openFindingEntrySession(
      [...config.route, 'observe'],
      observe.findingTarget!,
      observe.token,
    );
    assert.equal(
      resolveFindingEntryCommitTarget(session, defect.findingTarget)?.field,
      'observation',
      config.routeId,
    );
    const committed = commitFindingEntrySession(
      createEmptyInspectionRecord(),
      session,
      `${config.label} observation from frozen session.`,
      defect.findingTarget,
    );
    assert.equal(committed.ok, true, config.routeId);
    if (!committed.ok) return;
    assert.equal(
      committed.result.inspection.findings[config.findingId]?.observation,
      `${config.label} observation from frozen session.`,
    );
    assert.equal(
      committed.result.inspection.findings[config.findingId]?.defect,
      undefined,
    );
  }
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
    ...INTERNAL_FINDING_CONFIGS.map((config) => ({
      config,
      observation: `${config.label} observation.`,
      defect: `${config.label} defect.`,
    })),
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

  const report = buildSurveyReport(restored!);
  assert.deepEqual(
    report.findings.internal.map((finding) => finding.findingId),
    INTERNAL_FINDING_CONFIGS.map((config) => config.findingId),
  );
  assert.equal(
    report.findings.external.some((finding) => finding.findingId === walls.findingId),
    true,
  );
  assert.equal(
    report.findings.internal.some(
      (finding) => finding.findingId === walls.findingId,
    ),
    false,
  );
});

test('Internal findings stay optional and do not change directory completion', () => {
  for (const config of INTERNAL_FINDING_CONFIGS) {
    for (const token of ['observe', 'condition', 'defect', 'recommend', 'evidence']) {
      const node = findCommandNode([...config.route, token]);
      assert.equal(node?.optional, true, `${config.routeId}/${token}`);
      assert.notEqual(node?.required, true, `${config.routeId}/${token}`);
    }
  }
  const completion = resolveDirectoryCompletion(['internal'], emptyBrief());
  assert.equal(completion?.completed, 0);
  assert.equal(completion?.total, 0);
});
