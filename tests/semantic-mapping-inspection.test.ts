import assert from 'node:assert/strict';
import test from 'node:test';

import { MUFFLE_ONTOLOGY_V1 } from '@/domain/ontology/muffle-ontology.v1';
import {
  SemanticMappingHttpError,
} from '@/lib/onboarding/llama-cpp-semantic-mapper';
import type { ParsedFirmDocument } from '@/lib/onboarding/documents/parsed-document';
import type { PiiMinimizedDocument } from '@/lib/onboarding/documents/privacy/pii-minimized-document';
import {
  toFirmSemanticFragment,
  type SemanticFragment,
} from '@/lib/onboarding/documents/semantic-fragment-extractor';
import { selectRetrievalEligibleFragments } from '@/lib/onboarding/documents/semantic-fragment-retrieval';
import {
  inspectFirmPdfSemanticMappings,
  type SemanticMappingInspectionDependencies,
  type SemanticMappingInspectionOutput,
} from '@/lib/onboarding/documents/semantic-mapping-inspection';
import type {
  CandidateConcept,
  SemanticMappingInput,
} from '@/lib/onboarding/semantic-mapping';

const CANDIDATE: CandidateConcept = {
  conceptId: 'building_element.external_wall',
  label: 'External wall',
  aliases: ['main wall'],
  description: 'The external wall building element.',
  score: 0.9,
  matchedTerms: ['wall'],
};

function fragment(
  block: number,
  text: string,
  options: {
    elementHeading?: string;
    sectionHeading?: string;
  } = {},
): SemanticFragment {
  return {
    id: `sf-1-p1-b${block}`,
    page: 1,
    type: 'paragraph',
    text,
    ...(options.sectionHeading
      ? { sectionHeading: options.sectionHeading }
      : {}),
    ...(options.elementHeading
      ? { elementHeading: options.elementHeading }
      : {}),
    headingPath: [
      ...(options.sectionHeading ? [options.sectionHeading] : []),
      ...(options.elementHeading ? [options.elementHeading] : []),
    ],
    sourceBlockIds: [`p1-b${block}`],
  };
}

const COMPLETE_FRAGMENTS = [
  fragment(1, 'Company name'),
  fragment(2, 'Example Surveying Ltd'),
  fragment(3, 'The main walls are traditional masonry.', {
    sectionHeading: 'Outside the property',
    elementHeading: 'D4 Main walls',
  }),
  fragment(4, 'Unknown terminology'),
  fragment(5, 'No candidates'),
  fragment(6, 'Mapper error'),
  fragment(7, 'Subsequent narrative'),
];

function inspectionDependencies(
  clockStep = 5,
): {
  dependencies: SemanticMappingInspectionDependencies;
  stages: string[];
  retrievalInputs: string[];
  mapperInputs: SemanticMappingInput[];
  returnedCandidateSets: CandidateConcept[][];
} {
  const stages: string[] = [];
  const retrievalInputs: string[] = [];
  const mapperInputs: SemanticMappingInput[] = [];
  const returnedCandidateSets: CandidateConcept[][] = [];
  let clock = 0;
  const parsed: ParsedFirmDocument = {
    parserVersion: 1,
    sourceFile: 'Alex-Example.pdf',
    pageCount: 6,
    parsedPages: [1],
    blocks: [
      {
        id: 'p1-b1',
        page: 1,
        type: 'paragraph',
        text: 'Alex Example alex@example.com JOB-SECRET-1 7654321',
      },
    ],
  };
  const minimized: PiiMinimizedDocument = {
    minimizerVersion: 1,
    sourceParserVersion: 1,
    pageCount: 6,
    parsedPages: [1],
    blocks: [],
    summary: {
      email: 1,
      phone: 0,
      postcode: 0,
      person_name: 1,
      postal_address: 0,
      report_reference: 1,
      signature: 0,
      professional_identifier: 1,
    },
  };

  return {
    stages,
    retrievalInputs,
    mapperInputs,
    returnedCandidateSets,
    dependencies: {
      async parseDocument(inputPath, options) {
        stages.push('parser');
        assert.equal(inputPath, 'report.pdf');
        assert.deepEqual(options.pages, [1]);
        return parsed;
      },
      minimizeDocument(document) {
        stages.push('pii');
        assert.strictEqual(document, parsed);
        return minimized;
      },
      extractFragments(document) {
        stages.push('extraction');
        assert.strictEqual(document, minimized);
        return [...COMPLETE_FRAGMENTS];
      },
      selectRetrievalFragments(fragments) {
        stages.push('eligibility');
        return selectRetrievalEligibleFragments(fragments);
      },
      adaptFragment(fragmentValue) {
        stages.push(`adapt:${fragmentValue.id}`);
        return toFirmSemanticFragment(fragmentValue);
      },
      retriever: {
        retrieve(input) {
          stages.push(`retrieve:${input.firmTerm}`);
          retrievalInputs.push(JSON.stringify(input));
          if (input.firmTerm === 'No candidates') return [];
          const candidates = [{ ...CANDIDATE }];
          returnedCandidateSets.push(candidates);
          return candidates;
        },
      },
      mapper: {
        async proposeMapping(input) {
          stages.push(`mapper:${input.fragment.firmTerm}`);
          mapperInputs.push(input);
          if (input.fragment.firmTerm === 'Mapper error') {
            throw new Error('Alex Example should never be serialized');
          }
          return {
            firmTerm: input.fragment.firmTerm,
            selectedConceptId:
              input.fragment.firmTerm === 'Unknown terminology'
                ? null
                : CANDIDATE.conceptId,
            confidence:
              input.fragment.firmTerm === 'Unknown terminology' ? 0.2 : 0.8,
            alternatives: [],
            rationale:
              input.fragment.firmTerm === 'Unknown terminology'
                ? 'No reliable candidate.'
                : 'Candidate is supported.',
          };
        },
      },
      ontology: MUFFLE_ONTOLOGY_V1,
      now: () => {
        clock += clockStep;
        return clock;
      },
    },
  };
}

function withoutTiming(
  output: SemanticMappingInspectionOutput,
): SemanticMappingInspectionOutput {
  return {
    ...output,
    summary: {
      ...output.summary,
      totalLatencyMs: 0,
      meanLatencyMs: null,
      medianLatencyMs: null,
    },
    results: output.results.map((result) => ({
      ...result,
      latencyMs: 0,
    })),
  };
}

test('orchestrates eligible fragments sequentially and preserves results', async () => {
  const fixture = inspectionDependencies();
  const output = await inspectFirmPdfSemanticMappings(
    'report.pdf',
    { pages: [1] },
    fixture.dependencies,
  );

  assert.deepEqual(fixture.stages.slice(0, 4), [
    'parser',
    'pii',
    'extraction',
    'eligibility',
  ]);
  assert.deepEqual(
    output.results.map(({ fragment }) => fragment.id),
    [
      'sf-1-p1-b3',
      'sf-1-p1-b4',
      'sf-1-p1-b5',
      'sf-1-p1-b6',
      'sf-1-p1-b7',
    ],
  );
  assert.deepEqual(
    output.results.map(({ status }) => status),
    ['resolved', 'unresolved', 'retrieval_empty', 'mapper_error', 'resolved'],
  );
  assert.equal(fixture.mapperInputs.length, 4);
  assert.equal(
    fixture.mapperInputs.some(({ fragment: input }) =>
      input.firmTerm.includes('Company name'),
    ),
    false,
  );
  assert.strictEqual(
    fixture.mapperInputs[0].candidates,
    fixture.returnedCandidateSets[0],
  );
  assert.deepEqual(output.results[0].candidates, [{ ...CANDIDATE }]);
  assert.deepEqual(output.results[0].proposal, {
    firmTerm: 'D4 Main walls',
    selectedConceptId: CANDIDATE.conceptId,
    confidence: 0.8,
    alternatives: [],
    rationale: 'Candidate is supported.',
  });
  assert.equal(output.results[1].proposal?.selectedConceptId, null);
  assert.equal(output.results[2].proposal, undefined);
  assert.deepEqual(output.results[3].error, {
    type: 'mapper_error',
    message: 'Mapper failed for this fragment.',
  });
  assert.equal(output.results[4].status, 'resolved');
  assert.deepEqual(output.results[0].fragment.sourceBlockIds, ['p1-b3']);
  assert.equal(output.results[0].fragment.page, 1);
  assert.equal(output.results[0].fragment.elementHeading, 'D4 Main walls');
  assert.deepEqual(output.source, {
    pagesInSource: 6,
    parsedPages: [1],
  });
  assert.deepEqual(output.summary, {
    completeFragments: 7,
    retrievalEligibleFragments: 5,
    mappingAttempts: 4,
    successfulProposals: 3,
    resolved: 2,
    unresolved: 1,
    retrievalEmpty: 1,
    errors: 1,
    totalLatencyMs: 20,
    meanLatencyMs: 5,
    medianLatencyMs: 5,
  });

  const serialized = JSON.stringify(output);
  for (const sensitive of [
    'Alex Example',
    'alex@example.com',
    'JOB-SECRET-1',
    '7654321',
    'Alex-Example.pdf',
  ]) {
    assert.equal(serialized.includes(sensitive), false, sensitive);
    assert.equal(
      fixture.retrievalInputs.some((input) => input.includes(sensitive)),
      false,
      sensitive,
    );
  }
});

test('is structurally deterministic apart from observational timing', async () => {
  const firstFixture = inspectionDependencies(5);
  const secondFixture = inspectionDependencies(17);
  const first = await inspectFirmPdfSemanticMappings(
    'report.pdf',
    { pages: [1] },
    firstFixture.dependencies,
  );
  const second = await inspectFirmPdfSemanticMappings(
    'report.pdf',
    { pages: [1] },
    secondFixture.dependencies,
  );

  assert.deepEqual(withoutTiming(first), withoutTiming(second));
  assert.deepEqual(COMPLETE_FRAGMENTS[2].sourceBlockIds, ['p1-b3']);
});

test('treats localhost transport failure as systemic', async () => {
  const fixture = inspectionDependencies();
  fixture.dependencies.mapper = {
    async proposeMapping() {
      throw new SemanticMappingHttpError(
        0,
        'http://127.0.0.1:8080/v1/chat/completions',
      );
    },
  };

  await assert.rejects(
    inspectFirmPdfSemanticMappings(
      'report.pdf',
      { pages: [1] },
      fixture.dependencies,
    ),
    SemanticMappingHttpError,
  );
});
