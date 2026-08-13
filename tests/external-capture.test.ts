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
import {
  executeInspectionOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
import type { InspectionBrief, InspectionFinding } from '../src/types/workspace';

const EXTERNAL_WALL_FINDING_ID = 'finding.external-wall.1';
const EXTERNAL_WALL_CONCEPT = 'building_element.external_wall';
const WALLS_ROUTE = ['external', 'walls'] as const;

/** Type-only ontology IDs that SVYR External labels must not promote into Engine findings. */
const TYPE_ONLY_EXTERNAL_CONCEPTS = [
  'building_element.chimney',
  'building_element.rainwater_goods',
  'building_element.window',
  'building_element.porch',
] as const;

const UNRESOLVED_EXTERNAL_LEAVES = [
  {
    path: ['external', 'limitation'],
    missing: 'Section/finding limitation is distinct from brief limitation.',
  },
  {
    path: ['external', 'chimney'],
    missing: 'Chimney is type-only and not an InspectionElementConceptId.',
  },
  {
    path: ['external', 'roof'],
    missing: 'Roof covering is not a canonical Engine subject.',
  },
  {
    path: ['external', 'rainwater'],
    missing: 'Rainwater goods is type-only with no Engine binding.',
  },
  {
    path: ['external', 'windows'],
    missing: 'Window is type-only with no Engine binding.',
  },
  {
    path: ['external', 'doors'],
    missing: 'External door is not canonical.',
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
  {
    path: ['external', 'walls', 'limit'],
    missing: 'Finding-level limitation is not an InspectionFinding field.',
  },
  {
    path: ['external', 'walls', 'further'],
    missing: 'further_investigation is type-only and not an InspectionFinding field.',
  },
  {
    path: ['external', 'walls', 'risk'],
    missing: 'risk is type-only and not an InspectionFinding field.',
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

test('External walls remains the only Engine-backed Type 6/7 External subject', () => {
  const walls = findCommandNode([...WALLS_ROUTE]);
  assert.ok(walls);
  assert.equal(walls?.workflowOnly, undefined);
  assert.equal(level2CoverageForRoute('external/walls')?.status, 'interactive');
  assert.equal(
    level2CoverageForRoute('external/walls')?.canonicalConceptId,
    EXTERNAL_WALL_CONCEPT,
  );
  assert.equal(
    level2CoverageForRoute('external/walls')?.engineBinding,
    'survey.inspection.finding.upsert',
  );

  const observe = findCommandNode([...WALLS_ROUTE, 'observe']);
  const condition = findCommandNode([...WALLS_ROUTE, 'condition']);
  const defect = findCommandNode([...WALLS_ROUTE, 'defect']);
  const recommend = findCommandNode([...WALLS_ROUTE, 'recommend']);
  const photo = findCommandNode([...WALLS_ROUTE, 'photo']);
  const evidence = findCommandNode([...WALLS_ROUTE, 'evidence']);

  assert.equal(isFindingCaptureNode(observe), true);
  assert.equal(isFindingCaptureNode(condition), true);
  assert.equal(isFindingCaptureNode(defect), true);
  assert.equal(isFindingCaptureNode(recommend), true);
  assert.equal(isEvidenceCaptureNode(photo), true);
  assert.equal(isFindingCaptureNode(evidence), true);

  assert.equal(
    resolveSvyrNodeDataEntryType(observe!),
    SVYR_DATA_ENTRY_TYPES.findingCapture,
  );
  assert.equal(
    resolveSvyrNodeDataEntryType(photo!),
    SVYR_DATA_ENTRY_TYPES.evidenceCapture,
  );

  for (const node of [observe, condition, defect, recommend, evidence]) {
    assert.deepEqual(node?.findingTarget?.findingId, EXTERNAL_WALL_FINDING_ID);
    assert.deepEqual(node?.findingTarget?.elementConceptId, EXTERNAL_WALL_CONCEPT);
  }
  assert.deepEqual(photo?.evidenceCaptureTarget, {
    findingId: EXTERNAL_WALL_FINDING_ID,
    elementConceptId: EXTERNAL_WALL_CONCEPT,
  });
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

test('PREP limitation alias does not make External limitation a capture field', () => {
  const sectionLimitation = nodeAtExactTokens(['external', 'limitation']);
  assert.ok(sectionLimitation);
  assert.equal(sectionLimitation?.token, 'limitation');
  assert.equal(sectionLimitation?.workflowOnly, true);
  assert.equal(findCommandNode(['external', 'limitation']), null);
  assert.notEqual(parseCommand('external/limitation').type, 'operation');
});

test('type-only External ontology concepts stay out of InspectionElementConceptId', () => {
  assert.equal(
    INSPECTION_ELEMENT_CONCEPT_IDS.filter((id) => id.startsWith('building_element.')).join(','),
    EXTERNAL_WALL_CONCEPT,
  );
  for (const id of TYPE_ONLY_EXTERNAL_CONCEPTS) {
    const concept = getOntologyConcept(id);
    assert.ok(concept, id);
    assert.equal(concept.maturity, 'type-only', id);
    assert.equal(concept.bindings, undefined, id);
    assert.equal(isInspectionElementConceptId(id), false, id);
  }
  assert.equal(isInspectionElementConceptId(EXTERNAL_WALL_CONCEPT), true);
  assert.equal(getOntologyConcept('building_element.roof'), undefined);
  assert.equal(getOntologyConcept('building_element.external_door'), undefined);
  assert.equal(getOntologyConcept('building_element.conservatory'), undefined);
  assert.equal(getOntologyConcept('building_element.joinery'), undefined);
});

test('Engine finding upsert rejects type-only External element concepts', () => {
  const rejected = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        id: 'finding.external-chimney.1',
        elementConceptId: 'building_element.chimney',
        observation: 'Flue terminal is cracked.',
      } as unknown as InspectionFinding,
    },
  });
  assert.equal(rejected, null);

  const accepted = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        id: EXTERNAL_WALL_FINDING_ID,
        elementConceptId: EXTERNAL_WALL_CONCEPT,
        observation: 'Stepped cracking above the opening.',
      },
    },
  });
  assert.ok(accepted);
  assert.equal(accepted?.finding?.id, EXTERNAL_WALL_FINDING_ID);
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
  for (const token of ['observe', 'condition', 'defect', 'recommend', 'evidence']) {
    const node = findCommandNode([...WALLS_ROUTE, token]);
    assert.equal(node?.optional, true, token);
    assert.notEqual(node?.required, true, token);
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
