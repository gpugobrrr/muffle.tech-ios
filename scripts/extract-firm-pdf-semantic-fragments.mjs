import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { parseFirmPdf } from '@/lib/onboarding/documents/pdf-parser';
import { minimizeParsedDocument } from '@/lib/onboarding/documents/privacy/pii-minimizer';
import {
  buildSemanticFragmentInspectionOutput,
  parseSemanticFragmentCliArguments,
  semanticFragmentCliErrorMessage,
  serializeSemanticFragmentInspectionOutput,
} from '@/lib/onboarding/documents/semantic-fragment-extractor-cli';
import { extractSemanticFragments } from '@/lib/onboarding/documents/semantic-fragment-extractor';
import { selectRetrievalEligibleFragments } from '@/lib/onboarding/documents/semantic-fragment-retrieval';

try {
  const options = parseSemanticFragmentCliArguments(process.argv.slice(2));
  const parsed = await parseFirmPdf(options.inputPath, {
    pages: options.pages,
  });
  const minimized = minimizeParsedDocument(parsed);
  const completeFragments = extractSemanticFragments(minimized);
  const fragments = options.retrievalOnly
    ? selectRetrievalEligibleFragments(completeFragments)
    : completeFragments;
  const inspection = buildSemanticFragmentInspectionOutput(
    minimized.pageCount,
    fragments,
    minimized.parsedPages,
  );
  const output = serializeSemanticFragmentInspectionOutput(inspection);

  if (options.outputPath) {
    const outputPath = resolve(options.outputPath);
    try {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${output}\n`, 'utf8');
    } catch {
      throw new Error('Semantic fragment output could not be written.');
    }
    console.log('Semantic fragment output written.');
  } else {
    console.log(output);
  }
} catch (error) {
  console.error(
    `Semantic fragment extraction failed: ${semanticFragmentCliErrorMessage(error)}`,
  );
  process.exitCode = 1;
}
