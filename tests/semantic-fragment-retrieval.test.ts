import assert from 'node:assert/strict';
import test from 'node:test';

import type { PiiMinimizedDocument } from '@/lib/onboarding/documents/privacy/pii-minimized-document';
import {
  extractSemanticFragments,
  type SemanticFragment,
} from '@/lib/onboarding/documents/semantic-fragment-extractor';
import {
  isSemanticFragmentRetrievalEligible,
  selectRetrievalEligibleFragments,
  toRetrievalFirmSemanticFragments,
} from '@/lib/onboarding/documents/semantic-fragment-retrieval';

function fragment(
  id: string,
  page: number,
  text: string,
  options: {
    type?: 'paragraph' | 'list';
    sectionHeading?: string;
    elementHeading?: string;
    sourceBlockId?: string;
  } = {},
): SemanticFragment {
  const headingPath = [
    ...(options.sectionHeading ? [options.sectionHeading] : []),
    ...(options.elementHeading ? [options.elementHeading] : []),
  ];
  return {
    id,
    page,
    type: options.type ?? 'paragraph',
    text,
    ...(options.sectionHeading
      ? { sectionHeading: options.sectionHeading }
      : {}),
    ...(options.elementHeading
      ? { elementHeading: options.elementHeading }
      : {}),
    headingPath,
    sourceBlockIds: [options.sourceBlockId ?? id.replace(/^sf-\d+-/, '')],
  };
}

test('excludes explicit administrative labels and inline placeholder values', () => {
  const labels = [
    'Property address',
    "Client's name",
    'Client name',
    'Consultation date',
    'Consultation date (if applicable)',
    'Inspection date',
    'Date of the inspection',
    "Surveyor's name",
    'Surveyor name',
    "Surveyor's RICS number",
    'RICS number',
    'Report reference number',
    'Report reference',
    'Company name',
    'Phone number',
    'Telephone',
    'Email',
    'Email address',
    "Surveyor's address",
    'Website',
    'Signature',
  ];
  const inlineValues = [
    "Client's name: [PERSON]",
    'Property address: [ADDRESS]',
    'Report reference number: [REFERENCE]',
    "Surveyor's RICS number: [PROFESSIONAL_ID]",
    'Signature: [SIGNATURE]',
  ];
  const fragments = [...labels, ...inlineValues].map((text, index) =>
    fragment(`sf-1-p1-b${index + 1}`, 1, text),
  );

  assert.deepEqual(selectRetrievalEligibleFragments(fragments), []);
  assert.equal(
    fragments.every(
      (candidate) => !isSemanticFragmentRetrievalEligible(candidate),
    ),
    true,
  );
});

test('excludes only structurally adjacent administrative values', () => {
  const fragments = [
    fragment('sf-1-p1-b1', 1, 'Inspection date'),
    fragment('sf-1-p1-b2', 1, '15 March 2026'),
    fragment('sf-1-p1-b3', 1, 'Company name'),
    fragment('sf-1-p1-b4', 1, 'Example Surveying Ltd'),
    fragment('sf-1-p1-b5', 1, 'Website'),
    fragment('sf-1-p1-b6', 1, 'https://www.rics.org'),
    fragment(
      'sf-1-p1-b7',
      1,
      'The roof was inspected on 15 March 2026.',
    ),
    fragment(
      'sf-1-p1-b8',
      1,
      'The contractor was Example Roofing Ltd and repairs were incomplete.',
    ),
    fragment(
      'sf-1-p1-b9',
      1,
      'See https://www.rics.org for relevant public guidance.',
    ),
  ];

  assert.deepEqual(
    selectRetrievalEligibleFragments(fragments).map(({ text }) => text),
    [
      'The roof was inspected on 15 March 2026.',
      'The contractor was Example Roofing Ltd and repairs were incomplete.',
      'See https://www.rics.org for relevant public guidance.',
    ],
  );
});

test('does not pair administrative labels across pages or heading changes', () => {
  const fragments = [
    fragment('sf-1-p1-b1', 1, 'Inspection date', {
      sectionHeading: 'Property details',
    }),
    fragment('sf-2-p2-b1', 2, 'Ordinary page-two narrative.', {
      sectionHeading: 'Property details',
    }),
    fragment('sf-2-p2-b2', 2, 'Company name', {
      sectionHeading: 'Property details',
    }),
    fragment('sf-2-p2-b3', 2, 'Building construction narrative.', {
      sectionHeading: 'Outside the property',
    }),
    fragment('sf-2-p2-b4', 2, 'Website', {
      sectionHeading: 'Outside the property',
    }),
    fragment('sf-2-p2-b5', 2, 'https://www.rics.org', {
      type: 'list',
      sectionHeading: 'Outside the property',
    }),
    fragment('sf-2-p2-b6', 2, 'Phone number', {
      sectionHeading: 'Outside the property',
    }),
    fragment('sf-2-p2-b8', 2, 'Narrative after a structural block gap.', {
      sectionHeading: 'Outside the property',
    }),
  ];

  assert.deepEqual(
    selectRetrievalEligibleFragments(fragments).map(({ text }) => text),
    [
      'Ordinary page-two narrative.',
      'Building construction narrative.',
      'https://www.rics.org',
      'Narrative after a structural block gap.',
    ],
  );
});

test('keeps domain, legal, uncertain, and meaningful placeholder prose in order', () => {
  const fragments = [
    fragment(
      'sf-3-p3-b3',
      3,
      'The main walls are of traditional masonry construction.',
      {
        sectionHeading: 'Outside the property',
        elementHeading: 'D4 Main walls',
      },
    ),
    fragment(
      'sf-4-p4-b5',
      4,
      'The electrical installation should be tested by a competent person.',
      {
        sectionHeading: 'Inside the property',
        elementHeading: 'F1 Electricity',
      },
    ),
    fragment(
      'sf-5-p5-b2',
      5,
      'The surveyor does not act as a legal adviser. Further investigation may be recommended.',
    ),
    fragment('sf-5-p5-b3', 5, 'An uncertain but meaningful paragraph.'),
    fragment(
      'sf-5-p5-b4',
      5,
      'Contact [EMAIL] if further information is required.',
    ),
  ];
  const original = structuredClone(fragments);
  const selected = selectRetrievalEligibleFragments(fragments);

  assert.deepEqual(fragments, original);
  assert.deepEqual(selectRetrievalEligibleFragments(fragments), selected);
  assert.deepEqual(
    selected.map(({ id }) => id),
    fragments.map(({ id }) => id),
  );
  assert.strictEqual(selected[0], fragments[0]);
  assert.deepEqual(selected[0].headingPath, fragments[0].headingPath);
  assert.deepEqual(selected[0].sourceBlockIds, fragments[0].sourceBlockIds);
});

test('complete extraction retains administrative audit fragments before filtering', () => {
  const document: PiiMinimizedDocument = {
    minimizerVersion: 1,
    sourceParserVersion: 1,
    pageCount: 1,
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
      {
        sourceBlockId: 'p1-b1',
        page: 1,
        type: 'paragraph',
        text: 'Inspection date',
        actions: [],
      },
      {
        sourceBlockId: 'p1-b2',
        page: 1,
        type: 'paragraph',
        text: '15 March 2026',
        actions: [],
      },
      {
        sourceBlockId: 'p1-b3',
        page: 1,
        type: 'paragraph',
        text: 'Meaningful survey narrative.',
        actions: [],
      },
    ],
  };
  const complete = extractSemanticFragments(document);

  assert.deepEqual(
    complete.map(({ text }) => text),
    ['Inspection date', '15 March 2026', 'Meaningful survey narrative.'],
  );
  assert.deepEqual(
    selectRetrievalEligibleFragments(complete).map(({ text }) => text),
    ['Meaningful survey narrative.'],
  );
});

test('adapts only eligible fragments to the existing retrieval contract', () => {
  const fragments = [
    fragment('sf-1-p1-b1', 1, 'Property address'),
    fragment(
      'sf-3-p3-b3',
      3,
      'The main walls are of traditional masonry construction.',
      {
        sectionHeading: 'Outside the property',
        elementHeading: 'D4 Main walls',
      },
    ),
  ];

  assert.deepEqual(toRetrievalFirmSemanticFragments(fragments), [
    {
      firmTerm: 'D4 Main walls',
      nearbyHeading: 'Outside the property',
      representativeText:
        'The main walls are of traditional masonry construction.',
    },
  ]);
});
