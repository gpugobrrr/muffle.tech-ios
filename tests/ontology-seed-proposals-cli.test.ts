import assert from 'node:assert/strict';
import test from 'node:test';

import { PdfParserError } from '@/lib/onboarding/documents/pdf-parser';
import {
  buildOntologySeedProposalInspectionOutput,
  ontologySeedProposalCliErrorMessage,
  parseOntologySeedProposalCliArguments,
  serializeOntologySeedProposalInspectionOutput,
} from '@/lib/onboarding/documents/ontology-seed-proposals-cli';
import type { OntologyConceptProposal } from '@/lib/onboarding/documents/ontology-seed-proposals';

const PROPOSAL: OntologyConceptProposal = {
  id: 'ontology-proposal:element:main-walls',
  status: 'candidate',
  termType: 'element',
  normalizedTerm: 'main walls',
  sourceTerms: ['D4 Main walls'],
  occurrences: 1,
  sourceDocumentCount: 1,
  evidence: [
    {
      sourceDocumentId: 'source-1',
      termType: 'element',
      originalTerm: 'D4 Main walls',
      normalizedTerm: 'main walls',
      page: 3,
      sourceBlockIds: ['p3-b2'],
      sectionHeading: 'Outside the property',
    },
  ],
  existingConceptMatches: [
    {
      conceptId: 'building_element.external_wall',
      label: 'External wall',
      aliases: [],
      description: 'An external wall inspected as the subject of a finding.',
      score: 0.5,
      matchedTerms: ['wall'],
    },
  ],
};

test('ontology proposal CLI supports one or more PDFs and existing page syntax', () => {
  assert.deepEqual(
    parseOntologySeedProposalCliArguments([
      'level2.pdf',
      'level3.pdf',
      '--pages',
      '1-3,7',
      '--output',
      'nested/rics-ontology-proposals.json',
    ]),
    {
      inputPaths: ['level2.pdf', 'level3.pdf'],
      pages: [1, 2, 3, 7],
      outputPath: 'nested/rics-ontology-proposals.json',
    },
  );
  assert.deepEqual(
    parseOntologySeedProposalCliArguments([
      'level2.pdf',
      '--output',
      'proposals.json',
    ]),
    {
      inputPaths: ['level2.pdf'],
      outputPath: 'proposals.json',
    },
  );
  assert.throws(
    () => parseOntologySeedProposalCliArguments(['level2.pdf']),
    /Usage: npm run onboarding:propose-ontology/,
  );
  assert.throws(
    () =>
      parseOntologySeedProposalCliArguments([
        'level2.pdf',
        '--output',
        'proposals.txt',
      ]),
    /\.json file extension/,
  );
});

test('inspection envelope is deterministic UTF-8 JSON without source paths', () => {
  const output = buildOntologySeedProposalInspectionOutput(1, 1, [PROPOSAL]);
  const first = serializeOntologySeedProposalInspectionOutput(output);
  const second = serializeOntologySeedProposalInspectionOutput(output);

  assert.equal(first, second);
  assert.deepEqual(JSON.parse(first), output);
  assert.deepEqual(
    {
      schemaVersion: output.schemaVersion,
      sourceDocumentCount: output.sourceDocumentCount,
      evidenceCount: output.evidenceCount,
      proposalCount: output.proposalCount,
    },
    {
      schemaVersion: 1,
      sourceDocumentCount: 1,
      evidenceCount: 1,
      proposalCount: 1,
    },
  );
  assert.equal(first.includes('D4 Main walls'), true);
  assert.equal(first.includes('C:\\Users\\Example\\rhs_level_two.pdf'), false);
});

test('CLI parser errors do not expose sensitive input paths', () => {
  assert.equal(
    ontologySeedProposalCliErrorMessage(
      new PdfParserError(
        'FILE_NOT_FOUND',
        'Missing C:\\Confidential\\Client-Report.pdf',
      ),
    ),
    'An input PDF was not found.',
  );
  assert.equal(
    ontologySeedProposalCliErrorMessage(
      new Error('C:\\Confidential\\Client-Report.pdf'),
    ),
    'Ontology proposal generation failed.',
  );
});
