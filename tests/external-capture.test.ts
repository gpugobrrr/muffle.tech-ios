import assert from 'node:assert/strict';
import test from 'node:test';

import { getOntologyConcept } from '../src/domain/ontology/muffle-ontology.v1';
import { parseCommand } from '../src/lib/command-parser';
import { childNodes, findCommandNode } from '../src/lib/command-registry';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import {
  resolveSvyrNodeDataEntryType,
  SVYR_DATA_ENTRY_TYPES,
} from '../src/lib/data-entry-types';
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
import { findFieldDefinition } from '../src/lib/field-schema';
import {
  commitInspectionFindingField,
  isFindingCaptureNode,
} from '../src/lib/finding-capture';
import {
  commitFindingEntrySession,
  openFindingEntrySession,
  resolveFindingEntryCommitTarget,
} from '../src/lib/finding-entry-session';
import {
  INSPECTION_ELEMENT_CONCEPT_IDS,
  isInspectionElementConceptId,
} from '../src/lib/inspection-finding-elements';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import {
  activeJobContainsEmbeddedImageData,
  createInitialActiveJob,
  deserializeActiveJob,
  serializeActiveJob,
} from '../src/lib/job-persistence';
import { level2CoverageForRoute } from '../src/lib/level-2-capture';
import { EXTERNAL_FINDING_CONFIGS, externalFindingConfig } from '../src/lib/external-findings';
import { INTERNAL_FINDING_CONFIGS } from '../src/lib/internal-findings';
import { buildSurveyReport } from '../src/lib/report/build-survey-report';
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

const EXTERNAL_WALL_FINDING_ID = 'finding.external-wall.1';
const EXTERNAL_WALL_CONCEPT = 'building_element.external_wall';
const WALLS_ROUTE = ['external', 'walls'] as const;

/** Type-only ontology IDs that SVYR External labels must not promote into Engine findings. */
const TYPE_ONLY_EXTERNAL_CONCEPTS = ['building_element.porch'] as const;

const UNRESOLVED_EXTERNAL_LEAVES = [
  {
    path: ['external', 'limitation'],
    missing: 'Section/finding limitation is distinct from brief limitation.',
  },
  {
    path: ['external', 'porch'],
    missing: 'Porch is type-only; conservatory remains a separate unresolved kind.',
  },
  {
    path: ['external', 'joinery'],
    missing: 'Joinery/finishes is a publication grouping, not a subject.',
  },
  {
    path: ['external', 'other'],
    missing: 'No canonical miscellaneous external subject.',
  },
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

test('External tree exposes only the repository subjects and walls capture branch', () => {
  assert.deepEqual(
    childNodes(['external']).map(({ token }) => token),
    [
      'limitation',
      'chimney',
      'roof',
      'rainwater',
      'walls',
      'windows',
      'doors',
      'porch',
      'joinery',
      'other',
    ],
  );
  assert.equal(findCommandNode(['external', 'balcony']), null);
  assert.equal(findCommandNode(['external', 'conservatory']), null);
  assert.equal(findCommandNode(['external', 'drainage']), null);
  assert.equal(findCommandNode(['external', 'decorations']), null);
  assert.equal(level2CoverageForRoute('external')?.status, 'navigation-only');
});

test('External Engine-backed subjects expose generic Type 6/7 finding leaves', () => {
  for (const config of EXTERNAL_FINDING_CONFIGS) {
    const branch = findCommandNode([...config.route]);
    assert.ok(branch, config.label);
    assert.equal(branch?.workflowOnly, undefined, config.label);
    assert.equal(
      level2CoverageForRoute(config.route.join('/'))?.status,
      'interactive',
      config.label,
    );
    assert.equal(
      level2CoverageForRoute(config.route.join('/'))?.canonicalConceptId,
      config.elementConceptId,
    );
    assert.equal(
      level2CoverageForRoute(config.route.join('/'))?.engineBinding,
      'survey.inspection.finding.upsert',
    );

    const observe = findCommandNode([...config.route, 'observe']);
    const condition = findCommandNode([...config.route, 'condition']);
    const defect = findCommandNode([...config.route, 'defect']);
    const recommend = findCommandNode([...config.route, 'recommend']);
    const photo = findCommandNode([...config.route, 'photo']);
    const evidence = findCommandNode([...config.route, 'evidence']);

    assert.equal(isFindingCaptureNode(observe), true, config.label);
    assert.equal(isFindingCaptureNode(condition), true, config.label);
    assert.equal(isFindingCaptureNode(defect), true, config.label);
    assert.equal(isFindingCaptureNode(recommend), true, config.label);
    assert.equal(isEvidenceCaptureNode(photo), true, config.label);
    assert.equal(isFindingCaptureNode(evidence), true, config.label);
    assert.equal(
      resolveSvyrNodeDataEntryType(observe!),
      SVYR_DATA_ENTRY_TYPES.findingCapture,
    );
    assert.equal(
      resolveSvyrNodeDataEntryType(photo!),
      SVYR_DATA_ENTRY_TYPES.evidenceCapture,
    );
    for (const node of [observe, condition, defect, recommend, evidence]) {
      assert.deepEqual(node?.findingTarget?.findingId, config.findingId);
      assert.deepEqual(node?.findingTarget?.elementConceptId, config.elementConceptId);
    }
    assert.deepEqual(photo?.evidenceCaptureTarget, {
      findingId: config.findingId,
      elementConceptId: config.elementConceptId,
    });
  }
});

function nodeAtExactTokens(path: readonly string[]): ReturnType<typeof findCommandNode> {
  let node = findCommandNode([path[0]]);
  for (const token of path.slice(1)) {
    node = node?.children?.find((child) => child.token === token) ?? null;
  }
  return node;
}

test('unresolved External leaves stay placeholders without invented findings', () => {
  for (const leaf of UNRESOLVED_EXTERNAL_LEAVES) {
    const node = nodeAtExactTokens(leaf.path);
    assert.ok(node, leaf.path.join('/'));
    assert.equal(node?.workflowOnly, true, leaf.path.join('/'));
    assert.equal(node?.requiresValue, undefined, leaf.path.join('/'));
    assert.equal(node?.findingTarget, undefined, leaf.path.join('/'));
    assert.equal(node?.evidenceCaptureTarget, undefined, leaf.path.join('/'));
    assert.equal(findFieldDefinition([...leaf.path]), null, leaf.path.join('/'));
    assert.ok(node?.coverage?.blocker, leaf.missing);
    assert.equal(
      node?.children?.some((child) => child.findingTarget || child.evidenceCaptureTarget),
      undefined,
      leaf.path.join('/'),
    );
  }
});

test('exact External limitation token remains a reachable workflow placeholder', () => {
  const sectionLimitation = findCommandNode(['external', 'limitation']);
  assert.ok(sectionLimitation);
  assert.equal(sectionLimitation?.token, 'limitation');
  assert.equal(sectionLimitation?.workflowOnly, true);
  assert.equal(sectionLimitation?.operationId, undefined);
  assert.equal(sectionLimitation?.findingTarget, undefined);
  const parsed = parseCommand('external/limitation');
  assert.equal(parsed.type, 'placeholder');
  if (parsed.type === 'placeholder') {
    assert.deepEqual(parsed.path, ['external', 'limitation']);
  }
  assert.equal(parseCommand('prep/brief/limitation').type, 'operation');
});

test('External walls limit, further, and risk are finding capture on the walls finding', () => {
  const expected = [
    ['limit', 'limitation'],
    ['further', 'furtherInvestigation'],
    ['risk', 'risk'],
  ] as const;
  for (const [token, field] of expected) {
    const node = findCommandNode([...WALLS_ROUTE, token]);
    assert.equal(isFindingCaptureNode(node), true, token);
    assert.deepEqual(node?.findingTarget, {
      findingId: EXTERNAL_WALL_FINDING_ID,
      elementConceptId: EXTERNAL_WALL_CONCEPT,
      field,
    });
    assert.equal(node?.coverage?.engineBinding, 'survey.inspection.finding.upsert');
    assert.equal(node?.optional, true, token);
  }
  for (const token of ['limit', 'further', 'risk'] as const) {
    assert.equal(findCommandNode(['external', 'chimney', token]), null);
    assert.equal(findCommandNode(['external', 'windows', token]), null);
    assert.equal(findCommandNode(['external', 'roof', token]), null);
    assert.equal(findCommandNode(['external', 'doors', token]), null);
  }
});

test('type-only External ontology concepts stay out of InspectionElementConceptId', () => {
  assert.deepEqual(
    INSPECTION_ELEMENT_CONCEPT_IDS.filter((id) => id.startsWith('building_element.')),
    [
      'building_element.external_wall',
      'building_element.ceiling',
      'building_element.chimney',
      'building_element.rainwater_goods',
      'building_element.window',
      'building_element.roof_structure',
      'building_element.internal_wall',
      'building_element.floor',
      'building_element.bathroom_fitting',
      'building_element.roof_covering',
      'building_element.external_door',
    ],
  );
  for (const id of TYPE_ONLY_EXTERNAL_CONCEPTS) {
    const concept = getOntologyConcept(id);
    assert.ok(concept, id);
    assert.equal(concept.maturity, 'type-only', id);
    assert.equal(concept.bindings, undefined, id);
    assert.equal(isInspectionElementConceptId(id), false, id);
  }
  assert.equal(isInspectionElementConceptId(EXTERNAL_WALL_CONCEPT), true);
  assert.equal(isInspectionElementConceptId('building_element.chimney'), true);
  assert.equal(isInspectionElementConceptId('building_element.rainwater_goods'), true);
  assert.equal(isInspectionElementConceptId('building_element.window'), true);
  assert.equal(getOntologyConcept('building_element.roof'), undefined);
  assert.equal(isInspectionElementConceptId('building_element.roof_covering'), true);
  assert.equal(isInspectionElementConceptId('building_element.external_door'), true);
  assert.equal(getOntologyConcept('building_element.conservatory'), undefined);
  assert.equal(getOntologyConcept('building_element.joinery'), undefined);
});

test('Engine finding upsert accepts promoted External elements and rejects type-only porch', () => {
  const rejected = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        id: 'finding.porch.1',
        elementConceptId: 'building_element.porch',
        observation: 'The porch roof sags.',
      } as unknown as InspectionFinding,
    },
  });
  assert.equal(rejected, null);

  for (const config of EXTERNAL_FINDING_CONFIGS) {
    const accepted = executeInspectionOperation(createEmptyInspectionRecord(), {
      operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
      arguments: {
        finding: {
          id: config.findingId,
          elementConceptId: config.elementConceptId,
          observation: `${config.label} observation.`,
        },
      },
    });
    assert.ok(accepted, config.label);
    assert.equal(accepted?.finding?.id, config.findingId);
    assert.equal(accepted?.finding?.elementConceptId, config.elementConceptId);
  }
});

test('External walls observation-first gates condition, defect, recommendation, and photo', async () => {
  const observe = findCommandNode([...WALLS_ROUTE, 'observe'])!.findingTarget!;
  const condition = findCommandNode([...WALLS_ROUTE, 'condition'])!.findingTarget!;
  const defect = findCommandNode([...WALLS_ROUTE, 'defect'])!.findingTarget!;
  const recommend = findCommandNode([...WALLS_ROUTE, 'recommend'])!.findingTarget!;
  const photo = findCommandNode([...WALLS_ROUTE, 'photo'])!.evidenceCaptureTarget!;

  for (const target of [condition, defect, recommend]) {
    const rejected = commitInspectionFindingField(
      createEmptyInspectionRecord(),
      target,
      'Premature field.',
    );
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.equal(rejected.message, 'Record observation first');
  }

  const photoRejected = await captureAndCommitInspectionEvidencePhoto({
    inspection: createEmptyInspectionRecord(),
    target: photo,
    jobId: 'job.external.walls',
    temporaryUri: 'file:///tmp/premature.jpg',
    fileStore: mockFileStore(),
    createId: () => 'evidence.photo.premature',
  });
  assert.equal(photoRejected.ok, false);
  if (!photoRejected.ok) {
    assert.equal(photoRejected.message, 'Record observation first');
  }

  const observed = commitInspectionFindingField(
    createEmptyInspectionRecord(),
    observe,
    'Stepped cracking above the opening.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;

  const conditioned = commitInspectionFindingField(
    observed.result.inspection,
    condition,
    'Localised visible movement.',
  );
  assert.equal(conditioned.ok, true);
  if (!conditioned.ok) return;

  const defected = commitInspectionFindingField(
    conditioned.result.inspection,
    defect,
    'Open joint to the lintel bearing.',
  );
  assert.equal(defected.ok, true);
  if (!defected.ok) return;

  const recommended = commitInspectionFindingField(
    defected.result.inspection,
    recommend,
    'Monitor and raked pointing.',
  );
  assert.equal(recommended.ok, true);
  if (!recommended.ok) return;

  const finding = recommended.result.inspection.findings[EXTERNAL_WALL_FINDING_ID];
  assert.equal(finding?.elementConceptId, EXTERNAL_WALL_CONCEPT);
  assert.equal(finding?.observation, 'Stepped cracking above the opening.');
  assert.equal(finding?.condition, 'Localised visible movement.');
  assert.equal(finding?.defect, 'Open joint to the lintel bearing.');
  assert.equal(finding?.recommendation, 'Monitor and raked pointing.');
});

test('External walls frozen finding-entry session ignores later sibling selection', () => {
  const observe = findCommandNode([...WALLS_ROUTE, 'observe'])!;
  const defect = findCommandNode([...WALLS_ROUTE, 'defect'])!;
  const session = openFindingEntrySession(
    [...WALLS_ROUTE, 'observe'],
    observe.findingTarget!,
    observe.token,
  );
  assert.equal(
    resolveFindingEntryCommitTarget(session, defect.findingTarget!)?.field,
    'observation',
  );
  const committed = commitFindingEntrySession(
    createEmptyInspectionRecord(),
    session,
    'Frozen wall observation.',
    defect.findingTarget!,
  );
  assert.equal(committed.ok, true);
  if (!committed.ok) return;
  assert.equal(
    committed.result.inspection.findings[EXTERNAL_WALL_FINDING_ID]?.observation,
    'Frozen wall observation.',
  );
  assert.equal(
    committed.result.inspection.findings[EXTERNAL_WALL_FINDING_ID]?.defect,
    undefined,
  );
});

test('External walls Type 7 photos attach only to the wall finding and persist as IDs', async () => {
  const observe = findCommandNode([...WALLS_ROUTE, 'observe'])!.findingTarget!;
  const photo = findCommandNode([...WALLS_ROUTE, 'photo'])!.evidenceCaptureTarget!;
  const electricityObserve = findCommandNode([
    'services',
    'electricity',
    'observe',
  ])!.findingTarget!;

  let job = createInitialActiveJob();
  const wallObserved = commitInspectionFindingField(
    job.inspection,
    observe,
    'Stepped cracking above the opening.',
  );
  assert.equal(wallObserved.ok, true);
  if (!wallObserved.ok) return;
  job = { ...job, inspection: wallObserved.result.inspection };

  const electricityObserved = commitInspectionFindingField(
    job.inspection,
    electricityObserve,
    'Consumer unit appears dated.',
  );
  assert.equal(electricityObserved.ok, true);
  if (!electricityObserved.ok) return;
  job = { ...job, inspection: electricityObserved.result.inspection };

  for (const evidenceId of ['evidence.photo.wall-a', 'evidence.photo.wall-b']) {
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

  assert.equal(countFindingPhotoEvidence(job.inspection, EXTERNAL_WALL_FINDING_ID), 2);
  assert.deepEqual(job.inspection.findings[EXTERNAL_WALL_FINDING_ID]?.evidence, [
    { id: 'evidence.photo.wall-a' },
    { id: 'evidence.photo.wall-b' },
  ]);
  assert.equal(
    job.inspection.findings['finding.service.electrical_installation.1']?.evidence,
    undefined,
  );
  assert.equal(job.inspection.evidence?.['evidence.photo.wall-a']?.kind, 'photo');
  assert.equal(activeJobContainsEmbeddedImageData(job), false);

  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.ok(restored);
  assert.equal(
    restored!.inspection.findings[EXTERNAL_WALL_FINDING_ID]?.observation,
    'Stepped cracking above the opening.',
  );
  assert.equal(
    countFindingPhotoEvidence(restored!.inspection, EXTERNAL_WALL_FINDING_ID),
    2,
  );
  assert.equal(activeJobContainsEmbeddedImageData(restored!), false);
});

test('External finding leaves stay optional and do not invent required completion', () => {
  for (const config of EXTERNAL_FINDING_CONFIGS) {
    for (const token of ['observe', 'condition', 'defect', 'recommend', 'evidence']) {
      const node = findCommandNode([...config.route, token]);
      assert.equal(node?.optional, true, `${config.label}/${token}`);
      assert.notEqual(node?.required, true, `${config.label}/${token}`);
    }
  }
  const external = resolveDirectoryCompletion(['external'], emptyBrief());
  const walls = resolveDirectoryCompletion([...WALLS_ROUTE], emptyBrief());
  assert.equal(external?.completed, 0);
  assert.equal(external?.total, 0);
  assert.deepEqual(external?.children, []);
  assert.equal(walls?.completed, 0);
  assert.equal(walls?.total, 0);
  assert.deepEqual(walls?.children, []);
});

test('External findings persist independently with evidence IDs only', async () => {
  let job = createInitialActiveJob();
  for (const config of EXTERNAL_FINDING_CONFIGS) {
    const observe = findCommandNode([...config.route, 'observe'])!.findingTarget!;
    const condition = findCommandNode([...config.route, 'condition'])!.findingTarget!;
    const defect = findCommandNode([...config.route, 'defect'])!.findingTarget!;
    const recommend = findCommandNode([...config.route, 'recommend'])!.findingTarget!;
    const photo = findCommandNode([...config.route, 'photo'])!.evidenceCaptureTarget!;

    const observed = commitInspectionFindingField(
      job.inspection,
      observe,
      `${config.label} observation.`,
    );
    assert.equal(observed.ok, true, config.label);
    if (!observed.ok) return;
    job = { ...job, inspection: observed.result.inspection };

    const conditioned = commitInspectionFindingField(
      job.inspection,
      condition,
      `${config.label} condition.`,
    );
    assert.equal(conditioned.ok, true, config.label);
    if (!conditioned.ok) return;
    job = { ...job, inspection: conditioned.result.inspection };

    const defected = commitInspectionFindingField(
      job.inspection,
      defect,
      `${config.label} defect.`,
    );
    assert.equal(defected.ok, true, config.label);
    if (!defected.ok) return;
    job = { ...job, inspection: defected.result.inspection };

    const recommended = commitInspectionFindingField(
      job.inspection,
      recommend,
      `${config.label} recommendation.`,
    );
    assert.equal(recommended.ok, true, config.label);
    if (!recommended.ok) return;
    job = { ...job, inspection: recommended.result.inspection };

    const evidenceId = `evidence.photo.${config.routeId}`;
    const photographed = await captureAndCommitInspectionEvidencePhoto({
      inspection: job.inspection,
      target: photo,
      jobId: job.id,
      temporaryUri: `file:///tmp/${evidenceId}.jpg`,
      fileStore: mockFileStore(),
      createId: () => evidenceId,
    });
    assert.equal(photographed.ok, true, config.label);
    if (!photographed.ok) return;
    job = { ...job, inspection: photographed.result.inspection };
  }

  assert.equal(Object.keys(job.inspection.findings).length, EXTERNAL_FINDING_CONFIGS.length);
  assert.equal(job.inspection.findings['finding.service.electrical_installation.1'], undefined);
  assert.equal(activeJobContainsEmbeddedImageData(job), false);

  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.ok(restored);
  for (const config of EXTERNAL_FINDING_CONFIGS) {
    const finding: InspectionFinding | undefined =
      restored!.inspection.findings[config.findingId];
    assert.equal(finding?.id, config.findingId);
    assert.equal(finding?.elementConceptId, config.elementConceptId);
    assert.equal(finding?.observation, `${config.label} observation.`);
    assert.equal(finding?.condition, `${config.label} condition.`);
    assert.equal(finding?.defect, `${config.label} defect.`);
    assert.equal(finding?.recommendation, `${config.label} recommendation.`);
    assert.deepEqual(finding?.evidence, [{ id: `evidence.photo.${config.routeId}` }]);
    assert.equal(
      restored!.inspection.evidence?.[`evidence.photo.${config.routeId}`]?.kind,
      'photo',
    );
  }
  assert.equal(activeJobContainsEmbeddedImageData(restored!), false);
});

test('Roof and Doors resolve with stable finding IDs distinct from Internal roof structure', () => {
  const roof = externalFindingConfig('roof');
  const doors = externalFindingConfig('doors');
  const roofStructure = INTERNAL_FINDING_CONFIGS.find(
    (item) => item.routeId === 'roof-structure',
  )!;
  const windows = externalFindingConfig('windows');

  assert.equal(roof.findingId, 'finding.roof-covering.1');
  assert.equal(roof.elementConceptId, 'building_element.roof_covering');
  assert.equal(doors.findingId, 'finding.external-door.1');
  assert.equal(doors.elementConceptId, 'building_element.external_door');
  assert.notEqual(roof.elementConceptId, roofStructure.elementConceptId);
  assert.notEqual(roof.findingId, roofStructure.findingId);
  assert.notEqual(doors.elementConceptId, windows.elementConceptId);
  assert.equal(getOntologyConcept('building_element.internal_door'), undefined);
  assert.equal(getOntologyConcept('building_element.joinery'), undefined);
  assert.equal(getOntologyConcept('building_element.roof'), undefined);

  for (const config of [roof, doors]) {
    assert.equal(isInspectionElementConceptId(config.elementConceptId), true);
    assert.equal(
      getOntologyConcept(config.elementConceptId)?.maturity,
      'engine-backed',
    );
    assert.equal(findCommandNode([...config.route])?.workflowOnly, undefined);
    assert.equal(
      capabilityForRoute(config.route)?.kind,
      SURVEY_CAPABILITY_KINDS.navigation,
    );
    assert.equal(findCommandNode([...config.route, 'limit']), null);
    assert.equal(findCommandNode([...config.route, 'further']), null);
    assert.equal(findCommandNode([...config.route, 'risk']), null);
  }

  assert.equal(externalFindingConfig('walls').findingId, 'finding.external-wall.1');
  assert.equal(externalFindingConfig('chimney').findingId, 'finding.chimney.1');
  assert.equal(
    externalFindingConfig('rainwater').findingId,
    'finding.rainwater-goods.1',
  );
  assert.equal(windows.findingId, 'finding.window.1');
});

test('Roof and Doors are observation-first Type 6/7 with sibling isolation', async () => {
  const activated = [externalFindingConfig('roof'), externalFindingConfig('doors')];
  for (const config of activated) {
    const sibling = activated.find((item) => item.routeId !== config.routeId)!;
    const observe = findCommandNode([...config.route, 'observe'])!.findingTarget!;
    const condition = findCommandNode([...config.route, 'condition'])!.findingTarget!;
    const defect = findCommandNode([...config.route, 'defect'])!.findingTarget!;
    const recommend = findCommandNode([...config.route, 'recommend'])!.findingTarget!;
    const photo = findCommandNode([...config.route, 'photo'])!.evidenceCaptureTarget!;

    for (const target of [condition, defect, recommend]) {
      const rejected = commitInspectionFindingField(
        createEmptyInspectionRecord(),
        target,
        'premature',
      );
      assert.equal(rejected.ok, false, `${config.routeId} ${target.field}`);
      if (!rejected.ok) assert.equal(rejected.message, 'Record observation first');
    }
    const photoFirst = await captureAndCommitInspectionEvidencePhoto({
      inspection: createEmptyInspectionRecord(),
      target: photo,
      jobId: `job.external.${config.routeId}`,
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
      jobId: `job.external.${config.routeId}`,
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
    assert.equal(inspection.findings[sibling.findingId]?.defect, undefined);
    assert.equal(countFindingPhotoEvidence(inspection, config.findingId), 1);
    assert.equal(countFindingPhotoEvidence(inspection, sibling.findingId), 0);
  }
});

test('Roof stays isolated from Internal roof structure findings', () => {
  const roof = externalFindingConfig('roof');
  const roofStructure = INTERNAL_FINDING_CONFIGS.find(
    (item) => item.routeId === 'roof-structure',
  )!;
  const externalObserved = commitInspectionFindingField(
    createEmptyInspectionRecord(),
    findCommandNode([...roof.route, 'observe'])!.findingTarget!,
    'Slipped tiles at the rear slope.',
  );
  assert.equal(externalObserved.ok, true);
  if (!externalObserved.ok) return;
  const internalObserved = commitInspectionFindingField(
    externalObserved.result.inspection,
    findCommandNode([...roofStructure.route, 'observe'])!.findingTarget!,
    'Accessible rafters appear serviceable.',
  );
  assert.equal(internalObserved.ok, true);
  if (!internalObserved.ok) return;
  let inspection = internalObserved.result.inspection;

  const defected = commitInspectionFindingField(
    inspection,
    findCommandNode([...roof.route, 'defect'])!.findingTarget!,
    'Missing tiles expose the underlay.',
  );
  assert.equal(defected.ok, true);
  if (!defected.ok) return;
  inspection = defected.result.inspection;
  assert.equal(inspection.findings[roof.findingId]?.defect, 'Missing tiles expose the underlay.');
  assert.equal(inspection.findings[roofStructure.findingId]?.defect, undefined);
  assert.notEqual(
    inspection.findings[roof.findingId]?.elementConceptId,
    inspection.findings[roofStructure.findingId]?.elementConceptId,
  );
});

test('frozen Roof and Doors sessions commit the opened observation target', () => {
  for (const config of [externalFindingConfig('roof'), externalFindingConfig('doors')]) {
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

test('Roof and Doors serialize and project into SurveyReportModel findings.external', async () => {
  const roof = externalFindingConfig('roof');
  const doors = externalFindingConfig('doors');
  const roofStructure = INTERNAL_FINDING_CONFIGS.find(
    (item) => item.routeId === 'roof-structure',
  )!;
  let job = createInitialActiveJob();

  for (const config of [roof, doors, roofStructure]) {
    const observed = commitInspectionFindingField(
      job.inspection,
      findCommandNode([...config.route, 'observe'])!.findingTarget!,
      `${config.label} observation.`,
    );
    assert.equal(observed.ok, true, config.routeId);
    if (!observed.ok) return;
    job = { ...job, inspection: observed.result.inspection };
  }

  const photo = findCommandNode([...roof.route, 'photo'])!.evidenceCaptureTarget!;
  const photographed = await captureAndCommitInspectionEvidencePhoto({
    inspection: job.inspection,
    target: photo,
    jobId: job.id,
    temporaryUri: 'file:///tmp/roof-covering-persist.jpg',
    fileStore: mockFileStore(),
    createId: () => 'evidence.photo.roof-covering-persist',
  });
  assert.equal(photographed.ok, true);
  if (!photographed.ok) return;
  job = { ...job, inspection: photographed.result.inspection };

  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.ok(restored);
  assert.equal(
    restored!.inspection.findings[roof.findingId]?.observation,
    'Roof coverings observation.',
  );
  assert.equal(
    restored!.inspection.findings[doors.findingId]?.observation,
    'Outside doors observation.',
  );
  assert.equal(
    countFindingPhotoEvidence(restored!.inspection, roof.findingId),
    1,
  );

  const report = buildSurveyReport(restored!);
  assert.deepEqual(
    report.findings.external.map((finding) => finding.findingId),
    [roof.findingId, doors.findingId],
  );
  assert.equal(
    report.findings.internal.some((finding) => finding.findingId === roof.findingId),
    false,
  );
  assert.equal(
    report.findings.internal.some(
      (finding) => finding.findingId === roofStructure.findingId,
    ),
    true,
  );
});

test('Porch remains blocked and is not an Engine finding subject', () => {
  const porch = findCommandNode(['external', 'porch']);
  assert.equal(porch?.workflowOnly, true);
  assert.equal(findCommandNode(['external', 'porch', 'observe']), null);
  assert.equal(
    capabilityForRoute('external/porch')?.blockedReason,
    SURVEY_BLOCKED_REASONS.ontologyTypeOnly,
  );
  assert.equal(getOntologyConcept('building_element.porch')?.maturity, 'type-only');
  assert.equal(isInspectionElementConceptId('building_element.porch'), false);
});
