import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTROLLED_PRESENCE_STATUSES } from '../src/lib/controlled-fact';
import { findCommandNode } from '../src/lib/command-registry';
import { resolveFieldValue } from '../src/lib/field-schema';
import { commitInspectionFindingField } from '../src/lib/finding-capture';
import { INTERNAL_FINDING_CONFIGS } from '../src/lib/internal-findings';
import { EXTERNAL_FINDING_CONFIGS } from '../src/lib/external-findings';
import { DEMO_OX3_8SE_ADDRESSES } from '../src/lib/fixtures/demo-ox3-8se';
import {
  createInitialActiveJob,
  deserializeActiveJob,
  serializeActiveJob,
  withInspectionBrief,
} from '../src/lib/job-persistence';
import {
  PROPERTY_CONSTRUCTION_FORM_FIELD_ID,
  PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID,
  PROPERTY_CONVERSION_FIELD_ID,
  PROPERTY_EXTENSION_FIELD_ID,
  PROPERTY_TYPE_FIELD_ID,
} from '../src/lib/property-description';
import { MAINS_SERVICE_FIELD_IDS } from '../src/lib/property-energy-mains-services';
import { buildSurveyReport } from '../src/lib/report/build-survey-report';
import {
  capabilityForRoute,
  SURVEY_CAPABILITY_KINDS,
  surveyCapabilityCensus,
} from '../src/lib/survey-capability';
import {
  executeInspectionOperation,
  executeSurveyOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
import type { ActiveJob, InspectionBrief } from '../src/types/workspace';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../src');

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

function writeBrief(
  brief: InspectionBrief,
  operationId: string,
  arguments_: { value?: string; fieldId?: string },
): InspectionBrief {
  return executeSurveyOperation(brief, {
    operationId,
    arguments: arguments_,
  })!.brief;
}

function withInspection(job: ActiveJob, inspection: ActiveJob['inspection']): ActiveJob {
  return { ...job, inspection };
}

test('empty job projects without crashing and invents no findings', () => {
  const job = createInitialActiveJob();
  const report = buildSurveyReport(job);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.identity.jobId, job.id);
  assert.equal(report.identity.displayAddress, '18 Market Street');
  assert.equal(report.identity.address, undefined);
  assert.deepEqual(report.instruction, []);
  assert.deepEqual(report.propertyDescription, []);
  assert.deepEqual(report.propertyEnergy, []);
  assert.deepEqual(report.findings.external, []);
  assert.deepEqual(report.findings.internal, []);
  assert.deepEqual(report.findings.services, []);
  assert.equal(report.summary.findingCount, 0);
  assert.equal(report.summary.evidenceCount, 0);
  assert.deepEqual(report.summary.sectionsWithFindings, []);
});

test('property identity uses the canonical job address without duplication', () => {
  const address = DEMO_OX3_8SE_ADDRESSES[1].address;
  const job: ActiveJob = {
    ...createInitialActiveJob(),
    property: {
      displayAddress: address.formattedAddress,
      address,
    },
  };
  const report = buildSurveyReport(job);
  assert.equal(report.identity.displayAddress, address.formattedAddress);
  assert.equal(report.identity.address?.postalCode, 'OX3 8SE');
  assert.equal(report.identity.address?.subBuildingName, 'Flat 15');
  assert.equal(report.identity.address?.formattedAddress, address.formattedAddress);
});

test('PREP facts project from the canonical brief', () => {
  let brief = emptyBrief();
  brief = writeBrief(brief, SURVEY_OPERATIONS.setInstructionClient, {
    value: 'Jordan Client',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setInstructionReference, {
    value: 'REF-104',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setPurpose, {
    value: 'Level 2 purchase survey',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setDeliverable, {
    value: 'Written report',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setLimitation, {
    value: 'No loft access',
  });
  const report = buildSurveyReport(withInspectionBrief(createInitialActiveJob(), brief));
  const byId = Object.fromEntries(
    report.instruction.map((item) => [item.fieldId, item]),
  );
  assert.equal(byId['instruction.client']?.value, 'Jordan Client');
  assert.equal(byId['instruction.reference']?.value, 'REF-104');
  assert.equal(byId.purpose?.value, 'Level 2 purchase survey');
  assert.equal(byId.deliverable?.value, 'Written report');
  assert.equal(byId.limitation?.value, 'No loft access');
  assert.equal(byId.limitation?.label, 'Limitations');
});

test('property description projects machine values and schema labels', () => {
  let brief = emptyBrief();
  brief = writeBrief(brief, SURVEY_OPERATIONS.setSingleChoice, {
    fieldId: PROPERTY_TYPE_FIELD_ID,
    value: 'semi_detached',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setSingleChoice, {
    fieldId: PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID,
    value: '1945_1964',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setSingleChoice, {
    fieldId: PROPERTY_CONSTRUCTION_FORM_FIELD_ID,
    value: 'timber_frame',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setControlledFact, {
    fieldId: PROPERTY_EXTENSION_FIELD_ID,
    value: 'present',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setControlledFact, {
    fieldId: PROPERTY_CONVERSION_FIELD_ID,
    value: 'not_present',
  });
  const report = buildSurveyReport(withInspectionBrief(createInitialActiveJob(), brief));
  const byId = Object.fromEntries(
    report.propertyDescription.map((item) => [item.fieldId, item]),
  );
  assert.deepEqual(byId[PROPERTY_TYPE_FIELD_ID], {
    fieldId: PROPERTY_TYPE_FIELD_ID,
    label: 'Property type',
    value: 'semi_detached',
    display: 'Semi-detached',
  });
  assert.equal(byId[PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID]?.value, '1945_1964');
  assert.equal(byId[PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID]?.display, '1945–1964');
  assert.deepEqual(byId[PROPERTY_CONSTRUCTION_FORM_FIELD_ID], {
    fieldId: PROPERTY_CONSTRUCTION_FORM_FIELD_ID,
    label: 'Construction form',
    value: 'timber_frame',
    display: 'Timber frame',
  });
  assert.equal(byId[PROPERTY_EXTENSION_FIELD_ID]?.value, 'present');
  assert.equal(byId[PROPERTY_EXTENSION_FIELD_ID]?.display, 'Present');
  assert.equal(byId[PROPERTY_CONVERSION_FIELD_ID]?.value, 'not_present');
  assert.equal(byId[PROPERTY_CONVERSION_FIELD_ID]?.display, 'Not present');
});

test('controlled statuses keep unset, present, not_present, unknown, and not_inspected distinct', () => {
  const projected = CONTROLLED_PRESENCE_STATUSES.map((status) => {
    const brief = writeBrief(emptyBrief(), SURVEY_OPERATIONS.setControlledFact, {
      fieldId: PROPERTY_EXTENSION_FIELD_ID,
      value: status,
    });
    const report = buildSurveyReport(
      withInspectionBrief(createInitialActiveJob(), brief),
    );
    return report.propertyDescription.find(
      (item) => item.fieldId === PROPERTY_EXTENSION_FIELD_ID,
    );
  });
  assert.deepEqual(
    projected.map((item) => item?.value),
    [...CONTROLLED_PRESENCE_STATUSES],
  );
  assert.deepEqual(
    projected.map((item) => item?.display),
    ['Present', 'Not present', 'Unknown', 'Not inspected'],
  );
  const unset = buildSurveyReport(createInitialActiveJob()).propertyDescription.find(
    (item) => item.fieldId === PROPERTY_EXTENSION_FIELD_ID,
  );
  assert.equal(unset, undefined);
});

test('one walls finding projects every captured field from the canonical record', () => {
  const observe = findCommandNode(['external', 'walls', 'observe'])!.findingTarget!;
  const condition = findCommandNode(['external', 'walls', 'condition'])!.findingTarget!;
  const defect = findCommandNode(['external', 'walls', 'defect'])!.findingTarget!;
  const recommend = findCommandNode(['external', 'walls', 'recommend'])!.findingTarget!;
  const limit = findCommandNode(['external', 'walls', 'limit'])!.findingTarget!;
  const further = findCommandNode(['external', 'walls', 'further'])!.findingTarget!;
  const risk = findCommandNode(['external', 'walls', 'risk'])!.findingTarget!;

  let inspection = createInitialActiveJob().inspection;
  for (const [target, value] of [
    [observe, 'Stepped cracking above the opening.'],
    [condition, 'Localised visible movement.'],
    [defect, 'Masonry cracking.'],
    [recommend, 'Obtain structural advice.'],
    [limit, 'Rear elevation not fully visible.'],
    [further, 'Open up the lintel bearing.'],
    [risk, 'Progressive movement may continue.'],
  ] as const) {
    const committed = commitInspectionFindingField(inspection, target, value);
    assert.equal(committed.ok, true);
    if (!committed.ok) return;
    inspection = committed.result.inspection;
  }

  const report = buildSurveyReport(
    withInspection(createInitialActiveJob(), inspection),
  );
  assert.equal(report.findings.external.length, 1);
  const walls = report.findings.external[0];
  assert.equal(walls.findingId, 'finding.external-wall.1');
  assert.equal(walls.elementConceptId, 'building_element.external_wall');
  assert.equal(walls.observation, 'Stepped cracking above the opening.');
  assert.equal(walls.condition, 'Localised visible movement.');
  assert.equal(walls.defect, 'Masonry cracking.');
  assert.equal(walls.recommendation, 'Obtain structural advice.');
  assert.equal(walls.limitation, 'Rear elevation not fully visible.');
  assert.equal(walls.furtherInvestigation, 'Open up the lintel bearing.');
  assert.equal(walls.risk, 'Progressive movement may continue.');
  assert.equal(report.summary.findingCount, 1);
  assert.equal(report.summary.defectCount, 1);
  assert.equal(report.summary.recommendationCount, 1);
  assert.equal(report.summary.riskCount, 1);
  assert.deepEqual(report.summary.sectionsWithFindings, ['external']);
});

test('chimney and ceiling findings group without leakage or duplicates', () => {
  let inspection = createInitialActiveJob().inspection;
  const wall = commitInspectionFindingField(
    inspection,
    findCommandNode(['external', 'walls', 'observe'])!.findingTarget!,
    'Wall observation.',
  );
  assert.equal(wall.ok, true);
  if (!wall.ok) return;
  const chimney = commitInspectionFindingField(
    wall.result.inspection,
    findCommandNode(['external', 'chimney', 'observe'])!.findingTarget!,
    'Chimney observation.',
  );
  assert.equal(chimney.ok, true);
  if (!chimney.ok) return;
  const ceiling = commitInspectionFindingField(
    chimney.result.inspection,
    findCommandNode(['internal', 'ceilings', 'observe'])!.findingTarget!,
    'Ceiling observation.',
  );
  assert.equal(ceiling.ok, true);
  if (!ceiling.ok) return;

  const report = buildSurveyReport(
    withInspection(createInitialActiveJob(), ceiling.result.inspection),
  );
  assert.deepEqual(
    report.findings.external.map((finding) => finding.findingId),
    ['finding.external-wall.1', 'finding.chimney.1'],
  );
  assert.deepEqual(
    report.findings.internal.map((finding) => finding.findingId),
    ['finding.ceiling.1'],
  );
  assert.deepEqual(report.findings.services, []);
  assert.equal(
    report.findings.external.find((finding) => finding.findingId === 'finding.chimney.1')
      ?.observation,
    'Chimney observation.',
  );
  assert.equal(
    report.findings.internal[0]?.observation,
    'Ceiling observation.',
  );
  assert.equal(report.summary.findingCount, 3);
  assert.deepEqual(report.summary.sectionsWithFindings, ['external', 'internal']);
});

test('activated Internal findings project into findings.internal without a subject mapper', () => {
  let inspection = createInitialActiveJob().inspection;
  for (const config of INTERNAL_FINDING_CONFIGS) {
    const observed = commitInspectionFindingField(
      inspection,
      findCommandNode([...config.route, 'observe'])!.findingTarget!,
      `${config.label} observation.`,
    );
    assert.equal(observed.ok, true, config.routeId);
    if (!observed.ok) return;
    inspection = observed.result.inspection;
  }
  const report = buildSurveyReport(
    withInspection(createInitialActiveJob(), inspection),
  );
  assert.deepEqual(
    report.findings.internal.map((finding) => finding.findingId),
    INTERNAL_FINDING_CONFIGS.map((config) => config.findingId),
  );
  assert.deepEqual(report.findings.external, []);
});

test('activated External findings project into findings.external without a subject mapper', () => {
  let inspection = createInitialActiveJob().inspection;
  for (const config of EXTERNAL_FINDING_CONFIGS) {
    const observed = commitInspectionFindingField(
      inspection,
      findCommandNode([...config.route, 'observe'])!.findingTarget!,
      `${config.label} observation.`,
    );
    assert.equal(observed.ok, true, config.routeId);
    if (!observed.ok) return;
    inspection = observed.result.inspection;
  }
  const report = buildSurveyReport(
    withInspection(createInitialActiveJob(), inspection),
  );
  assert.deepEqual(
    report.findings.external.map((finding) => finding.findingId),
    EXTERNAL_FINDING_CONFIGS.map((config) => config.findingId),
  );
  assert.ok(
    report.findings.external.some(
      (finding) => finding.findingId === 'finding.roof-covering.1',
    ),
  );
  assert.ok(
    report.findings.external.some(
      (finding) => finding.findingId === 'finding.external-door.1',
    ),
  );
  assert.deepEqual(report.findings.internal, []);
});

test('services findings stay distinct from property mains-service facts', () => {
  const brief = writeBrief(emptyBrief(), SURVEY_OPERATIONS.setControlledFact, {
    fieldId: MAINS_SERVICE_FIELD_IDS.gas,
    value: 'present',
  });
  const electricity = commitInspectionFindingField(
    createInitialActiveJob().inspection,
    findCommandNode(['services', 'electricity', 'observe'])!.findingTarget!,
    'Consumer unit appears dated.',
  );
  assert.equal(electricity.ok, true);
  if (!electricity.ok) return;

  const report = buildSurveyReport(
    withInspection(
      withInspectionBrief(createInitialActiveJob(), brief),
      electricity.result.inspection,
    ),
  );
  assert.equal(
    report.propertyEnergy.find((item) => item.fieldId === MAINS_SERVICE_FIELD_IDS.gas)
      ?.value,
    'present',
  );
  assert.equal(report.findings.services.length, 1);
  assert.equal(
    report.findings.services[0]?.findingId,
    'finding.service.electrical_installation.1',
  );
  assert.equal(
    report.propertyEnergy.some((item) =>
      item.fieldId.includes('electrical_installation'),
    ),
    false,
  );
  assert.equal(resolveFieldValue(brief, MAINS_SERVICE_FIELD_IDS.gas), 'present');
});

test('evidence associations project by ID without embedding bytes', () => {
  const observed = commitInspectionFindingField(
    createInitialActiveJob().inspection,
    findCommandNode(['external', 'walls', 'observe'])!.findingTarget!,
    'Wall observation.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  let inspection = observed.result.inspection;
  for (const evidence of [
    { id: 'evidence.photo.wall-a', uri: 'file:///persistent/wall-a.jpg' },
    { id: 'evidence.photo.wall-b', uri: 'file:///persistent/wall-b.jpg' },
  ]) {
    const added = executeInspectionOperation(inspection, {
      operationId: SURVEY_OPERATIONS.addInspectionEvidence,
      arguments: {
        findingId: 'finding.external-wall.1',
        evidence: { id: evidence.id, kind: 'photo', uri: evidence.uri },
      },
    });
    assert.ok(added);
    inspection = added.inspection;
  }

  const chimney = commitInspectionFindingField(
    inspection,
    findCommandNode(['external', 'chimney', 'observe'])!.findingTarget!,
    'Chimney observation.',
  );
  assert.equal(chimney.ok, true);
  if (!chimney.ok) return;

  const report = buildSurveyReport(
    withInspection(createInitialActiveJob(), chimney.result.inspection),
  );
  const walls = report.findings.external.find(
    (finding) => finding.findingId === 'finding.external-wall.1',
  );
  const chimneyFinding = report.findings.external.find(
    (finding) => finding.findingId === 'finding.chimney.1',
  );
  assert.deepEqual(walls?.evidenceIds, [
    'evidence.photo.wall-a',
    'evidence.photo.wall-b',
  ]);
  assert.equal(walls?.evidence.length, 2);
  assert.equal(walls?.evidence[0]?.kind, 'photo');
  assert.equal(walls?.evidence[0]?.uri, 'file:///persistent/wall-a.jpg');
  assert.deepEqual(chimneyFinding?.evidenceIds, undefined);
  assert.equal(chimneyFinding?.evidence.length, 0);
  assert.equal(report.summary.evidenceCount, 2);
  assert.equal(JSON.stringify(report).includes('data:image'), false);
  assert.equal(JSON.stringify(report).includes('base64'), false);
});

test('missing evidence registry entries do not crash projection', () => {
  const observed = commitInspectionFindingField(
    createInitialActiveJob().inspection,
    findCommandNode(['external', 'walls', 'observe'])!.findingTarget!,
    'Wall observation.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  const linked = commitInspectionFindingField(
    observed.result.inspection,
    findCommandNode(['external', 'walls', 'evidence'])!.findingTarget!,
    'evidence.photo.missing',
  );
  assert.equal(linked.ok, true);
  if (!linked.ok) return;
  const report = buildSurveyReport(
    withInspection(createInitialActiveJob(), linked.result.inspection),
  );
  assert.equal(report.findings.external[0]?.evidence[0]?.id, 'evidence.photo.missing');
  assert.equal(report.findings.external[0]?.evidence[0]?.uri, undefined);
});

test('projection is deterministic and does not mutate ActiveJob', () => {
  let brief = writeBrief(emptyBrief(), SURVEY_OPERATIONS.setSingleChoice, {
    fieldId: PROPERTY_TYPE_FIELD_ID,
    value: 'semi_detached',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setInstructionClient, {
    value: 'Jordan Client',
  });
  const observed = commitInspectionFindingField(
    createInitialActiveJob().inspection,
    findCommandNode(['external', 'walls', 'observe'])!.findingTarget!,
    'Wall observation.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  const job = withInspection(
    withInspectionBrief(createInitialActiveJob(), brief),
    observed.result.inspection,
  );
  const before = structuredClone(job);
  const first = buildSurveyReport(job);
  const second = buildSurveyReport(job);
  assert.deepEqual(first, second);
  assert.deepEqual(job, before);
  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.ok(restored);
  assert.deepEqual(buildSurveyReport(restored), first);
});

test('summary counts ignore nonexistent findings', () => {
  const observed = commitInspectionFindingField(
    createInitialActiveJob().inspection,
    findCommandNode(['external', 'walls', 'observe'])!.findingTarget!,
    'Observation only.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  const report = buildSurveyReport(
    withInspection(createInitialActiveJob(), observed.result.inspection),
  );
  assert.equal(report.summary.findingCount, 1);
  assert.equal(report.summary.defectCount, 0);
  assert.equal(report.summary.recommendationCount, 0);
  assert.equal(report.summary.riskCount, 0);
});

test('summary and report remain derived and unclassified stays 0', () => {
  assert.equal(capabilityForRoute('summary')?.kind, SURVEY_CAPABILITY_KINDS.derived);
  assert.equal(capabilityForRoute('report')?.kind, SURVEY_CAPABILITY_KINDS.derived);
  const census = surveyCapabilityCensus();
  assert.equal(census.unclassified, 0);
  assert.equal(census.capture, 128);
  assert.equal(census.derived, 2);
  assert.equal(census.blocked, 26);
});

test('SVYR derived routes consume the survey report projection without a report store', () => {
  const ui = readFileSync(join(SRC_ROOT, 'components/svyr-interface.tsx'), 'utf8');
  assert.match(ui, /DerivedSurveyView/);
  assert.match(ui, /buildSurveyReport/);
  assert.equal(ui.includes('ActiveJob.report'), false);
  const workspace = readFileSync(join(SRC_ROOT, 'types/workspace.ts'), 'utf8');
  assert.equal(workspace.includes('report?:'), false);
  const persistence = readFileSync(join(SRC_ROOT, 'lib/job-persistence.ts'), 'utf8');
  assert.equal(persistence.includes('report'), false);
});
