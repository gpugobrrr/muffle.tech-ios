import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import type { ParsedDocumentBlockType } from '@/lib/onboarding/documents/parsed-document';
import { PdfParserError } from '@/lib/onboarding/documents/pdf-parser';
import type {
  PiiMinimizedBlock,
  PiiMinimizedDocument,
} from '@/lib/onboarding/documents/privacy/pii-minimized-document';
import { minimizeParsedDocument } from '@/lib/onboarding/documents/privacy/pii-minimizer';
import {
  buildSemanticFragmentInspectionOutput,
  parseSemanticFragmentCliArguments,
  semanticFragmentCliErrorMessage,
  serializeSemanticFragmentInspectionOutput,
} from '@/lib/onboarding/documents/semantic-fragment-extractor-cli';
import {
  extractSemanticFragments,
  type SemanticFragment,
} from '@/lib/onboarding/documents/semantic-fragment-extractor';
import { selectRetrievalEligibleFragments } from '@/lib/onboarding/documents/semantic-fragment-retrieval';

function minimizedBlock(
  sourceBlockId: string,
  page: number,
  type: ParsedDocumentBlockType,
  text: string,
): PiiMinimizedBlock {
  return {
    sourceBlockId,
    page,
    type,
    text,
    actions: [],
  };
}

function minimizedDocument(): PiiMinimizedDocument {
  return {
    minimizerVersion: 1,
    sourceParserVersion: 1,
    pageCount: 6,
    parsedPages: [1, 2, 3, 4, 5, 6],
    summary: {
      email: 0,
      phone: 0,
      postcode: 0,
      person_name: 0,
      postal_address: 0,
      report_reference: 0,
      signature: 0,
      professional_identifier: 0,
    },
    blocks: [
      minimizedBlock('p3-b1', 3, 'heading', 'Outside the property'),
      minimizedBlock('p3-b2', 3, 'heading', 'D4 Main walls'),
      minimizedBlock(
        'p3-b3',
        3,
        'paragraph',
        'The main walls are of traditional masonry construction and are approximately 300mm thick.',
      ),
      minimizedBlock(
        'p6-b1',
        6,
        'paragraph',
        'Surveyor’s declaration for RICS Home Survey – Level 2',
      ),
      minimizedBlock('p6-b2', 6, 'paragraph', '[PERSON]'),
      minimizedBlock('p6-b3', 6, 'paragraph', '[EMAIL]'),
    ],
  };
}

test('semantic fragment CLI reuses parser page syntax and requires JSON output', () => {
  assert.deepEqual(
    parseSemanticFragmentCliArguments([
      'report.pdf',
      '--pages',
      '1-3,7',
      '--output',
      'semantic-fragments.json',
    ]),
    {
      inputPath: 'report.pdf',
      retrievalOnly: false,
      pages: [1, 2, 3, 7],
      outputPath: 'semantic-fragments.json',
    },
  );
  assert.deepEqual(
    parseSemanticFragmentCliArguments([
      'report.pdf',
      '--retrieval-only',
      '--output',
      'semantic-retrieval-fragments.json',
    ]),
    {
      inputPath: 'report.pdf',
      retrievalOnly: true,
      outputPath: 'semantic-retrieval-fragments.json',
    },
  );
  assert.throws(
    () =>
      parseSemanticFragmentCliArguments([
        'report.pdf',
        '--output',
        'fragments.txt',
      ]),
    /\.json file extension/,
  );
  assert.throws(
    () => parseSemanticFragmentCliArguments([]),
    /Usage: npm run onboarding:extract-fragments/,
  );
});

test('retrieval-only selection leaves complete inspection fragments unchanged', () => {
  const document = minimizedDocument();
  document.blocks.push(
    minimizedBlock('p6-b4', 6, 'paragraph', 'Inspection date'),
    minimizedBlock('p6-b5', 6, 'paragraph', '15 March 2026'),
  );
  const complete = extractSemanticFragments(document);
  const completeSnapshot = structuredClone(complete);
  const retrieval = selectRetrievalEligibleFragments(complete);

  assert.deepEqual(complete, completeSnapshot);
  assert.equal(
    complete.some(({ text }) => text === 'Inspection date'),
    true,
  );
  assert.equal(
    retrieval.some(({ text }) => text === 'Inspection date'),
    false,
  );
  assert.equal(
    retrieval.some(({ text }) => text === '15 March 2026'),
    false,
  );
});

test('inspection JSON preserves Unicode, provenance, and excludes privacy/debug leakage', () => {
  const document = minimizedDocument();
  const fragments = extractSemanticFragments(document);
  const inspection = buildSemanticFragmentInspectionOutput(
    document.pageCount,
    fragments,
    document.parsedPages,
  );
  const json = serializeSemanticFragmentInspectionOutput(inspection);
  const second = serializeSemanticFragmentInspectionOutput(inspection);

  assert.equal(json, second);
  assert.deepEqual(JSON.parse(json), inspection);
  assert.equal(inspection.schemaVersion, 1);
  assert.equal(inspection.pagesInSource, 6);
  assert.deepEqual(inspection.parsedPages, [1, 2, 3, 4, 5, 6]);
  assert.equal(inspection.fragmentCount, fragments.length);
  assert.equal(json.includes('Surveyor’s declaration'), true);
  assert.equal(json.includes('RICS Home Survey – Level 2'), true);
  assert.equal(json.includes('D4 Main walls'), true);
  assert.equal(
    json.includes(
      'The main walls are of traditional masonry construction and are approximately 300mm thick.',
    ),
    true,
  );

  for (const forbidden of [
    'Alex Example',
    'alex@example.com',
    '07700 900123',
    '10 Example Road',
    'JOB-EXAMPLE-001',
    '7654321',
    '"bounds"',
    '"font"',
    'debugPages',
    'sourceFile',
    'conceptId',
    'selectedConceptId',
    'confidence',
    'rationale',
  ]) {
    assert.equal(json.includes(forbidden), false, forbidden);
  }
  assert.equal(
    inspection.fragments.some((fragment) => fragment.text === '[PERSON]'),
    false,
  );
  assert.equal(
    inspection.fragments.some((fragment) => fragment.text === '[EMAIL]'),
    false,
  );
});

test('CLI pipeline order is parser then PII minimiser then fragment extractor', () => {
  const sensitiveSource = {
    parserVersion: 1 as const,
    sourceFile: 'Alex-Example.pdf',
    pageCount: 1,
    blocks: [
      {
        id: 'p1-b1',
        page: 1,
        type: 'heading' as const,
        text: 'Outside the property',
      },
      {
        id: 'p1-b2',
        page: 1,
        type: 'heading' as const,
        text: 'D4 Main walls',
      },
      {
        id: 'p1-b3',
        page: 1,
        type: 'paragraph' as const,
        text: 'Contact the client at alex@example.com or 07700 900123 about OX3 8SE.',
        bounds: { x: 50, y: 700, width: 400, height: 10 },
        font: { size: 10, family: 'SyntheticSans' },
      },
      {
        id: 'p1-b4',
        page: 1,
        type: 'paragraph' as const,
        text: "Client's name",
        bounds: { x: 50, y: 680, width: 90, height: 10 },
        font: { size: 10 },
      },
      {
        id: 'p1-b5',
        page: 1,
        type: 'paragraph' as const,
        text: 'Alex Example',
        bounds: { x: 220, y: 680, width: 80, height: 10 },
        font: { size: 10 },
      },
      {
        id: 'p1-b6',
        page: 1,
        type: 'paragraph' as const,
        text: 'Report reference number',
        bounds: { x: 50, y: 660, width: 140, height: 10 },
        font: { size: 10 },
      },
      {
        id: 'p1-b7',
        page: 1,
        type: 'paragraph' as const,
        text: 'JOB-EXAMPLE-001',
        bounds: { x: 220, y: 660, width: 100, height: 10 },
        font: { size: 10 },
      },
    ],
  };
  const minimized = minimizeParsedDocument(sensitiveSource);
  const fragments = extractSemanticFragments(minimized);
  const json = serializeSemanticFragmentInspectionOutput(
    buildSemanticFragmentInspectionOutput(
      minimized.pageCount,
      fragments,
      minimized.parsedPages,
    ),
  );

  assert.equal(json.includes('Alex Example'), false);
  assert.equal(json.includes('alex@example.com'), false);
  assert.equal(json.includes('07700 900123'), false);
  assert.equal(json.includes('OX3 8SE'), false);
  assert.equal(json.includes('JOB-EXAMPLE-001'), false);
  assert.equal(json.includes('[EMAIL]'), true);
  assert.equal(json.includes('[PHONE]'), true);
  assert.equal(json.includes('[POSTCODE]'), true);
  assert.equal(json.includes('"bounds"'), false);
  assert.equal(json.includes('"font"'), false);
  assert.equal(json.includes('sourceFile'), false);
  assert.equal(
    fragments.some((fragment: SemanticFragment) =>
      fragment.text.includes('Contact the client at [EMAIL]'),
    ),
    true,
  );
  assert.equal(
    fragments.some((fragment) => fragment.text === '[PERSON]'),
    false,
  );
  assert.equal(
    fragments.some((fragment) => fragment.text === '[REFERENCE]'),
    false,
  );
});

test('CLI parser errors remain sanitised and UTF-8 output writes recursively', async () => {
  const error = new PdfParserError(
    'FILE_NOT_FOUND',
    'PDF file does not exist: C:\\Confidential\\Alex-Example.pdf',
  );
  assert.equal(
    semanticFragmentCliErrorMessage(error),
    'Input PDF was not found.',
  );

  const root = await mkdtemp(join(tmpdir(), 'muffle-fragments-'));
  try {
    const nested = join(root, 'nested', 'out');
    const outputPath = join(nested, 'semantic-fragments.json');
    const inspection = buildSemanticFragmentInspectionOutput(
      1,
      extractSemanticFragments(minimizedDocument()),
      [1],
    );
    const payload = serializeSemanticFragmentInspectionOutput(inspection);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${payload}\n`, 'utf8');
    const written = await readFile(outputPath, 'utf8');
    assert.equal(written, `${payload}\n`);
    assert.equal(written.includes('Surveyor’s declaration'), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
