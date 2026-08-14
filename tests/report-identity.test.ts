import assert from 'node:assert/strict';
import test from 'node:test';

import { DEMO_OX3_8SE_ADDRESSES } from '../src/lib/fixtures/demo-ox3-8se';
import {
  buildReportDocument,
  ReportBuildError,
  type ReportBuildInput,
} from '../src/lib/report/build-report-document';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import {
  identityAddressLines,
  renderReportDocumentHtml,
} from '../src/lib/report/render-report-html';
import {
  executeSurveyOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
import type {
  ActiveJob,
  InspectionBrief,
  StructuredAddress,
} from '../src/types/workspace';

function createBrief(instructingParty: string | null = null): InspectionBrief {
  return {
    instruction: {
      instructingParty,
      client: null,
      reference: null,
      source: null,
    },
    purpose: null,
    deliverable: null,
    limitation: null,
  };
}

function createJob(address: StructuredAddress): ActiveJob {
  return {
    id: `job.test.${address.postalCode ?? 'unknown'}`,
    property: {
      displayAddress: address.formattedAddress,
      address,
    },
    inspection: createEmptyInspectionRecord(),
  };
}

function identityFrom(input: ReportBuildInput) {
  const document = buildReportDocument(input);
  const identity = document.blocks[0];
  assert.equal(identity.kind, 'identity');
  return identity;
}

test('property-only report preserves structured selected property data', () => {
  const address = DEMO_OX3_8SE_ADDRESSES[0].address;
  const identity = identityFrom({
    activeJob: createJob(address),
    inspectionBrief: createBrief(),
  });

  assert.equal(identity.property.address.postalCode, 'OX3 8SE');
  assert.equal(identity.property.address.route, 'Margaret Road');
  assert.equal(identity.property.address.townOrCity, 'Oxford');
  assert.equal(identity.instructingParty, undefined);
});

test('subpremise identity is retained without reparsing display text', () => {
  const address = DEMO_OX3_8SE_ADDRESSES[1].address;
  const identity = identityFrom({
    activeJob: createJob(address),
    inspectionBrief: createBrief(),
  });

  assert.equal(identity.property.address.subBuildingName, 'Flat 15');
  assert.equal(identity.property.address.buildingName, 'Wooldridge Court');
  assert.deepEqual(identityAddressLines(identity.property.address).slice(0, 3), [
    'Flat 15',
    'Wooldridge Court',
    'Margaret Road',
  ]);
});

test('committed instructing party is included in Identity', () => {
  const result = executeSurveyOperation(createBrief(), {
    operationId: SURVEY_OPERATIONS.setInstructingParty,
    arguments: { value: 'Example Chartered Surveyors' },
  });
  assert.ok(result);

  const identity = identityFrom({
    activeJob: createJob(DEMO_OX3_8SE_ADDRESSES[2].address),
    inspectionBrief: result.brief,
  });
  assert.equal(identity.instructingParty, 'Example Chartered Surveyors');
});

test('absent instructing party is omitted cleanly', () => {
  const document = buildReportDocument({
    activeJob: createJob(DEMO_OX3_8SE_ADDRESSES[0].address),
    inspectionBrief: createBrief(),
  });
  const identity = document.blocks[0];
  const html = renderReportDocumentHtml(document);

  assert.equal('instructingParty' in identity, false);
  assert.equal(html.includes('Instructing party'), false);
  assert.equal(html.includes('undefined'), false);
});

test('uncommitted draft text cannot enter the report projection', () => {
  const input = {
    activeJob: createJob(DEMO_OX3_8SE_ADDRESSES[0].address),
    inspectionBrief: createBrief(),
    entryValue: 'Draft party that has not been submitted',
  } satisfies ReportBuildInput & { entryValue: string };

  const document = buildReportDocument(input);
  assert.equal(
    JSON.stringify(document).includes('Draft party that has not been submitted'),
    false,
  );
});

test('same canonical input produces the same report model without mutation', () => {
  const input: ReportBuildInput = {
    activeJob: createJob(DEMO_OX3_8SE_ADDRESSES[1].address),
    inspectionBrief: createBrief('Deterministic Client'),
  };
  const before = structuredClone(input);

  const first = buildReportDocument(input);
  const second = buildReportDocument(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test('building without a structured selected property fails explicitly', () => {
  assert.throws(
    () =>
      buildReportDocument({
        activeJob: {
          id: 'job.test.missing-property',
          property: null,
          inspection: createEmptyInspectionRecord(),
        },
        inspectionBrief: createBrief(),
      }),
    (error: unknown) =>
      error instanceof ReportBuildError &&
      error.code === 'MISSING_PROPERTY',
  );
});

test('HTML output is A4, print-safe, escaped, and contains no app controls', () => {
  const document = buildReportDocument({
    activeJob: createJob(DEMO_OX3_8SE_ADDRESSES[1].address),
    inspectionBrief: createBrief('A & B <Surveyors>'),
  });
  const html = renderReportDocumentHtml(document);

  assert.match(html, /@page \{ size: A4 portrait;/);
  assert.match(html, /Flat 15/);
  assert.match(html, /A &amp; B &lt;Surveyors&gt;/);
  assert.equal(html.includes('Pressable'), false);
  assert.equal(html.includes('SVYR'), false);
});
