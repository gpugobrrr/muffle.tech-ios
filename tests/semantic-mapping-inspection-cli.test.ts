import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SemanticMappingHttpError,
} from '@/lib/onboarding/llama-cpp-semantic-mapper';
import { PdfParserError } from '@/lib/onboarding/documents/pdf-parser';
import {
  parseSemanticMappingInspectionCliArguments,
  semanticMappingInspectionCliErrorMessage,
  serializeSemanticMappingInspectionOutput,
} from '@/lib/onboarding/documents/semantic-mapping-inspection-cli';
import type { SemanticMappingInspectionOutput } from '@/lib/onboarding/documents/semantic-mapping-inspection';

test('local mapping CLI requires PDF, page selection, and JSON output', () => {
  assert.deepEqual(
    parseSemanticMappingInspectionCliArguments([
      'report.pdf',
      '--pages',
      '1-3,6',
      '--output',
      'nested/mapping-results.json',
    ]),
    {
      inputPath: 'report.pdf',
      pages: [1, 2, 3, 6],
      outputPath: 'nested/mapping-results.json',
    },
  );
  assert.throws(
    () =>
      parseSemanticMappingInspectionCliArguments([
        'report.pdf',
        '--output',
        'mapping-results.json',
      ]),
    /Usage: npm run onboarding:map-fragments-local/,
  );
  assert.throws(
    () =>
      parseSemanticMappingInspectionCliArguments([
        'report.pdf',
        '--pages',
        '1-6',
      ]),
    /Usage: npm run onboarding:map-fragments-local/,
  );
  assert.throws(
    () =>
      parseSemanticMappingInspectionCliArguments([
        'report.pdf',
        '--pages',
        '1-6',
        '--output',
        'mapping-results.txt',
      ]),
    /\.json file extension/,
  );
  assert.throws(
    () =>
      parseSemanticMappingInspectionCliArguments([
        'report.pdf',
        '--pages',
        '6-1',
        '--output',
        'mapping-results.json',
      ]),
    /Invalid page range/,
  );
});

test('inspection JSON preserves UTF-8 and omits source paths', () => {
  const output: SemanticMappingInspectionOutput = {
    schemaVersion: 1,
    source: {
      pagesInSource: 1,
      parsedPages: [1],
    },
    summary: {
      completeFragments: 1,
      retrievalEligibleFragments: 1,
      mappingAttempts: 1,
      successfulProposals: 0,
      resolved: 0,
      unresolved: 1,
      retrievalEmpty: 0,
      errors: 0,
      totalLatencyMs: 10,
      meanLatencyMs: 10,
      medianLatencyMs: 10,
    },
    results: [
      {
        fragment: {
          id: 'sf-1-p1-b1',
          page: 1,
          type: 'paragraph',
          text: 'Surveyor’s declaration for RICS Home Survey – Level 2',
          headingPath: [],
          sourceBlockIds: ['p1-b1'],
        },
        retrievalInput: {
          firmTerm: 'Surveyor’s declaration for RICS Home Survey – Level 2',
          representativeText:
            'Surveyor’s declaration for RICS Home Survey – Level 2',
        },
        candidates: [],
        status: 'unresolved',
        proposal: {
          firmTerm: 'Surveyor’s declaration for RICS Home Survey – Level 2',
          selectedConceptId: null,
          confidence: 0.1,
          alternatives: [],
          rationale: 'No reliable candidate.',
        },
        latencyMs: 10,
      },
    ],
  };
  const json = serializeSemanticMappingInspectionOutput(output);

  assert.deepEqual(JSON.parse(json), output);
  assert.equal(json.includes('Surveyor’s'), true);
  assert.equal(json.includes('RICS Home Survey – Level 2'), true);
  assert.equal(json.includes('C:\\Confidential\\report.pdf'), false);
});

test('CLI errors are actionable without exposing sensitive paths or transport details', () => {
  assert.equal(
    semanticMappingInspectionCliErrorMessage(
      new PdfParserError(
        'FILE_NOT_FOUND',
        'Missing C:\\Confidential\\Alex-Example.pdf',
      ),
    ),
    'Input PDF was not found.',
  );
  assert.equal(
    semanticMappingInspectionCliErrorMessage(
      new SemanticMappingHttpError(
        0,
        'http://127.0.0.1:8080/v1/chat/completions (secret transport detail)',
      ),
    ),
    'Local llama.cpp server is unavailable. Start the configured localhost server and retry.',
  );
  assert.equal(
    semanticMappingInspectionCliErrorMessage(
      new Error('Alex Example alex@example.com'),
    ),
    'Local semantic mapping inspection failed.',
  );
});
