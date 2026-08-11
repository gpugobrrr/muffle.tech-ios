import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MUFFLE_ONTOLOGY_V1,
  serializeMuffleOntologyV1,
} from '@/domain/ontology/muffle-ontology.v1';
import { defaultCandidateRetriever } from '@/lib/onboarding/lexical-candidate-retriever';
import type {
  PiiMinimizedBlock,
  PiiMinimizedDocument,
} from '@/lib/onboarding/documents/privacy/pii-minimized-document';
import {
  collectOntologyTermEvidence,
  extractOntologyTermEvidence,
  generateOntologyConceptProposals,
  normalizeOntologySeedTerm,
  type OntologySeedDocument,
} from '@/lib/onboarding/documents/ontology-seed-proposals';

function block(
  id: string,
  page: number,
  type: PiiMinimizedBlock['type'],
  text: string,
  options: {
    repeatedAcrossPages?: boolean;
    likelyPageFurniture?: boolean;
  } = {},
): PiiMinimizedBlock {
  return {
    sourceBlockId: id,
    page,
    type,
    text,
    actions: [],
    ...options,
  };
}

function document(blocks: PiiMinimizedBlock[]): PiiMinimizedDocument {
  return {
    minimizerVersion: 1,
    sourceParserVersion: 1,
    pageCount: 6,
    parsedPages: [1, 2, 3, 4, 5, 6],
    blocks,
    summary: {
      email: 1,
      phone: 0,
      postcode: 0,
      person_name: 1,
      postal_address: 1,
      report_reference: 1,
      signature: 0,
      professional_identifier: 1,
    },
  };
}

function primarySource(): OntologySeedDocument {
  return {
    sourceDocumentId: 'source-1',
    document: document([
      block('p1-b1', 1, 'heading', 'Contents'),
      block('p1-b2', 1, 'heading', "Client's name"),
      block('p1-b3', 1, 'heading', 'Property address'),
      block('p1-b4', 1, 'heading', "Surveyor's name"),
      block('p1-b5', 1, 'heading', 'Inspection date'),
      block('p1-b6', 1, 'heading', 'Report reference number'),
      block('p1-b6a', 1, 'heading', "Client's name: [PERSON]"),
      block(
        'p1-b7',
        1,
        'heading',
        'RICS Home Survey – Level 2',
        {
          repeatedAcrossPages: true,
          likelyPageFurniture: true,
        },
      ),
      block('p1-b8', 1, 'paragraph', 'Alex Example alex@example.com'),
      block('p2-b1', 2, 'heading', 'Outside the property'),
      block('p2-b2', 2, 'heading', 'D4 Main walls'),
      block(
        'p2-b3',
        2,
        'paragraph',
        'The main walls are traditional masonry construction.',
      ),
      block('p2-b4', 2, 'heading', 'D5 Windows'),
      block('p2-b5', 2, 'heading', 'D6 Outside doors (including patio doors)'),
      block('p3-b1', 3, 'heading', 'Inside the property'),
      block('p3-b2', 3, 'heading', 'E1 Roof structure'),
      block('p3-b3', 3, 'heading', 'E3 Walls and partitions'),
      block('p4-b1', 4, 'heading', 'Services'),
      block('p4-b2', 4, 'heading', 'F1 Electricity'),
      block('p4-b3', 4, 'heading', 'F4 Heating'),
      block('p5-b1', 5, 'heading', 'Roof coverings'),
      block('p5-b2', 5, 'paragraph', 'Narrative is not a term heading.'),
      block('p6-b1', 6, 'paragraph', '1'),
    ]),
  };
}

test('normalizes structural codes without altering original evidence', () => {
  assert.equal(normalizeOntologySeedTerm('D5 Windows', true), 'windows');
  assert.equal(normalizeOntologySeedTerm('D5 Windows'), 'd5 windows');

  const evidence = extractOntologyTermEvidence(primarySource());
  const windows = evidence.find(
    ({ normalizedTerm }) => normalizedTerm === 'windows',
  );
  assert.equal(windows?.originalTerm, 'D5 Windows');
  assert.deepEqual(windows?.sourceBlockIds, ['p2-b4']);
});

test('extracts distinct element, section, and unknown structural evidence', () => {
  const evidence = extractOntologyTermEvidence(primarySource());
  const elements = evidence
    .filter(({ termType }) => termType === 'element')
    .map(({ normalizedTerm }) => normalizedTerm);

  assert.deepEqual(elements, [
    'main walls',
    'windows',
    'outside doors including patio doors',
    'roof structure',
    'walls and partitions',
    'electricity',
    'heating',
  ]);
  assert.equal(
    evidence.find(
      ({ originalTerm }) => originalTerm === 'Outside the property',
    )?.termType,
    'section',
  );
  assert.equal(
    evidence.find(({ originalTerm }) => originalTerm === 'D4 Main walls')
      ?.termType,
    'element',
  );
  assert.equal(
    evidence.find(({ originalTerm }) => originalTerm === 'Roof coverings')
      ?.termType,
    'unknown',
  );
});

test('excludes administrative headings, page furniture, and prose', () => {
  const serialized = JSON.stringify(
    extractOntologyTermEvidence(primarySource()),
  );
  for (const excluded of [
    'Contents',
    "Client's name",
    'Property address',
    "Surveyor's name",
    'Inspection date',
    'Report reference number',
    "Client's name: [PERSON]",
    'RICS Home Survey – Level 2',
    'Alex Example',
    'alex@example.com',
    'Narrative is not a term heading.',
  ]) {
    assert.equal(serialized.includes(excluded), false, excluded);
  }
});

test('groups exact normalized terms without merging distinct wall or roof semantics', () => {
  const proposals = generateOntologyConceptProposals(
    [primarySource()],
    MUFFLE_ONTOLOGY_V1,
    defaultCandidateRetriever,
  );
  const terms = proposals.map(({ normalizedTerm }) => normalizedTerm);

  assert.equal(terms.includes('main walls'), true);
  assert.equal(terms.includes('walls and partitions'), true);
  assert.equal(terms.includes('roof structure'), true);
  assert.equal(terms.includes('roof coverings'), true);
  assert.notEqual(
    proposals.find(({ normalizedTerm }) => normalizedTerm === 'main walls')
      ?.id,
    proposals.find(
      ({ normalizedTerm }) => normalizedTerm === 'walls and partitions',
    )?.id,
  );
});

test('surfaces existing lexical matches without approving novel terms', () => {
  const proposals = generateOntologyConceptProposals(
    [primarySource()],
    MUFFLE_ONTOLOGY_V1,
    defaultCandidateRetriever,
  );
  const walls = proposals.find(
    ({ normalizedTerm }) => normalizedTerm === 'main walls',
  );
  const windows = proposals.find(
    ({ normalizedTerm }) => normalizedTerm === 'windows',
  );

  assert.equal(
    walls?.existingConceptMatches.some(
      ({ conceptId }) => conceptId === 'building_element.external_wall',
    ),
    true,
  );
  assert.equal(walls?.status, 'candidate');
  assert.equal(windows?.status, 'candidate');
  assert.equal(
    windows?.existingConceptMatches.some(
      ({ conceptId, label }) =>
        conceptId.includes('window') || label.toLowerCase().includes('window'),
    ),
    false,
  );
});

test('aggregates exact terms across documents with deterministic provenance', () => {
  const secondSource: OntologySeedDocument = {
    sourceDocumentId: 'source-2',
    document: document([
      block('p1-b1', 1, 'heading', 'External elements'),
      block('p1-b2', 1, 'heading', 'A1 Windows'),
    ]),
  };
  const sources = [primarySource(), secondSource];
  const original = structuredClone(sources);
  const ontologyBefore = serializeMuffleOntologyV1();
  const evidence = collectOntologyTermEvidence(sources);
  const first = generateOntologyConceptProposals(
    sources,
    MUFFLE_ONTOLOGY_V1,
    defaultCandidateRetriever,
  );
  const second = generateOntologyConceptProposals(
    sources,
    MUFFLE_ONTOLOGY_V1,
    defaultCandidateRetriever,
  );
  const windows = first.find(
    ({ normalizedTerm }) => normalizedTerm === 'windows',
  );

  assert.equal(
    evidence.filter(({ normalizedTerm }) => normalizedTerm === 'windows')
      .length,
    2,
  );
  assert.equal(windows?.occurrences, 2);
  assert.equal(windows?.sourceDocumentCount, 2);
  assert.deepEqual(windows?.sourceTerms, ['A1 Windows', 'D5 Windows']);
  assert.deepEqual(
    windows?.evidence.map(({ sourceDocumentId }) => sourceDocumentId),
    ['source-1', 'source-2'],
  );
  assert.deepEqual(first, second);
  assert.deepEqual(sources, original);
  assert.equal(serializeMuffleOntologyV1(), ontologyBefore);
});

test('orders element proposals first and uses deterministic proposal IDs', () => {
  const proposals = generateOntologyConceptProposals(
    [primarySource()],
    MUFFLE_ONTOLOGY_V1,
    defaultCandidateRetriever,
  );
  const firstNonElement = proposals.findIndex(
    ({ termType }) => termType !== 'element',
  );

  assert.equal(
    proposals
      .slice(0, firstNonElement)
      .every(({ termType }) => termType === 'element'),
    true,
  );
  assert.equal(
    proposals.find(({ normalizedTerm }) => normalizedTerm === 'windows')?.id,
    'ontology-proposal:element:windows',
  );
});
