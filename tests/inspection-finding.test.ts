import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_EXTERNAL_WALL_FINDING } from '../src/lib/fixtures/demo-external-wall-finding';
import { DEMO_OX3_8SE_ADDRESSES } from '../src/lib/fixtures/demo-ox3-8se';
import {
  allocateFindingId,
  allocateNextFindingId,
  compareFindingIds,
  listFindingsForElement,
  sortFindingIds,
  sortFindings,
} from '../src/lib/inspection-findings';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import { buildReportDocument } from '../src/lib/report/build-report-document';
import {
  applyFirmAdapter,
  DEMO_FIRM_ADAPTER,
  resolveFirmTerm,
} from '../src/lib/report/firm-adapter';
import { projectInspectionFindings } from '../src/lib/report/project-inspection-findings';
import { renderReportDocumentHtml } from '../src/lib/report/render-report-html';
import {
  executeInspectionOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
import type { SvyrNotesByPath } from '../src/lib/svyr-notes';
import type { FindingBlock } from '../src/types/report';
import type {
  ActiveJob,
  InspectionBrief,
} from '../src/types/workspace';

function createBrief(): InspectionBrief {
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

function createJob(
  inspection: ActiveJob['inspection'],
): ActiveJob {
  const address = DEMO_OX3_8SE_ADDRESSES[1].address;
  return {
    property: {
      displayAddress: address.formattedAddress,
      address,
    },
    inspection,
  };
}

function findingFrom(job: ActiveJob): FindingBlock {
  const document = buildReportDocument({
    activeJob: job,
    inspectionBrief: createBrief(),
  });
  const finding = document.blocks.find(
    (block): block is FindingBlock => block.kind === 'finding',
  );
  assert.ok(finding);
  return finding;
}

test('canonical external-wall finding upserts and reads deterministically', () => {
  const initial = createEmptyInspectionRecord();
  const created = executeInspectionOperation(initial, {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: { finding: DEMO_EXTERNAL_WALL_FINDING },
  });
  assert.ok(created);
  assert.equal(
    created.finding.elementConceptId,
    'building_element.external_wall',
  );
  assert.equal(created.finding.observation, DEMO_EXTERNAL_WALL_FINDING.observation);
  assert.equal(created.finding.condition, DEMO_EXTERNAL_WALL_FINDING.condition);
  assert.equal(created.finding.defect, DEMO_EXTERNAL_WALL_FINDING.defect);
  assert.equal(
    created.finding.recommendation,
    DEMO_EXTERNAL_WALL_FINDING.recommendation,
  );
  assert.deepEqual(created.finding.evidence, [{ id: 'photo-001' }]);

  const read = executeInspectionOperation(created.inspection, {
    operationId: SURVEY_OPERATIONS.readInspectionFinding,
    arguments: { findingId: DEMO_EXTERNAL_WALL_FINDING.id },
  });
  assert.ok(read);
  assert.deepEqual(read.finding, created.finding);
  assert.equal(read.inspection, created.inspection);
});

test('editing a stable finding ID replaces content without duplication', () => {
  const created = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: { finding: DEMO_EXTERNAL_WALL_FINDING },
  });
  assert.ok(created);

  const updated = executeInspectionOperation(created.inspection, {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        ...DEMO_EXTERNAL_WALL_FINDING,
        observation: 'Cracking has widened above the rear opening.',
      },
    },
  });
  assert.ok(updated);
  assert.equal(Object.keys(updated.inspection.findings).length, 1);
  assert.equal(
    findingFrom(createJob(updated.inspection)).observation,
    'Cracking has widened above the rear opening.',
  );
});

test('notes are neither canonical finding content nor evidence', () => {
  const notes: SvyrNotesByPath = {
    'inspection/external-wall': 'Private drafting note.',
  };
  const created = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: { finding: DEMO_EXTERNAL_WALL_FINDING },
  });
  assert.ok(created);

  const document = buildReportDocument({
    activeJob: createJob(created.inspection),
    inspectionBrief: createBrief(),
  });
  assert.equal(JSON.stringify(document).includes(notes['inspection/external-wall']), false);
  assert.equal(created.finding.observation, DEMO_EXTERNAL_WALL_FINDING.observation);
  assert.deepEqual(created.finding.evidence, [{ id: 'photo-001' }]);
});

test('report projection and firm adapter preserve canonical semantics', () => {
  const created = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: { finding: DEMO_EXTERNAL_WALL_FINDING },
  });
  assert.ok(created);
  const document = buildReportDocument({
    activeJob: createJob(created.inspection),
    inspectionBrief: createBrief(),
  });
  const finding = findingFrom(createJob(created.inspection));

  assert.equal(finding.elementLabel, 'External wall');
  assert.equal(finding.observation, DEMO_EXTERNAL_WALL_FINDING.observation);
  assert.equal(finding.defect, DEMO_EXTERNAL_WALL_FINDING.defect);
  assert.equal(finding.recommendation, DEMO_EXTERNAL_WALL_FINDING.recommendation);
  assert.deepEqual(finding.evidenceIds, ['photo-001']);
  assert.equal(
    resolveFirmTerm(DEMO_FIRM_ADAPTER, 'Main Walls'),
    'building_element.external_wall',
  );

  const adapted = applyFirmAdapter(document, DEMO_FIRM_ADAPTER);
  const presented = adapted.blocks.find((block) => block.kind === 'finding');
  assert.ok(presented);
  assert.equal(presented.sectionHeading, 'Main Walls');
  assert.equal(
    presented.elementConceptId,
    'building_element.external_wall',
  );

  const html = renderReportDocumentHtml(document, {
    firmAdapter: DEMO_FIRM_ADAPTER,
  });
  assert.match(html, />Main Walls</);
  assert.match(
    html,
    /data-element-concept-id="building_element\.external_wall"/,
  );
});

test('canonical input and adapter versions produce deterministic output', () => {
  const created = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: { finding: DEMO_EXTERNAL_WALL_FINDING },
  });
  assert.ok(created);
  const input = {
    activeJob: createJob(created.inspection),
    inspectionBrief: createBrief(),
  };
  const before = structuredClone(input);

  const project = () => {
    const report = buildReportDocument(input);
    return {
      adapterVersion: DEMO_FIRM_ADAPTER.version,
      report: applyFirmAdapter(report, DEMO_FIRM_ADAPTER),
    };
  };

  assert.deepEqual(project(), project());
  assert.deepEqual(input, before);
});

test('projectInspectionFindings behaves correctly and deterministically for multiple subjects', () => {
  const finding1 = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as const,
    observation: 'External wall observation text.',
    condition: '   ',
    defect: 'Masonry defect.',
    evidence: [
      { id: ' photo-001 ' },
      { id: 'photo-001' },
      { id: '   ' },
    ],
  };

  const finding2 = {
    id: 'finding.electrical.1',
    elementConceptId: 'service_system.electrical_installation' as const,
    observation: 'Electrical installation observation text.',
    condition: 'Satisfactory',
    defect: '  ',
    recommendation: 'None.',
    evidence: [],
  };

  const recordA = {
    findings: {
      'finding.external-wall.1': finding1,
      'finding.electrical.1': finding2,
    },
  };

  const recordB = {
    findings: {
      'finding.electrical.1': finding2,
      'finding.external-wall.1': finding1,
    },
  };

  const recordAClone = structuredClone(recordA);
  const recordBClone = structuredClone(recordB);

  const resultA = projectInspectionFindings(recordA);
  const resultB = projectInspectionFindings(recordB);

  // Prove input record is not mutated
  assert.deepEqual(recordA, recordAClone);
  assert.deepEqual(recordB, recordBClone);

  // Prove deterministic output (reversed insertion order produces same output, sorted by finding ID)
  assert.deepEqual(resultA, resultB);
  assert.equal(resultA.length, 2);

  const electricalFinding = resultA[0];
  const externalWallFinding = resultA[1];

  // Prove both subjects project through the same helper
  assert.equal(electricalFinding.findingId, 'finding.electrical.1');
  assert.equal(externalWallFinding.findingId, 'finding.external-wall.1');

  // Prove neutral labels are correct
  assert.equal(electricalFinding.elementLabel, 'Electrical installation');
  assert.equal(externalWallFinding.elementLabel, 'External wall');

  // Prove optional whitespace-only fields remain omitted according to existing semantics
  assert.equal('condition' in externalWallFinding, false);
  assert.equal('recommendation' in externalWallFinding, false);
  assert.equal(externalWallFinding.defect, 'Masonry defect.');

  assert.equal(electricalFinding.condition, 'Satisfactory');
  assert.equal('defect' in electricalFinding, false);

  // Prove evidence IDs are trimmed and deduplicated
  assert.deepEqual(externalWallFinding.evidenceIds, ['photo-001']);
  assert.equal('evidenceIds' in electricalFinding, false);
});

test('multiple findings for the same inspection element coexist independently in ID-keyed record', () => {
  const initial = createEmptyInspectionRecord();

  const finding1 = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Front elevation',
    observation: 'Spalling brickwork at ground level.',
    defect: 'Spalling brickwork',
    evidence: [{ id: 'photo-front-1' }],
  };

  const finding2 = {
    id: 'finding.external-wall.2',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Rear elevation above kitchen',
    observation: 'Diagonal crack above the kitchen window lintel.',
    defect: 'Structural crack',
    evidence: [{ id: 'photo-rear-1' }],
  };

  const step1 = executeInspectionOperation(initial, {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: { finding: finding1 },
  });
  assert.ok(step1);

  const step2 = executeInspectionOperation(step1.inspection, {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: { finding: finding2 },
  });
  assert.ok(step2);

  // Both findings coexist as keyed entries in the record
  assert.equal(Object.keys(step2.inspection.findings).length, 2);
  assert.deepEqual(step2.inspection.findings['finding.external-wall.1'], finding1);
  assert.deepEqual(step2.inspection.findings['finding.external-wall.2'], finding2);

  // listFindingsForElement returns both in order
  const elementFindings = listFindingsForElement(
    step2.inspection,
    'building_element.external_wall',
  );
  assert.equal(elementFindings.length, 2);
  assert.equal(elementFindings[0].id, 'finding.external-wall.1');
  assert.equal(elementFindings[0].location, 'Front elevation');
  assert.equal(elementFindings[1].id, 'finding.external-wall.2');
  assert.equal(elementFindings[1].location, 'Rear elevation above kitchen');
});

test('editing one finding does not mutate or overwrite its sibling', () => {
  const finding1 = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Front elevation',
    observation: 'Spalling brickwork at ground level.',
    defect: 'Spalling brickwork',
  };

  const finding2 = {
    id: 'finding.external-wall.2',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Rear elevation',
    observation: 'Diagonal crack above window.',
    defect: 'Structural crack',
  };

  const initialRecord = {
    findings: {
      'finding.external-wall.1': finding1,
      'finding.external-wall.2': finding2,
    },
  };

  // Edit finding 1
  const updated = executeInspectionOperation(initialRecord, {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        ...finding1,
        observation: 'Spalling brickwork has been repointed in areas.',
        condition: 'Fair',
      },
    },
  });
  assert.ok(updated);

  // Finding 1 is updated
  assert.equal(
    updated.inspection.findings['finding.external-wall.1'].observation,
    'Spalling brickwork has been repointed in areas.',
  );
  assert.equal(
    updated.inspection.findings['finding.external-wall.1'].condition,
    'Fair',
  );

  // Finding 2 remains identical to before
  assert.deepEqual(
    updated.inspection.findings['finding.external-wall.2'],
    finding2,
  );
});

test('ID allocation preserves .1 for first finding and handles index gaps correctly', () => {
  const empty = createEmptyInspectionRecord();

  // Preserves .1 on empty record when given base finding ID
  const firstId = allocateFindingId(empty, 'finding.external-wall.1');
  assert.equal(firstId, 'finding.external-wall.1');
  assert.equal(allocateNextFindingId(empty, 'finding.external-wall.1'), 'finding.external-wall.1');

  // Increments to .2 when .1 exists
  const withOne = {
    findings: {
      'finding.external-wall.1': {
        id: 'finding.external-wall.1',
        elementConceptId: 'building_element.external_wall' as const,
        observation: 'Obs 1',
      },
    },
  };
  assert.equal(allocateFindingId(withOne, 'finding.external-wall.1'), 'finding.external-wall.2');

  // Fills gap: .1 and .3 exist -> allocates .2
  const withGap = {
    findings: {
      'finding.external-wall.1': {
        id: 'finding.external-wall.1',
        elementConceptId: 'building_element.external_wall' as const,
        observation: 'Obs 1',
      },
      'finding.external-wall.3': {
        id: 'finding.external-wall.3',
        elementConceptId: 'building_element.external_wall' as const,
        observation: 'Obs 3',
      },
    },
  };
  assert.equal(allocateFindingId(withGap, 'finding.external-wall.1'), 'finding.external-wall.2');

  // Fills gap at start: .2 exists without .1 -> allocates .1
  const missingOne = {
    findings: {
      'finding.external-wall.2': {
        id: 'finding.external-wall.2',
        elementConceptId: 'building_element.external_wall' as const,
        observation: 'Obs 2',
      },
    },
  };
  assert.equal(allocateFindingId(missingOne, 'finding.external-wall.1'), 'finding.external-wall.1');

  // Multiple elements allocate independently using their configured base IDs
  const withServices = {
    findings: {
      'finding.external-wall.1': {
        id: 'finding.external-wall.1',
        elementConceptId: 'building_element.external_wall' as const,
        observation: 'Wall obs',
      },
      'finding.service.electrical_installation.1': {
        id: 'finding.service.electrical_installation.1',
        elementConceptId: 'service_system.electrical_installation' as const,
        observation: 'Electrical obs',
      },
    },
  };
  assert.equal(
    allocateFindingId(withServices, 'finding.service.electrical_installation.1'),
    'finding.service.electrical_installation.2',
  );
  assert.equal(
    allocateFindingId(withServices, 'finding.service.water_supply.1'),
    'finding.service.water_supply.1',
  );
});

test('numbered finding IDs sort naturally so .2 precedes .10', () => {
  const unsortedIds = [
    'finding.external-wall.10',
    'finding.external-wall.2',
    'finding.external-wall.1',
    'finding.external-wall.20',
    'finding.external-wall.3',
  ];

  const sortedIds = sortFindingIds(unsortedIds);
  assert.deepEqual(sortedIds, [
    'finding.external-wall.1',
    'finding.external-wall.2',
    'finding.external-wall.3',
    'finding.external-wall.10',
    'finding.external-wall.20',
  ]);

  assert.ok(compareFindingIds('finding.external-wall.2', 'finding.external-wall.10') < 0);
  assert.ok(compareFindingIds('finding.external-wall.10', 'finding.external-wall.2') > 0);

  const findingsList = [
    { id: 'finding.external-wall.10', elementConceptId: 'building_element.external_wall' as const, observation: 'Obs 10' },
    { id: 'finding.external-wall.2', elementConceptId: 'building_element.external_wall' as const, observation: 'Obs 2' },
  ];
  const sortedFindings = sortFindings(findingsList);
  assert.equal(sortedFindings[0].id, 'finding.external-wall.2');
  assert.equal(sortedFindings[1].id, 'finding.external-wall.10');

  const inspection = {
    findings: {
      'finding.external-wall.10': findingsList[0],
      'finding.external-wall.2': findingsList[1],
    },
  };
  const listed = listFindingsForElement(inspection, 'building_element.external_wall');
  assert.equal(listed[0].id, 'finding.external-wall.2');
  assert.equal(listed[1].id, 'finding.external-wall.10');
});

test('location normalizes centrally and omits blank or whitespace-only locations', () => {
  const initial = createEmptyInspectionRecord();

  // Trimmed location is preserved
  const valid = executeInspectionOperation(initial, {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        id: 'finding.external-wall.1',
        elementConceptId: 'building_element.external_wall',
        location: '  Rear elevation at ground level  ',
        observation: 'Minor weathering.',
      },
    },
  });
  assert.ok(valid);
  assert.equal(valid.finding.location, 'Rear elevation at ground level');

  // Whitespace-only location is omitted
  const whitespaceLocation = executeInspectionOperation(initial, {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        id: 'finding.external-wall.1',
        elementConceptId: 'building_element.external_wall',
        location: '    ',
        observation: 'Minor weathering.',
      },
    },
  });
  assert.ok(whitespaceLocation);
  assert.equal('location' in whitespaceLocation.finding, false);
  assert.equal(whitespaceLocation.finding.location, undefined);

  // Empty string location is omitted
  const emptyLocation = executeInspectionOperation(initial, {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        id: 'finding.external-wall.1',
        elementConceptId: 'building_element.external_wall',
        location: '',
        observation: 'Minor weathering.',
      },
    },
  });
  assert.ok(emptyLocation);
  assert.equal('location' in emptyLocation.finding, false);
  assert.equal(emptyLocation.finding.location, undefined);
});

test('legacy findings without location remain unchanged and fully compatible', () => {
  const initial = createEmptyInspectionRecord();

  // Legacy finding without location property
  const legacyFinding = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as const,
    observation: 'Original legacy observation.',
    condition: 'Satisfactory',
  };

  const result = executeInspectionOperation(initial, {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: { finding: legacyFinding },
  });
  assert.ok(result);
  assert.equal('location' in result.finding, false);
  assert.equal(result.finding.observation, 'Original legacy observation.');
  assert.equal(result.finding.condition, 'Satisfactory');

  // Read operation continues to return exact record
  const read = executeInspectionOperation(result.inspection, {
    operationId: SURVEY_OPERATIONS.readInspectionFinding,
    arguments: { findingId: 'finding.external-wall.1' },
  });
  assert.ok(read);
  assert.deepEqual(read.finding, result.finding);
});