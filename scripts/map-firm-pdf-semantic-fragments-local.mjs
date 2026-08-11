import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  MUFFLE_ONTOLOGY_V1,
} from '@/domain/ontology/muffle-ontology.v1';
import { defaultCandidateRetriever } from '@/lib/onboarding/lexical-candidate-retriever';
import { LlamaCppSemanticMapper } from '@/lib/onboarding/llama-cpp-semantic-mapper';
import { parseFirmPdf } from '@/lib/onboarding/documents/pdf-parser';
import { minimizeParsedDocument } from '@/lib/onboarding/documents/privacy/pii-minimizer';
import {
  extractSemanticFragments,
  toFirmSemanticFragment,
} from '@/lib/onboarding/documents/semantic-fragment-extractor';
import { selectRetrievalEligibleFragments } from '@/lib/onboarding/documents/semantic-fragment-retrieval';
import {
  inspectFirmPdfSemanticMappings,
} from '@/lib/onboarding/documents/semantic-mapping-inspection';
import {
  parseSemanticMappingInspectionCliArguments,
  semanticMappingInspectionCliErrorMessage,
  SemanticMappingInspectionCliError,
  serializeSemanticMappingInspectionOutput,
} from '@/lib/onboarding/documents/semantic-mapping-inspection-cli';

try {
  const options = parseSemanticMappingInspectionCliArguments(
    process.argv.slice(2),
  );
  const mapper = new LlamaCppSemanticMapper();
  console.log(`Local mapper: ${mapper.model} at ${mapper.baseUrl}`);

  const inspection = await inspectFirmPdfSemanticMappings(
    options.inputPath,
    {
      pages: options.pages,
      onProgress(event) {
        if (event.type === 'mapping') {
          console.log(
            `[${event.index}/${event.total}] Mapping ${event.fragmentId}`,
          );
        } else {
          console.log(
            `[${event.index}/${event.total}] ${event.fragmentId}: ${event.status} (${event.latencyMs.toFixed(0)}ms)`,
          );
        }
      },
    },
    {
      parseDocument: parseFirmPdf,
      minimizeDocument: minimizeParsedDocument,
      extractFragments: extractSemanticFragments,
      selectRetrievalFragments: selectRetrievalEligibleFragments,
      adaptFragment: toFirmSemanticFragment,
      retriever: defaultCandidateRetriever,
      mapper,
      ontology: MUFFLE_ONTOLOGY_V1,
    },
  );
  const output = serializeSemanticMappingInspectionOutput(inspection);
  const outputPath = resolve(options.outputPath);
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${output}\n`, 'utf8');
  } catch {
    throw new SemanticMappingInspectionCliError(
      'Semantic mapping inspection output could not be written.',
    );
  }
  console.log('Semantic mapping inspection output written.');
} catch (error) {
  console.error(
    `Semantic mapping inspection failed: ${semanticMappingInspectionCliErrorMessage(error)}`,
  );
  process.exitCode = 1;
}
