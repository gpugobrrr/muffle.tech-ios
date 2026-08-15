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

test('two findings for the same element project and render deterministically', () => {
  const finding1 = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Front elevation',
    observation: 'Brick spalling at ground level.',
    condition: 'Fair',
    defect: 'Spalling brickwork',
    recommendation: 'Repoint affected areas.',
    evidence: [{ id: 'photo-front-1' }],
  };

  const finding2 = {
    id: 'finding.external-wall.2',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Rear elevation',
    observation: 'Diagonal crack above kitchen lintel.',
    condition: 'Poor',
    defect: 'Structural movement',
    recommendation: 'Consult structural engineer.',
    evidence: [{ id: 'photo-rear-1' }],
  };

  const inspection: ActiveJob['inspection'] = {
    findings: {
      'finding.external-wall.1': finding1,
      'finding.external-wall.2': finding2,
    },
  };

  const job = createJob(inspection);
  const document = buildReportDocument({
    activeJob: job,
    inspectionBrief: createBrief(),
  });

  const findingBlocks = document.blocks.filter(
    (b): b is FindingBlock => b.kind === 'finding',
  );
  assert.equal(findingBlocks.length, 2);
  assert.equal(findingBlocks[0].findingId, 'finding.external-wall.1');
  assert.equal(findingBlocks[0].location, 'Front elevation');
  assert.equal(findingBlocks[0].observation, 'Brick spalling at ground level.');
  assert.equal(findingBlocks[1].findingId, 'finding.external-wall.2');
  assert.equal(findingBlocks[1].location, 'Rear elevation');
  assert.equal(findingBlocks[1].observation, 'Diagonal crack above kitchen lintel.');

  const html = renderReportDocumentHtml(document);
  assert.match(html, /data-finding-id="finding\.external-wall\.1"/);
  assert.match(html, /data-finding-id="finding\.external-wall\.2"/);
  assert.match(html, /<dt>Location<\/dt>\s*<dd>Front elevation<\/dd>/);
  assert.match(html, /<dt>Location<\/dt>\s*<dd>Rear elevation<\/dd>/);

  // Verify Location precedes Observation in HTML output
  const locationIndex = html.indexOf('<dd>Front elevation</dd>');
  const observationIndex = html.indexOf('<dd>Brick spalling at ground level.</dd>');
  assert.ok(locationIndex < observationIndex, 'Location row must appear before Observation row');
});

test('reversed insertion order with multi-digit finding IDs sorts naturally (.2 before .10)', () => {
  const finding2 = {
    id: 'finding.external-wall.2',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Side elevation',
    observation: 'Observation 2',
  };
  const finding10 = {
    id: 'finding.external-wall.10',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Rear elevation',
    observation: 'Observation 10',
  };
  const finding1 = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Front elevation',
    observation: 'Observation 1',
  };

  const recordReversed = {
    findings: {
      'finding.external-wall.10': finding10,
      'finding.external-wall.2': finding2,
      'finding.external-wall.1': finding1,
    },
  };

  const recordNormal = {
    findings: {
      'finding.external-wall.1': finding1,
      'finding.external-wall.2': finding2,
      'finding.external-wall.10': finding10,
    },
  };

  const projectedReversed = projectInspectionFindings(recordReversed);
  const projectedNormal = projectInspectionFindings(recordNormal);

  assert.deepEqual(projectedReversed, projectedNormal);
  assert.equal(projectedReversed[0].findingId, 'finding.external-wall.1');
  assert.equal(projectedReversed[1].findingId, 'finding.external-wall.2');
  assert.equal(projectedReversed[2].findingId, 'finding.external-wall.10');
});

test('location HTML escaping properly sanitizes special characters', () => {
  const findingWithSpecialChars = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as const,
    location: '<script>alert("xss")</script> & \'single\' "double"',
    observation: 'Observation text <safe>.',
  };

  const record = {
    findings: {
      'finding.external-wall.1': findingWithSpecialChars,
    },
  };

  const document = buildReportDocument({
    activeJob: createJob(record),
    inspectionBrief: createBrief(),
  });

  const html = renderReportDocumentHtml(document);
  assert.match(
    html,
    /<dd>&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt; &amp; &#39;single&#39; &quot;double&quot;<\/dd>/,
  );
  assert.equal(html.includes('<script>'), false);
});

test('legacy findings without location omit Location row in rendered HTML', () => {
  const legacyFinding = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as const,
    observation: 'Legacy observation without location.',
    condition: 'Good',
  };

  const whitespaceFinding = {
    id: 'finding.external-wall.2',
    elementConceptId: 'building_element.external_wall' as const,
    location: '   ',
    observation: 'Observation with whitespace location.',
  };

  const record = {
    findings: {
      'finding.external-wall.1': legacyFinding,
      'finding.external-wall.2': whitespaceFinding,
    },
  };

  const document = buildReportDocument({
    activeJob: createJob(record),
    inspectionBrief: createBrief(),
  });

  const findingBlocks = document.blocks.filter(
    (b): b is FindingBlock => b.kind === 'finding',
  );
  assert.equal('location' in findingBlocks[0], false);
  assert.equal('location' in findingBlocks[1], false);

  const html = renderReportDocumentHtml(document);
  assert.equal(html.includes('<dt>Location</dt>'), false);
  assert.equal(html.includes('Location'), false);
});

test('same evidence reference can appear on multiple findings with independent deduplication', () => {
  const finding1 = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Front',
    observation: 'Front wall issue.',
    evidence: [
      { id: 'photo-shared-1' },
      { id: 'photo-front-unique' },
      { id: ' photo-shared-1 ' },
    ],
  };

  const finding2 = {
    id: 'finding.external-wall.2',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Rear',
    observation: 'Rear wall issue.',
    evidence: [
      { id: 'photo-shared-1' },
      { id: 'photo-rear-unique' },
    ],
  };

  const record = {
    findings: {
      'finding.external-wall.1': finding1,
      'finding.external-wall.2': finding2,
    },
  };

  const projected = projectInspectionFindings(record);
  assert.deepEqual(projected[0].evidenceIds, ['photo-shared-1', 'photo-front-unique']);
  assert.deepEqual(projected[1].evidenceIds, ['photo-shared-1', 'photo-rear-unique']);

  const document = buildReportDocument({
    activeJob: createJob(record),
    inspectionBrief: createBrief(),
  });
  const html = renderReportDocumentHtml(document);
  assert.match(html, /<dd>photo-shared-1, photo-front-unique<\/dd>/);
  assert.match(html, /<dd>photo-shared-1, photo-rear-unique<\/dd>/);
});

test('firm adapter preserves canonical IDs and maps headings across multiple same-element findings', () => {
  const finding1 = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Front elevation',
    observation: 'Obs 1',
  };

  const finding2 = {
    id: 'finding.external-wall.2',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Rear elevation',
    observation: 'Obs 2',
  };

  const record = {
    findings: {
      'finding.external-wall.1': finding1,
      'finding.external-wall.2': finding2,
    },
  };

  const document = buildReportDocument({
    activeJob: createJob(record),
    inspectionBrief: createBrief(),
  });

  const adapted = applyFirmAdapter(document, DEMO_FIRM_ADAPTER);
  const adaptedFindings = adapted.blocks.filter(
    (b): b is import('../src/lib/report/firm-adapter').FirmFindingBlock => b.kind === 'finding',
  );

  assert.equal(adaptedFindings.length, 2);
  assert.equal(adaptedFindings[0].sectionHeading, 'Main Walls');
  assert.equal(adaptedFindings[0].elementConceptId, 'building_element.external_wall');
  assert.equal(adaptedFindings[0].location, 'Front elevation');

  assert.equal(adaptedFindings[1].sectionHeading, 'Main Walls');
  assert.equal(adaptedFindings[1].elementConceptId, 'building_element.external_wall');
  assert.equal(adaptedFindings[1].location, 'Rear elevation');

  const html = renderReportDocumentHtml(document, { firmAdapter: DEMO_FIRM_ADAPTER });
  const matches = [...html.matchAll(/<h2 id="finding-[^"]+">([^<]+)<\/h2>/g)].map(m => m[1]);
  assert.deepEqual(matches, ['Main Walls', 'Main Walls']);
});

test('sibling immutability is maintained during mutations and projections', () => {
  const finding1 = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Front elevation',
    observation: 'Original observation 1',
  };

  const finding2 = {
    id: 'finding.external-wall.2',
    elementConceptId: 'building_element.external_wall' as const,
    location: 'Rear elevation',
    observation: 'Original observation 2',
  };

  const initialRecord = {
    findings: {
      'finding.external-wall.1': structuredClone(finding1),
      'finding.external-wall.2': structuredClone(finding2),
    },
  };

  const recordBefore = structuredClone(initialRecord);

  // Update finding 1
  const updatedFinding1 = {
    ...finding1,
    location: 'Updated Front elevation',
    observation: 'Updated observation 1',
    defect: 'New defect',
  };

  const result = executeInspectionOperation(initialRecord, {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: { finding: updatedFinding1 },
  });
  assert.ok(result);

  // Finding 2 is unchanged
  assert.deepEqual(result.inspection.findings['finding.external-wall.2'], finding2);
  assert.equal(result.inspection.findings['finding.external-wall.1'].location, 'Updated Front elevation');
  assert.equal(result.inspection.findings['finding.external-wall.1'].observation, 'Updated observation 1');

  // Input record before mutation was not modified
  assert.deepEqual(initialRecord, recordBefore);
});