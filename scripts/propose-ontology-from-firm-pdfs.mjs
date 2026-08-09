import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  MUFFLE_ONTOLOGY_V1,
} from '@/domain/ontology/muffle-ontology.v1';
import { defaultCandidateRetriever } from '@/lib/onboarding/lexical-candidate-retriever';
import { parseFirmPdf } from '@/lib/onboarding/documents/pdf-parser';
import { minimizeParsedDocument } from '@/lib/onboarding/documents/privacy/pii-minimizer';
import {
  collectOntologyTermEvidence,
  generateOntologyConceptProposals,
} from '@/lib/onboarding/documents/ontology-seed-proposals';
import {
  buildOntologySeedProposalInspectionOutput,
  OntologySeedProposalCliError,
  ontologySeedProposalCliErrorMessage,
  parseOntologySeedProposalCliArguments,
  serializeOntologySeedProposalInspectionOutput,
} from '@/lib/onboarding/documents/ontology-seed-proposals-cli';

try {
  const options = parseOntologySeedProposalCliArguments(
    process.argv.slice(2),
  );
  const sources = [];
  for (const [sourceIndex, inputPath] of options.inputPaths.entries()) {
    const sourceDocumentId = `source-${sourceIndex + 1}`;
    console.log(
      `[${sourceIndex + 1}/${options.inputPaths.length}] Processing ${sourceDocumentId}`,
    );
    const parsed = await parseFirmPdf(inputPath, { pages: options.pages });
    sources.push({
      sourceDocumentId,
      document: minimizeParsedDocument(parsed),
    });
  }

  const evidence = collectOntologyTermEvidence(sources);
  const proposals = generateOntologyConceptProposals(
    sources,
    MUFFLE_ONTOLOGY_V1,
    defaultCandidateRetriever,
  );
  const inspection = buildOntologySeedProposalInspectionOutput(
    sources.length,
    evidence.length,
    proposals,
  );
  const output = serializeOntologySeedProposalInspectionOutput(inspection);
  const outputPath = resolve(options.outputPath);
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${output}\n`, 'utf8');
  } catch {
    throw new OntologySeedProposalCliError(
      'Ontology proposal output could not be written.',
    );
  }
  console.log(
    `Ontology proposal output written: ${evidence.length} evidence items, ${proposals.length} proposals.`,
  );
} catch (error) {
  console.error(
    `Ontology proposal generation failed: ${ontologySeedProposalCliErrorMessage(error)}`,
  );
  process.exitCode = 1;
}
