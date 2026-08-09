import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { DEMO_EXTERNAL_WALL_FINDING } from '@/lib/fixtures/demo-external-wall-finding';
import { DEMO_OX3_8SE_ADDRESSES } from '@/lib/fixtures/demo-ox3-8se';
import { createEmptyInspectionRecord } from '@/lib/inspection-record';
import { buildReportDocument } from '@/lib/report/build-report-document';
import { DEMO_FIRM_ADAPTER } from '@/lib/report/firm-adapter';
import { renderReportDocumentHtml } from '@/lib/report/render-report-html';
import {
  executeInspectionOperation,
  SURVEY_OPERATIONS,
} from '@/lib/survey-operations';

const result = executeInspectionOperation(createEmptyInspectionRecord(), {
  operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
  arguments: { finding: DEMO_EXTERNAL_WALL_FINDING },
});
if (!result) {
  throw new Error('Demo external-wall finding was rejected by the engine.');
}

const address = DEMO_OX3_8SE_ADDRESSES[1].address;
const document = buildReportDocument({
  activeJob: {
    property: {
      displayAddress: address.formattedAddress,
      address,
    },
    inspection: result.inspection,
  },
  inspectionBrief: {
    instruction: {
      instructingParty: null,
      client: null,
      reference: null,
      source: null,
    },
    purpose: null,
    deliverable: null,
    limitation: null,
  },
});
const outputDirectory = resolve('dist', 'report-preview');
const outputPath = resolve(outputDirectory, 'external-wall.html');

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  outputPath,
  renderReportDocumentHtml(document, { firmAdapter: DEMO_FIRM_ADAPTER }),
  'utf8',
);
console.log(outputPath);
