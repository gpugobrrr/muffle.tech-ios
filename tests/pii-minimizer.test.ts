import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ParsedDocumentBlock,
  ParsedDocumentBlockType,
  ParsedFirmDocument,
} from '@/lib/onboarding/documents/parsed-document';
import { PdfParserError } from '@/lib/onboarding/documents/pdf-parser';
import {
  formatPiiMinimizedDocument,
  parsePiiMinimizerCliArguments,
  piiMinimizerCliErrorMessage,
  serializePiiMinimizedDocument,
} from '@/lib/onboarding/documents/privacy/pii-minimizer-cli';
import {
  minimizeParsedDocument,
  minimizePiiText,
} from '@/lib/onboarding/documents/privacy/pii-minimizer';

function block(
  id: string,
  text: string,
  x: number,
  y: number,
  type: ParsedDocumentBlockType = 'paragraph',
): ParsedDocumentBlock {
  return {
    id,
    page: 2,
    type,
    text,
    bounds: { x, y, width: Math.max(60, text.length * 5), height: 10 },
    font: { size: 10, family: 'SyntheticSans', weight: 'normal' },
    sourceItemCount: 1,
  };
}

test('high-confidence inline PII is replaced without damaging ordinary numbers', () => {
  const result = minimizePiiText(
    'Email alex@example.com, call 07700 900123, property OX3 8SE; rating 3, built 2021, 300mm, 12.5%.',
  );
  assert.equal(
    result.text,
    'Email [EMAIL], call [PHONE], property [POSTCODE]; rating 3, built 2021, 300mm, 12.5%.',
  );
  assert.deepEqual(
    result.actions.map(({ category, count }) => [category, count]),
    [
      ['email', 1],
      ['postcode', 1],
      ['phone', 1],
    ],
  );

  assert.equal(
    minimizePiiText('Call +44 7700 900456 or 020 7946 0123.').text,
    'Call [PHONE] or [PHONE].',
  );
  assert.equal(
    minimizePiiText('Postcodes SW1A 1AA and M1 1AE.').text,
    'Postcodes [POSTCODE] and [POSTCODE].',
  );
});

test('placeholder replacement is idempotent', () => {
  const once = minimizePiiText(
    'Contact alex@example.com on 07700 900123 at OX3 8SE.',
  );
  const twice = minimizePiiText(once.text);
  assert.equal(twice.text, once.text);
  assert.deepEqual(twice.actions, []);
  assert.equal(minimizePiiText('[EMAIL] [PHONE] [POSTCODE]').text, '[EMAIL] [PHONE] [POSTCODE]');
});

test('contextual labels survive while adjacent identifying values are minimized', () => {
  const source: ParsedFirmDocument = {
    parserVersion: 1,
    sourceFile: 'Alex-Example-10-Example-Road.pdf',
    pageCount: 4,
    parsedPages: [2],
    debugPages: [
      {
        page: 2,
        items: [
          {
            text: 'alex@example.com',
            x: 220,
            y: 600,
            width: 90,
            height: 10,
            fontSize: 10,
          },
        ],
      },
    ],
    blocks: [
      block('p2-b1', "Client's name", 50, 700),
      block('p2-b2', 'Alex Example', 220, 700),
      block('p2-b3', 'Property address', 50, 680),
      block('p2-b4', '10 Example Road, Exampletown, OX3 8SE', 220, 680),
      block('p2-b5', 'Report reference', 50, 660),
      block('p2-b6', 'JOB-EXAMPLE-001', 220, 660),
      block('p2-b7', "Surveyor's RICS number", 50, 640),
      block('p2-b8', '1234567', 220, 640),
      block('p2-b9', 'Signature', 50, 620),
      block('p2-b10', 'Alex Example', 220, 620),
      block('p2-b11', 'Phone number', 50, 600),
      block('p2-b12', '07700 900123', 220, 600),
      block('p2-b13', 'Email', 50, 580),
      block('p2-b14', 'alex@example.com', 220, 580),
    ],
  };
  const original = structuredClone(source);
  const minimized = minimizeParsedDocument(source);

  assert.deepEqual(source, original);
  assert.deepEqual(
    minimized.blocks.map(({ text }) => text),
    [
      "Client's name",
      '[PERSON]',
      'Property address',
      '[ADDRESS]',
      'Report reference',
      '[REFERENCE]',
      "Surveyor's RICS number",
      '[PROFESSIONAL_ID]',
      'Signature',
      '[SIGNATURE]',
      'Phone number',
      '[PHONE]',
      'Email',
      '[EMAIL]',
    ],
  );
  assert.deepEqual(minimized.summary, {
    email: 1,
    phone: 1,
    postcode: 0,
    person_name: 1,
    postal_address: 1,
    report_reference: 1,
    signature: 1,
    professional_identifier: 1,
  });
  assert.equal(minimized.blocks[1].sourceBlockId, 'p2-b2');
  assert.equal(minimized.blocks[1].page, 2);
  assert.equal('sourceFile' in minimized, false);
  assert.equal('debugPages' in minimized, false);

  const serialized = JSON.stringify(minimized);
  for (const sensitiveValue of [
    'Alex Example',
    '10 Example Road',
    'JOB-EXAMPLE-001',
    '07700 900123',
    'alex@example.com',
  ]) {
    assert.equal(serialized.includes(sensitiveValue), false);
  }
});

test('inline label values preserve labels and replace only values', () => {
  assert.equal(
    minimizePiiText("Client's name: Alex Example").text,
    "Client's name: [PERSON]",
  );
  assert.equal(
    minimizePiiText('Property address – 10 Example Road, OX3 8SE').text,
    'Property address – [ADDRESS]',
  );
  assert.equal(
    minimizePiiText('Signature: Alex Example').text,
    'Signature: [SIGNATURE]',
  );
});

test('public organisations and surveying semantics remain unchanged', () => {
  const safeText = [
    'D4 Main walls',
    'External walls are of traditional masonry construction.',
    'The surveyor recommends further investigation.',
    'Condition rating 3 – defects require urgent attention.',
    'RICS Home Survey – Level 2',
    'Royal Institution of Chartered Surveyors',
    'The wall is approximately 300mm thick and moisture was recorded at 18%.',
  ];
  for (const value of safeText) {
    assert.equal(minimizePiiText(value).text, value);
  }
});

test('document minimization is deterministic and preserves block structure', () => {
  const source: ParsedFirmDocument = {
    parserVersion: 1,
    sourceFile: 'synthetic.pdf',
    pageCount: 1,
    blocks: [
      block('p2-b1', 'D4 Main walls', 50, 700, 'heading'),
      block(
        'p2-b2',
        'Contact alex@example.com for further information.',
        50,
        680,
      ),
      block('p2-b3', '• Inspect the masonry', 50, 660, 'list'),
      block('p2-b4', 'NI', 500, 660, 'marker'),
    ],
  };
  source.blocks[0].repeatedAcrossPages = true;
  source.blocks[0].likelyPageFurniture = false;

  const first = minimizeParsedDocument(source);
  const second = minimizeParsedDocument(source);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.blocks.map(({ sourceBlockId, type, text }) => ({
      sourceBlockId,
      type,
      text,
    })),
    [
      { sourceBlockId: 'p2-b1', type: 'heading', text: 'D4 Main walls' },
      {
        sourceBlockId: 'p2-b2',
        type: 'paragraph',
        text: 'Contact [EMAIL] for further information.',
      },
      { sourceBlockId: 'p2-b3', type: 'list', text: '• Inspect the masonry' },
      { sourceBlockId: 'p2-b4', type: 'marker', text: 'NI' },
    ],
  );
  assert.equal(first.blocks[0].repeatedAcrossPages, true);
  assert.equal(first.blocks[0].likelyPageFurniture, false);
});

test('PII minimizer CLI reuses parser page syntax and output conventions', () => {
  assert.deepEqual(
    parsePiiMinimizerCliArguments([
      'report.pdf',
      '--pages',
      '2,5-7,10',
      '--output',
      'minimized.txt',
    ]),
    {
      inputPath: 'report.pdf',
      json: false,
      pages: [2, 5, 6, 7, 10],
      outputPath: 'minimized.txt',
    },
  );
  assert.deepEqual(
    parsePiiMinimizerCliArguments([
      'report.pdf',
      '--json',
      '--output',
      'minimized.json',
    ]),
    {
      inputPath: 'report.pdf',
      json: true,
      outputPath: 'minimized.json',
    },
  );
  assert.throws(
    () => parsePiiMinimizerCliArguments(['report.pdf', '--pages', '5-2']),
    /Invalid page range/,
  );
  assert.throws(
    () =>
      parsePiiMinimizerCliArguments([
        'report.pdf',
        '--json',
        '--output',
        'minimized.txt',
      ]),
    /\.json file extension/,
  );
});

test('CLI text and JSON contain only minimized content and preserve Unicode', () => {
  const heading = block('p1-b1', 'RICS Home Survey – Level 2', 50, 700, 'heading');
  heading.page = 1;
  const source: ParsedFirmDocument = {
    parserVersion: 1,
    sourceFile: 'Alex-Example-property.pdf',
    pageCount: 6,
    parsedPages: [1, 2],
    debugPages: [
      {
        page: 2,
        items: [
          {
            text: 'alex@example.com',
            x: 50,
            y: 680,
            width: 90,
            height: 10,
            fontSize: 10,
          },
        ],
      },
    ],
    blocks: [
      heading,
      block('p2-b1', "Client's name", 50, 700),
      block('p2-b2', 'Alex Example', 220, 700),
      block(
        'p2-b3',
        'Contact alex@example.com about the surveyor’s report.',
        50,
        680,
      ),
      block('p2-b4', '• Inspect the masonry ©', 50, 660, 'list'),
    ],
  };
  const minimized = minimizeParsedDocument(source);
  const text = formatPiiMinimizedDocument(minimized);
  const secondText = formatPiiMinimizedDocument(minimized);

  assert.equal(text, secondText);
  for (const expected of [
    'Pages in source: 6',
    'Parsed pages: 1, 2',
    'Page 1',
    '[heading]',
    'RICS Home Survey – Level 2',
    'Page 2',
    '[paragraph]',
    '[PERSON]',
    'Contact [EMAIL] about the surveyor’s report.',
    '• Inspect the masonry ©',
  ]) {
    assert.equal(text.includes(expected), true, expected);
  }
  for (const forbidden of [
    'Alex Example',
    'alex@example.com',
    'Alex-Example-property.pdf',
    'bounds',
    'font',
    'debugPages',
    'sourceItemCount',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }

  const json = serializePiiMinimizedDocument(minimized, true);
  assert.deepEqual(JSON.parse(json), minimized);
  for (const forbidden of [
    'Alex Example',
    'alex@example.com',
    'Alex-Example-property.pdf',
    'debugPages',
    '"bounds"',
    '"font"',
  ]) {
    assert.equal(json.includes(forbidden), false, forbidden);
  }
});

test('CLI parser errors do not echo sensitive input paths', () => {
  const error = new PdfParserError(
    'FILE_NOT_FOUND',
    'PDF file does not exist: C:\\Confidential\\Alex-Example.pdf',
  );
  assert.equal(piiMinimizerCliErrorMessage(error), 'Input PDF was not found.');
});
