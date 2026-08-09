import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  assertSufficientSelectableText,
  groupTextItemsIntoLines,
  normalizeExtractedText,
  reconstructParsedDocument,
  reconstructPageBlocks,
  type PdfPageEvidence,
} from '../src/lib/onboarding/documents/pdf-layout';
import {
  formatParsedFirmDocument,
  parsePageSelection,
  parsePdfParserCliArguments,
} from '../src/lib/onboarding/documents/pdf-parser-cli';
import {
  parseFirmPdf,
  PdfParserError,
  validateRequestedPages,
  validatePdfFilePath,
} from '../src/lib/onboarding/documents/pdf-parser';

function item(
  text: string,
  x: number,
  y: number,
  fontSize = 10,
  width = text.length * fontSize * 0.5,
  sourceOrder?: number,
) {
  return {
    text,
    x,
    y,
    width,
    height: fontSize,
    fontSize,
    fontFamily: 'Helvetica',
    ...(sourceOrder !== undefined ? { sourceOrder } : {}),
  };
}

function syntheticPages(): PdfPageEvidence[] {
  return [
    {
      page: 1,
      width: 612,
      height: 792,
      items: [
        item('Synthetic Survey', 50, 770),
        item('D4 Main Walls', 50, 700, 18),
        item('The main walls are of traditional cavity wall', 50, 670),
        item('construction with a rendered finish.', 50, 658),
        item('Synthetic footer', 50, 25, 8),
      ],
    },
    {
      page: 2,
      width: 612,
      height: 792,
      items: [
        item('Synthetic Survey', 50, 770),
        item('E1 Roof Coverings', 50, 700, 18),
        item('The roof covering is formed in plain tiles.', 50, 670),
        item('Synthetic footer', 50, 25, 8),
      ],
    },
  ];
}

function pdfString(value: string): string {
  return value.replace(/([\\()])/g, '\\$1');
}

function pageStream(
  heading: string,
  bodyLines: readonly string[],
  pageNumber: number,
): string {
  return [
    'BT /F1 10 Tf 50 770 Td (Synthetic Survey) Tj ET',
    `BT /F1 18 Tf 50 700 Td (${pdfString(heading)}) Tj ET`,
    `BT /F1 10 Tf 50 670 Td (${pdfString(bodyLines[0])}) Tj`,
    ...bodyLines.slice(1).map((line) => `0 -12 Td (${pdfString(line)}) Tj`),
    'ET',
    'BT /F1 8 Tf 50 25 Td (Synthetic footer) Tj ET',
    `BT /F1 8 Tf 550 25 Td (${pageNumber}) Tj ET`,
  ].join('\n');
}

function buildSyntheticPdf(pageCount = 2): Uint8Array {
  const headings = [
    'D4 Main Walls',
    'E1 Roof Coverings',
    'F1 Windows',
    'G1 Doors',
    'H1 Services',
  ];
  const streams = Array.from({ length: pageCount }, (_, index) =>
    pageStream(
      headings[index] ?? `Section ${index + 1}`,
      [`Synthetic selectable text for source page ${index + 1}.`],
      index + 1,
    ),
  );
  const pageObjectNumbers = Array.from(
    { length: pageCount },
    (_, index) => index + 3,
  );
  const fontObjectNumber = pageCount + 3;
  const firstContentObjectNumber = fontObjectNumber + 1;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjectNumbers
      .map((number) => `${number} 0 R`)
      .join(' ')}] /Count ${pageCount} >>`,
    ...pageObjectNumbers.map(
      (_, index) =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${firstContentObjectNumber + index} 0 R >>`,
    ),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...streams.map(
      (stream) =>
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    ),
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'binary');
}

test('PDF layout reconstruction preserves pages, paragraphs, headings, and stable IDs', () => {
  const pages = syntheticPages();
  const firstLines = groupTextItemsIntoLines(pages[0].items);
  assert.equal(firstLines[0].text, 'Synthetic Survey');
  assert.equal(normalizeExtractedText('  main   walls \n'), 'main walls');

  const firstBlocks = reconstructPageBlocks(pages[0]);
  assert.equal(firstBlocks.find((block) => block.text === 'D4 Main Walls')?.type, 'heading');
  assert.equal(
    firstBlocks.some(
      (block) =>
        block.type === 'paragraph' &&
        block.text ===
          'The main walls are of traditional cavity wall construction with a rendered finish.',
    ),
    true,
  );

  const document = reconstructParsedDocument('synthetic.pdf', pages);
  assert.equal(document.pageCount, 2);
  assert.deepEqual(
    document.blocks.slice(0, 3).map((block) => block.id),
    ['p1-b1', 'p1-b2', 'p1-b3'],
  );
  const repeatedHeader = document.blocks.filter(
    (block) => block.text === 'Synthetic Survey',
  );
  assert.equal(repeatedHeader.length, 2);
  assert.equal(repeatedHeader.every((block) => block.repeatedAcrossPages), true);
  assert.equal(repeatedHeader.every((block) => block.likelyPageFurniture), true);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(document)));
  assert.equal(JSON.stringify(document).includes('building_element.'), false);
  assert.equal(JSON.stringify(document).includes('conceptId'), false);
});

test('widely separated text is not destructively merged across columns', () => {
  const lines = groupTextItemsIntoLines([
    item('Left column', 50, 700),
    item('Right column', 350, 700),
  ]);
  assert.deepEqual(
    lines.map((line) => line.text),
    ['Left column', 'Right column'],
  );
});

test('wrapped list continuations join without merging separate bullets or paragraphs', () => {
  const continued = reconstructPageBlocks({
    page: 1,
    width: 612,
    height: 792,
    items: [
      item(
        '• We inspect roofs and surfaces from ground level and,',
        50,
        700,
        10,
        undefined,
        0,
      ),
      item(
        'if necessary, from neighbouring public property.',
        60,
        688,
        10,
        undefined,
        1,
      ),
    ],
  });
  assert.equal(continued.length, 1);
  assert.equal(continued[0].type, 'list');
  assert.equal(
    continued[0].text,
    '• We inspect roofs and surfaces from ground level and, if necessary, from neighbouring public property.',
  );
  assert.equal(continued[0].sourceItemCount, 2);
  assert.equal(continued[0].bounds?.x, 50);
  assert.equal(continued[0].id, 'p1-b1');

  const separateBullets = reconstructPageBlocks({
    page: 1,
    width: 612,
    height: 792,
    items: [
      item('• First item', 50, 700, 10, undefined, 0),
      item('• Second item', 50, 688, 10, undefined, 1),
    ],
  });
  assert.deepEqual(
    separateBullets.map((block) => block.type),
    ['list', 'list'],
  );

  const separateParagraph = reconstructPageBlocks({
    page: 1,
    width: 612,
    height: 792,
    items: [
      item('• A short item', 50, 700, 10, undefined, 0),
      item('This is a visually separate paragraph.', 50, 650, 10, undefined, 1),
    ],
  });
  assert.deepEqual(
    separateParagraph.map((block) => block.type),
    ['list', 'paragraph'],
  );
});

test('compact geometrically isolated markers remain separate structural blocks', () => {
  for (const markerText of ['2', 'NI']) {
    const blocks = reconstructPageBlocks({
      page: 3,
      width: 612,
      height: 792,
      items: [
        item(markerText, 50, 700, 10, markerText.length * 6, 0),
        item('Descriptive text starts in the body column.', 100, 700, 10, 220, 1),
      ],
    });
    assert.equal(blocks[0].type, 'marker');
    assert.equal(blocks[0].text, markerText);
    assert.equal(blocks[1].text, 'Descriptive text starts in the body column.');
    assert.equal(blocks[0].id, 'p3-b1');
    assert.equal(blocks[1].id, 'p3-b2');
  }

  const standalonePageNumber = reconstructPageBlocks({
    page: 3,
    width: 612,
    height: 792,
    items: [item('3', 550, 25)],
  });
  assert.notEqual(standalonePageNumber[0].type, 'marker');

  const attachedHeading = reconstructPageBlocks({
    page: 3,
    width: 612,
    height: 792,
    items: [
      item('D4', 50, 700, 18, 20),
      item('Main Walls', 74, 700, 18, 90),
      item('Body text follows below.', 50, 670),
    ],
  });
  assert.equal(attachedHeading[0].type, 'heading');
  assert.equal(attachedHeading[0].text, 'D4 Main Walls');

  const numberedList = reconstructPageBlocks({
    page: 3,
    width: 612,
    height: 792,
    items: [item('1. First numbered item', 50, 700)],
  });
  assert.equal(numberedList[0].type, 'list');
});

test('form-field gaps may join sentence continuations without collapsing columns', () => {
  const visualSourceOrderItems = [
    item('Please refer to your report received on the', 50, 700, 10, 280, 0),
    item('for a full', 500, 700, 10, 45, 1),
    item('list of exclusions.', 50, 688, 10, 85, 2),
  ];
  const nonVisualSourceOrderItems = [
    item('for a full', 500, 700, 10, 45, 0),
    item(
      'Please refer to your report received on the',
      50,
      700,
      10,
      280,
      5,
    ),
    item('list of exclusions.', 50, 688, 10, 85, 6),
  ];
  const visuallyOrderedLines = groupTextItemsIntoLines(
    nonVisualSourceOrderItems,
    700,
  );
  assert.deepEqual(
    visuallyOrderedLines.map((line) => line.text),
    [
      'Please refer to your report received on the for a full list of exclusions.',
    ],
  );

  const wrappedFormSentence = reconstructPageBlocks({
    page: 4,
    width: 700,
    height: 792,
    items: visualSourceOrderItems,
  });
  assert.equal(wrappedFormSentence.length, 1);
  assert.equal(
    wrappedFormSentence[0].text,
    'Please refer to your report received on the for a full list of exclusions.',
  );
  assert.equal(wrappedFormSentence[0].page, 4);
  assert.equal(wrappedFormSentence[0].id, 'p4-b1');
  assert.equal(wrappedFormSentence[0].sourceItemCount, 3);
  assert.equal(wrappedFormSentence[0].bounds?.x, 50);
  assert.equal(wrappedFormSentence[0].bounds?.y, 688);
  assert.equal(wrappedFormSentence[0].bounds?.width, 495);
  assert.equal(wrappedFormSentence[0].bounds?.height, 22);
  assert.equal(wrappedFormSentence[0].font?.size, 10);

  const secondFormSentence = reconstructPageBlocks({
    page: 4,
    width: 700,
    height: 792,
    items: [
      item('The certificate was issued on the', 50, 700, 10, 400, 0),
      item('and remains', 500, 700, 10, 55, 1),
      item('valid for twelve months.', 50, 688, 10, 115, 2),
    ],
  });
  assert.equal(secondFormSentence.length, 1);
  assert.equal(
    secondFormSentence[0].text,
    'The certificate was issued on the and remains valid for twelve months.',
  );

  const columns = groupTextItemsIntoLines(
    [
      item('Substantial unfinished prose in the left column', 50, 700, 10, 240, 0),
      item('right heading', 500, 700, 10, 70, 1),
      item('continues on the left.', 50, 688, 10, 110, 2),
      item('right column continues', 500, 688, 10, 110, 3),
    ],
    700,
  );
  assert.deepEqual(
    columns.map((line) => line.text),
    [
      'Substantial unfinished prose in the left column',
      'right heading',
      'continues on the left.',
      'right column continues',
    ],
  );

  const safetyCases = [
    {
      left: 'External walls are traditional masonry.',
      right: 'Roof coverings',
    },
    { left: 'Client name', right: 'John Smith' },
    { left: 'Element no.', right: 'Element name' },
    { left: 'Condition ratings', right: 'Reference' },
    { left: 'A terminated sentence.', right: 'continues elsewhere' },
  ];
  for (const { left, right } of safetyCases) {
    const separated = groupTextItemsIntoLines(
      [
        item(left, 50, 700, 10, Math.max(70, left.length * 5), 0),
        item(right, 500, 700, 10, Math.max(45, right.length * 5), 2),
        item('continuation text.', 50, 688, 10, 90, 3),
      ],
      700,
    );
    assert.equal(separated.length, 3, `${left} / ${right}`);
  }
});

test('Unicode text survives parsed blocks, formatted output, and JSON serialization', () => {
  const document = reconstructParsedDocument('unicode.pdf', [
    {
      page: 1,
      width: 612,
      height: 792,
      items: [
        item('RICS Home Survey – Level 2', 50, 700),
        item('surveyor’s note', 50, 680),
        item('• item ©', 50, 660),
      ],
    },
  ]);
  const formatted = formatParsedFirmDocument(document);
  const json = JSON.stringify(document);
  for (const value of [
    'RICS Home Survey – Level 2',
    'surveyor’s note',
    '• item ©',
  ]) {
    assert.equal(formatted.includes(value), true);
    assert.equal(json.includes(value), true);
  }
  assert.equal(json.includes('ΓÇ'), false);
});

test('PDF parser CLI arguments and output remain deterministic', () => {
  assert.deepEqual(parsePdfParserCliArguments(['report.pdf', '--json']), {
    inputPath: 'report.pdf',
    json: true,
    debug: false,
  });
  assert.deepEqual(
    parsePdfParserCliArguments([
      '--debug',
      'report.pdf',
      '--output',
      'result.json',
    ]),
    {
      inputPath: 'report.pdf',
      json: false,
      debug: true,
      outputPath: 'result.json',
    },
  );
  assert.throws(
    () => parsePdfParserCliArguments([]),
    /Usage: npm run onboarding:parse-pdf/,
  );
  const output = formatParsedFirmDocument(
    reconstructParsedDocument('synthetic.pdf', syntheticPages()),
    true,
  );
  assert.match(output, /Parsed: synthetic\.pdf/);
  assert.match(output, /\[heading\]\nD4 Main Walls/);
  assert.match(output, /bounds=/);
});

test('page selections support pages, ranges, mixed values, and normalization', () => {
  assert.deepEqual(parsePageSelection('5'), [5]);
  assert.deepEqual(parsePageSelection('5,10,14'), [5, 10, 14]);
  assert.deepEqual(parsePageSelection('5-8'), [5, 6, 7, 8]);
  assert.deepEqual(parsePageSelection('2,5-7,10'), [2, 5, 6, 7, 10]);
  assert.deepEqual(parsePageSelection('10,5,5,7-9'), [5, 7, 8, 9, 10]);
  assert.deepEqual(
    parsePdfParserCliArguments([
      'report.pdf',
      '--debug',
      '--pages',
      '5,10',
      '--json',
    ]),
    {
      inputPath: 'report.pdf',
      json: true,
      debug: true,
      pages: [5, 10],
    },
  );
});

test('invalid page selections fail explicitly', () => {
  for (const selection of ['0', '-1']) {
    assert.throws(
      () => parsePageSelection(selection),
      /page numbers must be >= 1/,
    );
  }
  assert.throws(() => parsePageSelection('abc'), /Invalid page selection value/);
  assert.throws(() => parsePageSelection('5,,7'), /Invalid page selection/);
  assert.throws(() => parsePageSelection('10-5'), /Invalid page range: 10-5/);
  assert.throws(() => parsePageSelection('1-2-3'), /Invalid page range/);
  assert.throws(
    () => parsePdfParserCliArguments(['report.pdf', '--pages']),
    /--pages requires a page selection/,
  );
  assert.throws(
    () => validateRequestedPages([52], 47),
    /Requested page 52 but the PDF contains 47 pages/,
  );
});

test('Parser v1 rejects missing, non-PDF, and textless inputs clearly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'muffle-pdf-parser-'));
  try {
    await assert.rejects(
      () => validatePdfFilePath(join(directory, 'missing.pdf')),
      (error: unknown) =>
        error instanceof PdfParserError && error.code === 'FILE_NOT_FOUND',
    );
    await assert.rejects(
      () => validatePdfFilePath(directory),
      (error: unknown) =>
        error instanceof PdfParserError && error.code === 'NOT_A_FILE',
    );
    const textPath = join(directory, 'not-a-pdf.txt');
    await writeFile(textPath, 'not a PDF');
    await assert.rejects(
      () => validatePdfFilePath(textPath),
      (error: unknown) =>
        error instanceof PdfParserError && error.code === 'NOT_A_PDF',
    );
    assert.throws(
      () =>
        assertSufficientSelectableText([
          { page: 1, width: 612, height: 792, items: [item('1', 50, 25)] },
        ]),
      /OCR is not implemented/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Parser v1 reads a synthetic selectable-text PDF without semantic mapping', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'muffle-pdf-parser-'));
  try {
    const pdfPath = join(directory, 'synthetic-report.pdf');
    await writeFile(pdfPath, buildSyntheticPdf());
    const document = await parseFirmPdf(pdfPath);
    assert.equal(document.sourceFile, 'synthetic-report.pdf');
    assert.equal(document.pageCount, 2);
    assert.equal(
      document.blocks.some(
        (block) => block.type === 'heading' && block.text === 'D4 Main Walls',
      ),
      true,
    );
    assert.equal(JSON.stringify(document).includes('conceptId'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Parser v1 extracts only requested source pages without renumbering', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'muffle-pdf-parser-'));
  try {
    const pdfPath = join(directory, 'five-page-report.pdf');
    await writeFile(pdfPath, buildSyntheticPdf(5));
    const selected = await parseFirmPdf(pdfPath, { pages: [4, 2, 2] });
    assert.equal(selected.pageCount, 5);
    assert.deepEqual(selected.parsedPages, [2, 4]);
    assert.deepEqual(
      [...new Set(selected.blocks.map((block) => block.page))],
      [2, 4],
    );
    assert.equal(
      selected.blocks.every(
        (block) => block.id.startsWith(`p${block.page}-`),
      ),
      true,
    );
    assert.equal(
      selected.blocks
        .filter((block) => block.text === 'Synthetic Survey')
        .every(
          (block) =>
            block.repeatedAcrossPages && block.likelyPageFurniture,
        ),
      true,
    );

    const json = JSON.stringify(selected);
    assert.deepEqual(JSON.parse(json).parsedPages, [2, 4]);
    const debugOutput = formatParsedFirmDocument(selected, true);
    assert.match(debugOutput, /Pages in source: 5/);
    assert.match(debugOutput, /Parsed pages: 2, 4/);
    assert.match(debugOutput, /Page 2/);
    assert.match(debugOutput, /Page 4/);
    assert.doesNotMatch(debugOutput, /Page [135]\b/);

    await assert.rejects(
      () => parseFirmPdf(pdfPath, { pages: [6] }),
      /Requested page 6 but the PDF contains 5 pages/,
    );

    const complete = await parseFirmPdf(pdfPath);
    assert.equal(complete.pageCount, 5);
    assert.equal(complete.parsedPages, undefined);
    assert.deepEqual(
      [...new Set(complete.blocks.map((block) => block.page))],
      [1, 2, 3, 4, 5],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
