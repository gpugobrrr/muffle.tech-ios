import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { DEMO_OX3_8SE_ADDRESSES } from '@/lib/fixtures/demo-ox3-8se';
import { createEmptyInspectionRecord } from '@/lib/inspection-record';
import { buildReportDocument } from '@/lib/report/build-report-document';
import { renderReportDocumentHtml } from '@/lib/report/render-report-html';

const address = DEMO_OX3_8SE_ADDRESSES[1].address;
const document = buildReportDocument({
  activeJob: {
    property: {
      displayAddress: address.formattedAddress,
      address,
    },
    inspection: createEmptyInspectionRecord(),
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
const outputPath = resolve(outputDirectory, 'identity.html');

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, renderReportDocumentHtml(document), 'utf8');
console.log(outputPath);
