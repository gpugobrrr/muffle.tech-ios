import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_EXTERNAL_WALL_FINDING } from '../src/lib/fixtures/demo-external-wall-finding';
import { DEMO_OX3_8SE_ADDRESSES } from '../src/lib/fixtures/demo-ox3-8se';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import { buildReportDocument } from '../src/lib/report/build-report-document';
import { projectInspectionFindings } from '../src/lib/report/project-inspection-findings';
import {
  applyFirmAdapter,
  DEMO_FIRM_ADAPTER,
  resolveFirmTerm,
} from '../src/lib/report/firm-adapter';
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
