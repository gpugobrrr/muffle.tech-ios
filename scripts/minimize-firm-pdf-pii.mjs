import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { parseFirmPdf } from '@/lib/onboarding/documents/pdf-parser';
import {
  parsePiiMinimizerCliArguments,
  piiMinimizerCliErrorMessage,
  serializePiiMinimizedDocument,
} from '@/lib/onboarding/documents/privacy/pii-minimizer-cli';
import { minimizeParsedDocument } from '@/lib/onboarding/documents/privacy/pii-minimizer';

try {
  const options = parsePiiMinimizerCliArguments(process.argv.slice(2));
  const parsed = await parseFirmPdf(options.inputPath, {
    pages: options.pages,
  });
  const minimized = minimizeParsedDocument(parsed);
  const output = serializePiiMinimizedDocument(minimized, options.json);

  if (options.outputPath) {
    const outputPath = resolve(options.outputPath);
    try {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${output}\n`, 'utf8');
    } catch {
      throw new Error('PII-minimised output could not be written.');
    }
    console.log('PII-minimised output written.');
  } else {
    console.log(output);
  }
} catch (error) {
  console.error(`PII minimisation failed: ${piiMinimizerCliErrorMessage(error)}`);
  process.exitCode = 1;
}
