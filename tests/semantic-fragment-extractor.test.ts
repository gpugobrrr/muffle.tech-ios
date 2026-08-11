import assert from 'node:assert/strict';
import test from 'node:test';

import type { ParsedDocumentBlockType } from '@/lib/onboarding/documents/parsed-document';
import type {
  PiiMinimizedBlock,
  PiiMinimizedDocument,
} from '@/lib/onboarding/documents/privacy/pii-minimized-document';
import {
  extractSemanticFragments,
  toFirmSemanticFragment,
} from '@/lib/onboarding/documents/semantic-fragment-extractor';

function block(
  sourceBlockId: string,
  page: number,
  type: ParsedDocumentBlockType,
  text: string,
  options: {
    repeatedAcrossPages?: boolean;
    likelyPageFurniture?: boolean;
  } = {},
): PiiMinimizedBlock {
  return {
    sourceBlockId,
    page,
    type,
    text,
    actions: [],
    ...options,
  };
}

function semanticDocument(): PiiMinimizedDocument {
  const placeholders = [
    '[PERSON]',
    '[ADDRESS]',
    '[EMAIL]',
    '[PHONE]',
    '[POSTCODE]',
    '[REFERENCE]',
    '[SIGNATURE]',
    '[PROFESSIONAL_ID]',
  ];
  return {
    minimizerVersion: 1,
    sourceParserVersion: 1,
    pageCount: 2,
    parsedPages: [1, 2],
    summary: {
      email: 1,
      phone: 1,
      postcode: 1,
      person_name: 1,
      postal_address: 1,
      report_reference: 1,
      signature: 1,
      professional_identifier: 1,
    },
    blocks: [
      block('p1-b1', 1, 'heading', 'Outside the property', {
        repeatedAcrossPages: true,
      }),
      block('p1-b2', 1, 'heading', 'D4 Main walls'),
      block(
        'p1-b3',
        1,
        'paragraph',
        'The main walls are of traditional masonry construction and are approximately 300mm thick.',
      ),
      block('p1-b4', 1, 'heading', 'Repeated report footer', {
        repeatedAcrossPages: true,
        likelyPageFurniture: true,
      }),
      block('p1-b5', 1, 'marker', 'D'),
      block('p1-b6', 1, 'heading', 'D5 Windows'),
      block(
        'p1-b7',
        1,
        'paragraph',
        'The windows are double-glazed timber units.',
      ),
      block('p1-b8', 1, 'paragraph', '1'),
      block('p1-b9', 1, 'paragraph', '...'),
      ...placeholders.map((text, index) =>
        block(`p1-b${10 + index}`, 1, 'paragraph', text),
      ),
      block('p1-b18', 1, 'heading', 'General observations'),
      block(
        'p1-b19',
        1,
        'list',
        '• Chimneys should be inspected during routine maintenance.',
      ),
      block('p2-b1', 2, 'heading', 'Inside the property'),
      block('p2-b2', 2, 'heading', 'E1 Roof structure'),
      block(
        'p2-b3',
        2,
        'paragraph',
        'The roof structure was inspected from the accessible roof space.',
      ),
      block('p2-b4', 2, 'heading', 'F1 Electricity'),
      block(
        'p2-b5',
        2,
        'paragraph',
        'The electrical installation should be tested by a competent person.',
      ),
      block(
        'p2-b6',
        2,
        'paragraph',
        'Contact [EMAIL] if further information is required.',
      ),
      block('p2-b7', 2, 'unknown', 'Unclassified parser evidence'),
      block('p2-b8', 2, 'marker', 'F'),
      block('p2-b9', 2, 'paragraph', '   '),
    ],
  };
}

test('extracts deterministic paragraph and list fragments with heading provenance', () => {
  const document = semanticDocument();
  const original = structuredClone(document);
  const fragments = extractSemanticFragments(document);

  assert.deepEqual(document, original);
  assert.deepEqual(extractSemanticFragments(document), fragments);
  assert.deepEqual(
    fragments.map(
      ({
        id,
        page,
        type,
        sectionHeading,
        elementHeading,
        text,
      }) => ({
        id,
        page,
        type,
        sectionHeading,
        elementHeading,
        text,
      }),
    ),
    [
      {
        id: 'sf-1-p1-b3',
        page: 1,
        type: 'paragraph',
        sectionHeading: 'Outside the property',
        elementHeading: 'D4 Main walls',
        text: 'The main walls are of traditional masonry construction and are approximately 300mm thick.',
      },
      {
        id: 'sf-1-p1-b7',
        page: 1,
        type: 'paragraph',
        sectionHeading: 'Outside the property',
        elementHeading: 'D5 Windows',
        text: 'The windows are double-glazed timber units.',
      },
      {
        id: 'sf-1-p1-b19',
        page: 1,
        type: 'list',
        sectionHeading: 'General observations',
        elementHeading: undefined,
        text: '• Chimneys should be inspected during routine maintenance.',
      },
      {
        id: 'sf-2-p2-b3',
        page: 2,
        type: 'paragraph',
        sectionHeading: 'Inside the property',
        elementHeading: 'E1 Roof structure',
        text: 'The roof structure was inspected from the accessible roof space.',
      },
      {
        id: 'sf-2-p2-b5',
        page: 2,
        type: 'paragraph',
        sectionHeading: 'Inside the property',
        elementHeading: 'F1 Electricity',
        text: 'The electrical installation should be tested by a competent person.',
      },
      {
        id: 'sf-2-p2-b6',
        page: 2,
        type: 'paragraph',
        sectionHeading: 'Inside the property',
        elementHeading: 'F1 Electricity',
        text: 'Contact [EMAIL] if further information is required.',
      },
    ],
  );

  assert.deepEqual(fragments[0].headingPath, [
    'Outside the property',
    'D4 Main walls',
  ]);
  assert.deepEqual(fragments[0].sourceBlockIds, [
    'p1-b1',
    'p1-b2',
    'p1-b3',
  ]);
});

test('excludes furniture, page numbers, markers, placeholders, and low-information blocks', () => {
  const fragments = extractSemanticFragments(semanticDocument());
  const serialized = JSON.stringify(fragments);
  const placeholders = [
    '[PERSON]',
    '[ADDRESS]',
    '[EMAIL]',
    '[PHONE]',
    '[POSTCODE]',
    '[REFERENCE]',
    '[SIGNATURE]',
    '[PROFESSIONAL_ID]',
  ];

  for (const excluded of [
    'Repeated report footer',
    'Unclassified parser evidence',
  ]) {
    assert.equal(serialized.includes(excluded), false, excluded);
  }
  for (const placeholder of placeholders) {
    assert.equal(
      fragments.some(({ text }) => text === placeholder),
      false,
      placeholder,
    );
  }
  assert.equal(
    fragments.some(
      ({ text }) =>
        text === 'Contact [EMAIL] if further information is required.',
    ),
    true,
  );
  assert.equal(fragments.some(({ text }) => text === '1'), false);
  assert.equal(fragments.some(({ text }) => text === 'D'), false);
  assert.equal(fragments.some(({ text }) => text === 'F'), false);
  assert.equal(serialized.includes('"bounds"'), false);
  assert.equal(serialized.includes('"font"'), false);
  assert.equal(serialized.includes('"actions"'), false);
  assert.equal(serialized.includes('"conceptId"'), false);
});

test('adapts provenance fragments to the existing retrieval input without mapping', () => {
  const [fragment] = extractSemanticFragments(semanticDocument());
  assert.deepEqual(toFirmSemanticFragment(fragment), {
    firmTerm: 'D4 Main walls',
    nearbyHeading: 'Outside the property',
    representativeText:
      'The main walls are of traditional masonry construction and are approximately 300mm thick.',
  });
});
