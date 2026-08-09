import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  formatParsedFirmDocument,
  parsePdfParserCliArguments,
} from '@/lib/onboarding/documents/pdf-parser-cli';
import {
  parseFirmPdf,
  PdfParserError,
} from '@/lib/onboarding/documents/pdf-parser';

try {
  const options = parsePdfParserCliArguments(process.argv.slice(2));
  const document = await parseFirmPdf(options.inputPath, {
    pages: options.pages,
    debug: options.debug,
  });
  const json = JSON.stringify(document, null, 2);

  if (options.outputPath) {
    const outputPath = resolve(options.outputPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${json}\n`, 'utf8');
    if (!options.json) console.log(`JSON written: ${outputPath}`);
  }

  if (options.json) {
    console.log(json);
  } else {
    console.log(formatParsedFirmDocument(document, options.debug));
  }
} catch (error) {
  const prefix =
    error instanceof PdfParserError
      ? `PDF Parser v1 failed [${error.code}]`
      : 'PDF Parser v1 failed';
  console.error(
    `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
