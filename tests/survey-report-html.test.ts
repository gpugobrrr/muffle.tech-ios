import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findCommandNode } from '../src/lib/command-registry';
import { applyFieldValue } from '../src/lib/field-schema';
import { commitInspectionFindingField } from '../src/lib/finding-capture';
import { DEMO_OX3_8SE_ADDRESSES } from '../src/lib/fixtures/demo-ox3-8se';
import { EXTERNAL_FINDING_CONFIGS } from '../src/lib/external-findings';
import {
  createInitialActiveJob,
  deserializeActiveJob,
  serializeActiveJob,
  withInspectionBrief,
} from '../src/lib/job-persistence';
import {
  PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID,
  PROPERTY_TYPE_FIELD_ID,
} from '../src/lib/property-description';
import { MAINS_SERVICE_FIELD_IDS } from '../src/lib/property-energy-mains-services';
import { SECTION_LIMITATION_FIELD_IDS } from '../src/lib/section-limitations';
import { buildReportDocument } from '../src/lib/report/build-report-document';
import { buildSurveyReport } from '../src/lib/report/build-survey-report';
import {
  applyFirmAdapter,
  DEMO_FIRM_ADAPTER,
} from '../src/lib/report/firm-adapter';
import { projectSurveyReportDocument } from '../src/lib/report/project-survey-report-document';
import { renderReportDocumentHtml } from '../src/lib/report/render-report-html';
import {
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

function jobWithAddress(address = DEMO_OX3_8SE_ADDRESSES[1].address): ActiveJob {
  return {
    id: 'job.test.report-html',
    property: {
      displayAddress: address.formattedAddress,
      address,
    },
    inspection: createInitialActiveJob().inspection,
    brief: emptyBrief(),
  };
}

function writeBrief(
  brief: InspectionBrief,
  operationId: string,
  arguments_: { value?: string; fieldId?: string },
): InspectionBrief {
  const result = executeSurveyOperation(brief, {
    operationId,
    arguments: arguments_,
  });
  assert.ok(result, operationId);
  return result!.brief;
}

function reportHtml(job: ActiveJob): string {
  const brief = job.brief ?? emptyBrief();
  const document = buildReportDocument({ activeJob: job, inspectionBrief: brief });
  return renderReportDocumentHtml(document);
}

test('identical ActiveJob produces identical SurveyReportModel and HTML', () => {
  const job = jobWithAddress();
  const firstReport = buildSurveyReport(job);
  const secondReport = buildSurveyReport(job);
  assert.deepEqual(firstReport, secondReport);
  assert.equal(reportHtml(job), reportHtml(job));
});

test('HTML projection uses buildSurveyReport rather than a second ActiveJob mapper', () => {
  const job = jobWithAddress();
  const surveyReport = buildSurveyReport(job);
  const fromSurvey = projectSurveyReportDocument(surveyReport);
  const fromBuilder = buildReportDocument({
    activeJob: job,
    inspectionBrief: job.brief ?? emptyBrief(),
  });
  assert.deepEqual(fromBuilder, fromSurvey);
});

test('identity and instruction facts project into HTML', () => {
  let brief = writeBrief(emptyBrief(), SURVEY_OPERATIONS.setInstructingParty, {
    value: 'Example Chartered Surveyors',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setPurpose, {
    value: 'Pre-purchase survey',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setLimitation, {
    value: 'Loft not accessed.',
  });
  const job = withInspectionBrief(jobWithAddress(), brief);
  const html = reportHtml(job);

  assert.match(html, /Flat 15/);
  assert.match(html, /Example Chartered Surveyors/);
  assert.match(html, /Pre-purchase survey/);
  assert.match(html, /Loft not accessed\./);
});

test('property description and energy facts project into HTML', () => {
  let brief = emptyBrief();
  brief = writeBrief(brief, SURVEY_OPERATIONS.setSingleChoice, {
    fieldId: PROPERTY_TYPE_FIELD_ID,
    value: 'semi_detached',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setSingleChoice, {
    fieldId: PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID,
    value: '1945_1964',
  });
  brief = writeBrief(brief, SURVEY_OPERATIONS.setControlledFact, {
    fieldId: MAINS_SERVICE_FIELD_IDS.gas,
    value: 'present',
  });
  const job = withInspectionBrief(jobWithAddress(), brief);
  const html = reportHtml(job);

  assert.match(html, /Property description/);
  assert.match(html, /Semi-detached/);
  assert.match(html, /Property energy/);
  assert.match(html, /Gas/);
});

test('External, Internal, and Services findings project in deterministic order', () => {
  let inspection = createInitialActiveJob().inspection;
  const externalWall = commitInspectionFindingField(
    inspection,
    findCommandNode(['external', 'walls', 'observe'])!.findingTarget!,
    'Wall observation.',
  );
  assert.equal(externalWall.ok, true);
  if (!externalWall.ok) return;
  const chimney = commitInspectionFindingField(
    externalWall.result.inspection,
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
  const electricity = commitInspectionFindingField(
    ceiling.result.inspection,
    findCommandNode(['services', 'electricity', 'observe'])!.findingTarget!,
    'Consumer unit appears dated.',
  );
  assert.equal(electricity.ok, true);
  if (!electricity.ok) return;

  const job = withInspectionBrief(
    { ...jobWithAddress(), inspection: electricity.result.inspection },
    emptyBrief(),
  );
  const document = projectSurveyReportDocument(buildSurveyReport(job));
  const findingIds = document.blocks
    .filter((block) => block.kind === 'finding')
    .map((block) => block.findingId);
  assert.deepEqual(findingIds, [
    'finding.external-wall.1',
    'finding.chimney.1',
    'finding.ceiling.1',
    'finding.service.electrical_installation.1',
  ]);

  const html = renderReportDocumentHtml(document);
  assert.match(html, /External findings/);
  assert.match(html, /Internal findings/);
  assert.match(html, /Services findings/);
  assert.ok(html.indexOf('Wall observation.') < html.indexOf('Chimney observation.'));
  assert.ok(html.indexOf('Chimney observation.') < html.indexOf('Ceiling observation.'));
  assert.ok(
    html.indexOf('Ceiling observation.') <
      html.indexOf('Consumer unit appears dated.'),
  );
});

test('section limitations project before findings and stay distinct from PREP and finding limitations', () => {
  let brief = writeBrief(emptyBrief(), SURVEY_OPERATIONS.setLimitation, {
    value: 'Brief-wide PREP limitation.',
  });
  brief = applyFieldValue(
    brief,
    SECTION_LIMITATION_FIELD_IDS.external,
    'Rear elevation obscured by vegetation.',
  );
  brief = applyFieldValue(
    brief,
    SECTION_LIMITATION_FIELD_IDS.internal,
    'Loft hatch sealed; no roof-space access.',
  );
  brief = applyFieldValue(
    brief,
    SECTION_LIMITATION_FIELD_IDS.services,
    'Gas meter cupboard locked; no supply test.',
  );

  let inspection = createInitialActiveJob().inspection;
  const porch = EXTERNAL_FINDING_CONFIGS.find((config) => config.routeId === 'porch')!;
  const porchObserved = commitInspectionFindingField(
    inspection,
    findCommandNode([...porch.route, 'observe'])!.findingTarget!,
    'Porch observation.',
  );
  assert.equal(porchObserved.ok, true);
  if (!porchObserved.ok) return;
  inspection = porchObserved.result.inspection;

  const wallObserved = commitInspectionFindingField(
    inspection,
    findCommandNode(['external', 'walls', 'observe'])!.findingTarget!,
    'Wall observation.',
  );
  assert.equal(wallObserved.ok, true);
  if (!wallObserved.ok) return;
  const wallLimited = commitInspectionFindingField(
    wallObserved.result.inspection,
    findCommandNode(['external', 'walls', 'limit'])!.findingTarget!,
    'Rear elevation not fully visible.',
  );
  assert.equal(wallLimited.ok, true);
  if (!wallLimited.ok) return;
  const ceilingObserved = commitInspectionFindingField(
    wallLimited.result.inspection,
    findCommandNode(['internal', 'ceilings', 'observe'])!.findingTarget!,
    'Ceiling observation.',
  );
  assert.equal(ceilingObserved.ok, true);
  if (!ceilingObserved.ok) return;
  const electricityObserved = commitInspectionFindingField(
    ceilingObserved.result.inspection,
    findCommandNode(['services', 'electricity', 'observe'])!.findingTarget!,
    'Consumer unit appears dated.',
  );
  assert.equal(electricityObserved.ok, true);
  if (!electricityObserved.ok) return;

  const job = withInspectionBrief(
    { ...jobWithAddress(), inspection: electricityObserved.result.inspection },
    brief,
  );
  const surveyReport = buildSurveyReport(job);
  const document = projectSurveyReportDocument(surveyReport);
  const kinds = document.blocks.map((block) => block.kind);
  assert.deepEqual(
    kinds.filter((kind) => kind === 'section-limitation'),
    ['section-limitation', 'section-limitation', 'section-limitation'],
  );

  const externalLimitationIndex = kinds.indexOf('section-limitation');
  const externalFindingIndex = document.blocks.findIndex(
    (block) => block.kind === 'finding' && block.findingId === 'finding.porch.1',
  );
  const internalLimitationIndex = kinds.indexOf(
    'section-limitation',
    externalLimitationIndex + 1,
  );
  const internalFindingIndex = document.blocks.findIndex(
    (block) => block.kind === 'finding' && block.findingId === 'finding.ceiling.1',
  );
  const servicesLimitationIndex = kinds.lastIndexOf('section-limitation');
  const servicesFindingIndex = document.blocks.findIndex(
    (block) =>
      block.kind === 'finding' &&
      block.findingId === 'finding.service.electrical_installation.1',
  );
  assert.ok(externalLimitationIndex < externalFindingIndex);
  assert.ok(internalLimitationIndex < internalFindingIndex);
  assert.ok(servicesLimitationIndex < servicesFindingIndex);

  const html = renderReportDocumentHtml(document);
  assert.match(html, /Brief-wide PREP limitation\./);
  assert.match(html, /Rear elevation obscured by vegetation\./);
  assert.match(html, /Loft hatch sealed; no roof-space access\./);
  assert.match(html, /Gas meter cupboard locked; no supply test\./);
  assert.match(html, /Rear elevation not fully visible\./);
  assert.match(html, /data-finding-id="finding\.porch\.1"/);
  assert.ok(
    html.indexOf('Rear elevation obscured by vegetation.') <
      html.indexOf('Porch observation.'),
  );
  assert.ok(
    html.indexOf('Loft hatch sealed; no roof-space access.') <
      html.indexOf('Ceiling observation.'),
  );
  assert.ok(
    html.indexOf('Gas meter cupboard locked; no supply test.') <
      html.indexOf('Consumer unit appears dated.'),
  );
});

test('unset section limitations are omitted from ReportDocument and HTML', () => {
  const job = jobWithAddress();
  const document = projectSurveyReportDocument(buildSurveyReport(job));
  assert.equal(
    document.blocks.some((block) => block.kind === 'section-limitation'),
    false,
  );
  const html = renderReportDocumentHtml(document);
  assert.equal(html.includes('External limitation'), false);
  assert.equal(html.includes('Internal limitation'), false);
  assert.equal(html.includes('Services limitation'), false);
});

test('Porch appears automatically through generic External findings in HTML', () => {
  const porch = EXTERNAL_FINDING_CONFIGS.find((config) => config.routeId === 'porch');
  assert.ok(porch);
  const observed = commitInspectionFindingField(
    createInitialActiveJob().inspection,
    findCommandNode([...porch.route, 'observe'])!.findingTarget!,
    'Entrance porch roof covering is worn.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;

  const job = withInspectionBrief(
    { ...jobWithAddress(), inspection: observed.result.inspection },
    emptyBrief(),
  );
  const html = reportHtml(job);
  assert.match(html, /data-finding-id="finding\.porch\.1"/);
  assert.match(html, /Entrance porch roof covering is worn\./);
  assert.match(html, /Porch/);
});

test('HTML escaping remains correct and evidence URIs are not exposed as prose', () => {
  let inspection = createInitialActiveJob().inspection;
  const observed = commitInspectionFindingField(
    inspection,
    findCommandNode(['external', 'walls', 'observe'])!.findingTarget!,
    'Crack <visible> & growing.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  inspection = {
    ...observed.result.inspection,
    evidence: {
      'photo-001': {
        id: 'photo-001',
        kind: 'photo',
        uri: 'file:///private/var/mobile/evidence/photo-001.jpg',
      },
    },
    findings: {
      ...observed.result.inspection.findings,
      'finding.external-wall.1': {
        ...observed.result.inspection.findings['finding.external-wall.1']!,
        evidence: [{ id: 'photo-001' }],
      },
    },
  };
  const brief = writeBrief(emptyBrief(), SURVEY_OPERATIONS.setInstructingParty, {
    value: 'A & B <Surveyors>',
  });
  const job = withInspectionBrief({ ...jobWithAddress(), inspection }, brief);
  const html = reportHtml(job);

  assert.match(html, /Crack &lt;visible&gt; &amp; growing\./);
  assert.match(html, /A &amp; B &lt;Surveyors&gt;/);
  assert.match(html, /photo-001/);
  assert.equal(html.includes('file:///'), false);
  assert.equal(html.includes('blob:'), false);
});

test('FirmAdapter affects presentation terminology only', () => {
  let inspection = createInitialActiveJob().inspection;
  const observed = commitInspectionFindingField(
    inspection,
    findCommandNode(['external', 'walls', 'observe'])!.findingTarget!,
    'Rendered crack pattern.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  const job = withInspectionBrief(
    { ...jobWithAddress(), inspection: observed.result.inspection },
    emptyBrief(),
  );
  const surveyReport = buildSurveyReport(job);
  const document = projectSurveyReportDocument(surveyReport);
  const adapted = applyFirmAdapter(document, DEMO_FIRM_ADAPTER);
  const finding = adapted.blocks.find((block) => block.kind === 'finding');
  assert.ok(finding && 'sectionHeading' in finding);
  assert.equal(finding.sectionHeading, 'Main Walls');
  assert.equal(
    surveyReport.findings.external[0]?.elementConceptId,
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

test('serialization and hydration of ActiveJob yields equivalent HTML', () => {
  let brief = writeBrief(emptyBrief(), SURVEY_OPERATIONS.setPurpose, {
    value: 'Level 2 survey',
  });
  const observed = commitInspectionFindingField(
    createInitialActiveJob().inspection,
    findCommandNode(['external', 'porch', 'observe'])!.findingTarget!,
    'Porch observation.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  const job = withInspectionBrief(
    { ...jobWithAddress(), inspection: observed.result.inspection },
    brief,
  );
  const before = reportHtml(job);
  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.ok(restored);
  const after = reportHtml(restored);
  assert.equal(after, before);
});

test('no persisted report state is introduced in ActiveJob or persistence', () => {
  const workspace = readFileSync(join(SRC_ROOT, 'types/workspace.ts'), 'utf8');
  const persistence = readFileSync(join(SRC_ROOT, 'lib/job-persistence.ts'), 'utf8');
  assert.equal(workspace.includes('report?:'), false);
  assert.equal(persistence.includes('report'), false);
});
