import assert from 'node:assert/strict';
import test from 'node:test';

import { MUFFLE_ONTOLOGY_V1 } from '../src/domain/ontology/muffle-ontology.v1';
import {
  LexicalCandidateRetriever,
} from '../src/lib/onboarding/lexical-candidate-retriever';
import {
  LlamaCppSemanticMapper,
  NonCandidateConceptError,
  SemanticMappingHttpError,
  SemanticMappingOutputError,
  validateMappingProposal,
} from '../src/lib/onboarding/llama-cpp-semantic-mapper';
import {
  aggregateBenchmarkResults,
  buildRetrievalBenchmarkResult,
  classifyMapperError,
  comparePromptResults,
  expectedConceptRank,
} from '../src/lib/onboarding/semantic-mapping-benchmark';
import { SEMANTIC_MAPPING_BENCHMARK_V1 } from '../src/lib/onboarding/semantic-mapping-benchmark-v1';
import { buildSemanticMappingPrompt } from '../src/lib/onboarding/semantic-mapping-prompt';
import {
  benchmarkCaseClassification,
  createBenchmarkProgressReporter,
  formatElapsed,
  formatLatency,
} from '../src/lib/onboarding/semantic-mapping-benchmark-progress';
import {
  SEMANTIC_MAPPING_FIXTURES,
} from '../src/lib/onboarding/semantic-mapping-fixtures';
import type { CandidateConcept } from '../src/lib/onboarding/semantic-mapping';

function candidateFor(conceptId: string): CandidateConcept {
  const concept = MUFFLE_ONTOLOGY_V1.concepts.find(
    (candidate) => candidate.id === conceptId,
  );
  assert.ok(concept);
  return {
    conceptId: concept.id,
    label: concept.label,
    aliases: concept.aliases ?? [],
    description: concept.description,
    score: 1,
    matchedTerms: [],
  };
}

const externalWallCandidate = candidateFor(
  'building_element.external_wall',
);

function modelResponse(proposal: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(proposal) } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

test('lexical retrieval deterministically ranks the existing external-wall concept', () => {
  const retriever = new LexicalCandidateRetriever();
  const first = retriever.retrieve(
    SEMANTIC_MAPPING_FIXTURES.obviousPositive,
    MUFFLE_ONTOLOGY_V1,
  );
  const second = retriever.retrieve(
    SEMANTIC_MAPPING_FIXTURES.obviousPositive,
    MUFFLE_ONTOLOGY_V1,
  );

  assert.deepEqual(first, second);
  assert.equal(first.length, 5);
  assert.equal(first[0]?.conceptId, 'building_element.external_wall');
  assert.ok(first[0]?.score > 0);
});

test('ontology-supported vocabulary resolves to the same concept', () => {
  const retriever = new LexicalCandidateRetriever();
  const candidates = retriever.retrieve(
    SEMANTIC_MAPPING_FIXTURES.ontologyVocabularyPositive,
    MUFFLE_ONTOLOGY_V1,
  );
  assert.equal(candidates[0]?.conceptId, 'building_element.external_wall');
});

test('unresolved terminology can be constrained to unrelated building-element candidates', () => {
  const unrelatedBuildingElementCandidates = [candidateFor('building_element')];
  assert.equal(SEMANTIC_MAPPING_FIXTURES.unresolvedNegative.firmTerm, 'Tenure');
  assert.deepEqual(
    unrelatedBuildingElementCandidates.map((candidate) => candidate.conceptId),
    ['building_element'],
  );

  const proposal = validateMappingProposal(
    {
      firmTerm: 'Tenure',
      selectedConceptId: null,
      confidence: 0,
      alternatives: [],
      rationale: 'No supplied building-element candidate describes tenure.',
    },
    unrelatedBuildingElementCandidates,
  );
  assert.equal(proposal.selectedConceptId, null);
});

test('mapping validation rejects a hallucinated ontology ID', () => {
  assert.throws(
    () =>
      validateMappingProposal(
        {
          firmTerm: 'Main Walls',
          selectedConceptId: 'property.tenure',
          confidence: 0.95,
          alternatives: [],
          rationale: 'Invented concept.',
        },
        [externalWallCandidate],
      ),
    (error: unknown) =>
      error instanceof NonCandidateConceptError &&
      error.message.includes('property.tenure'),
  );
});

test('mapping validation rejects invalid JSON and out-of-range confidence', async () => {
  const mapper = new LlamaCppSemanticMapper({
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{not json' } }],
        }),
        { status: 200 },
      )) as typeof fetch,
  });

  await assert.rejects(
    () =>
      mapper.proposeMapping({
        fragment: SEMANTIC_MAPPING_FIXTURES.obviousPositive,
        candidates: [externalWallCandidate],
      }),
    (error: unknown) =>
      error instanceof SemanticMappingOutputError &&
      error.message.includes('invalid JSON'),
  );

  assert.throws(
    () =>
      validateMappingProposal(
        {
          firmTerm: 'Main Walls',
          selectedConceptId: externalWallCandidate.conceptId,
          confidence: 1.01,
          alternatives: [],
          rationale: 'Too confident.',
        },
        [externalWallCandidate],
      ),
    /confidence must be a finite number between 0 and 1/,
  );
});

test('llama.cpp mapper sends only candidates and returns a validated proposal', async () => {
  let requestBody: Record<string, unknown> | undefined;
  const mapper = new LlamaCppSemanticMapper({
    fetchImpl: (async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return modelResponse({
        firmTerm: 'Main Walls',
        selectedConceptId: externalWallCandidate.conceptId,
        confidence: 0.95,
        alternatives: [],
        rationale: 'The supplied candidate matches the external-wall wording.',
      });
    }) as typeof fetch,
  });

  const proposal = await mapper.proposeMapping({
    fragment: SEMANTIC_MAPPING_FIXTURES.obviousPositive,
    candidates: [externalWallCandidate],
  });

  assert.equal(proposal.selectedConceptId, 'building_element.external_wall');
  assert.equal(proposal.confidence, 0.95);
  assert.equal(requestBody?.temperature, 0);
  assert.deepEqual(requestBody?.chat_template_kwargs, {
    enable_thinking: false,
  });
  const messages = requestBody?.messages as { content: string }[];
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.content.includes('property.address'), false);
  assert.equal(messages[0]?.content.includes('building_element.external_wall'), true);
});

test('prompt versions preserve v1 and provide explicit v2 semantic classification rules', () => {
  const input = {
    fragment: {
      firmTerm: 'Main Walls',
      representativeText: 'The external walls are traditional masonry.',
    },
    candidates: [externalWallCandidate],
  };
  const v1 = buildSemanticMappingPrompt(input, 'v1');
  const v2 = buildSemanticMappingPrompt(input, 'v2');

  assert.match(v1, /"firmTerm":"Main Walls"/);
  assert.match(v1, /"conceptId":"building_element\.external_wall"/);
  assert.match(v2, /Firm terminology is presentation terminology/);
  assert.match(v2, /Use the firm term, nearby heading, and representative text together/);
  assert.match(v2, /Prefer the most specific supported candidate/);
  assert.match(v2, /Return null when no supplied candidate is sufficiently supported/);
  assert.match(v2, /Candidate 1\nID:/);
  assert.equal(v2.includes('undefined'), false);
  assert.equal(v2.includes('active_job'), false);
  assert.equal(v2.includes('property.address'), false);
  assert.equal(v2.includes('building_element.external_wall'), true);

  const missingContextPrompt = buildSemanticMappingPrompt(
    { fragment: { firmTerm: 'Walls' }, candidates: [externalWallCandidate] },
    'v2',
  );
  assert.match(missingContextPrompt, /Nearby heading\n- Not provided/);
  assert.match(missingContextPrompt, /Representative text\n- Not provided/);
});

test('mapper remains localhost-only and development-only', () => {
  assert.throws(
    () =>
      new LlamaCppSemanticMapper({
        baseUrl: 'https://example.invalid',
      }),
    /only permits a localhost/,
  );
});

test('benchmark v1 has unique, non-PII cases and canonical positive labels', () => {
  const ids = SEMANTIC_MAPPING_BENCHMARK_V1.map((benchmarkCase) => benchmarkCase.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(SEMANTIC_MAPPING_BENCHMARK_V1.length, 30);

  for (const benchmarkCase of SEMANTIC_MAPPING_BENCHMARK_V1) {
    assert.ok(benchmarkCase.id.trim());
    assert.ok(benchmarkCase.fragment.firmTerm.trim());
    assert.ok(benchmarkCase.fragment.representativeText?.trim());
    assert.equal(benchmarkCase.fragment.firmTerm.includes('@'), false);
    assert.equal(benchmarkCase.fragment.representativeText?.includes('@'), false);
    if (benchmarkCase.expectedConceptId) {
      const concept = MUFFLE_ONTOLOGY_V1.concepts.find(
        (candidate) => candidate.id === benchmarkCase.expectedConceptId,
      );
      assert.ok(concept, benchmarkCase.expectedConceptId);
      assert.equal(concept.canonical, true);
    }
  }
});

test('benchmark retrieval rank and null-case metrics are separate', () => {
  assert.equal(expectedConceptRank(['a', 'b', 'c'], 'b'), 2);
  assert.equal(expectedConceptRank(['a', 'b', 'c'], 'missing'), null);
  assert.deepEqual(
    buildRetrievalBenchmarkResult(['a', 'b', 'c'], null),
    {
      candidateIds: ['a', 'b', 'c'],
      candidates: [],
      expectedRank: null,
      top1: null,
      recallAt3: null,
      recallAt5: null,
    },
  );

  const aggregate = aggregateBenchmarkResults(
    [
      {
        caseId: 'positive-top1',
        category: 'obvious-match',
        expectedConceptId: 'expected',
        retrieval: buildRetrievalBenchmarkResult(['expected'], 'expected'),
        mapper: {
          firmTerm: 'expected',
          selectedConceptId: 'expected',
          confidence: 0.9,
          correct: true,
          eligible: true,
          latencyMs: 10,
        },
      },
      {
        caseId: 'positive-retrieval-failure',
        category: 'contextual',
        expectedConceptId: 'expected',
        retrieval: buildRetrievalBenchmarkResult(['other'], 'expected'),
        mapper: {
          firmTerm: 'expected',
          selectedConceptId: 'expected',
          confidence: 0.9,
          correct: false,
          eligible: false,
          latencyMs: 20,
        },
      },
      {
        caseId: 'positive-mapper-failure',
        category: 'contextual',
        expectedConceptId: 'expected',
        retrieval: buildRetrievalBenchmarkResult(
          ['other', 'expected'],
          'expected',
        ),
        mapper: {
          firmTerm: 'expected',
          selectedConceptId: null,
          confidence: 0.2,
          correct: false,
          eligible: true,
          latencyMs: 30,
        },
      },
      {
        caseId: 'unresolved-correct',
        category: 'unresolved',
        expectedConceptId: null,
        retrieval: buildRetrievalBenchmarkResult(['other'], null),
        mapper: {
          firmTerm: 'unresolved',
          selectedConceptId: null,
          confidence: 0,
          correct: true,
          eligible: true,
          latencyMs: 40,
        },
      },
      {
        caseId: 'unresolved-false-positive',
        category: 'unresolved',
        expectedConceptId: null,
        retrieval: buildRetrievalBenchmarkResult(['other'], null),
        mapper: {
          firmTerm: 'unresolved',
          selectedConceptId: 'other',
          confidence: 0.7,
          correct: false,
          eligible: true,
          latencyMs: 50,
        },
      },
    ],
    150,
  );

  assert.equal(aggregate.positiveCaseCount, 3);
  assert.equal(aggregate.unresolvedCaseCount, 2);
  assert.equal(aggregate.retrieval.top1Accuracy, 1 / 3);
  assert.equal(aggregate.retrieval.recallAt5, 2 / 3);
  assert.equal(aggregate.mapper.eligiblePositiveCases, 2);
  assert.equal(aggregate.mapper.correctEligibleMappings, 1);
  assert.equal(aggregate.mapper.conditionalAccuracy, 0.5);
  assert.equal(aggregate.mapper.endToEndPositiveAccuracy, 1 / 3);
  assert.equal(aggregate.unresolved.correctNullResults, 1);
  assert.equal(aggregate.unresolved.falsePositiveMappings, 1);
  assert.equal(aggregate.performance.meanLatencyMs, 30);
  assert.equal(aggregate.performance.medianLatencyMs, 30);
  assert.equal(aggregate.performance.totalRuntimeMs, 150);
});

test('benchmark error classification preserves safety diagnostics', () => {
  assert.equal(
    classifyMapperError(new NonCandidateConceptError('selectedConceptId', 'invented')),
    'hallucinated-id',
  );
  assert.equal(
    classifyMapperError(new SemanticMappingOutputError('llama.cpp returned invalid JSON.')),
    'invalid-json',
  );
  assert.equal(
    classifyMapperError(new SemanticMappingHttpError(503, 'http://127.0.0.1:8080')),
    'transport-error',
  );
});

test('prompt comparison classifies fixed, regressed, shared-wrong, and shared-correct cases', () => {
  const caseResult = (
    caseId: string,
    correct: boolean,
  ) => ({
    caseId,
    category: 'contextual' as const,
    expectedConceptId: 'expected',
    retrieval: buildRetrievalBenchmarkResult(['expected'], 'expected'),
    mapper: {
      firmTerm: caseId,
      selectedConceptId: correct ? 'expected' : null,
      correct,
      eligible: true,
      latencyMs: 1,
    },
  });
  const v1Cases = [
    caseResult('fixed', false),
    caseResult('regressed', true),
    caseResult('wrong-both', false),
    caseResult('correct-both', true),
  ];
  const v2Cases = [
    caseResult('fixed', true),
    caseResult('regressed', false),
    caseResult('wrong-both', false),
    caseResult('correct-both', true),
  ];
  const v1 = {
    benchmarkVersion: '1.0.0' as const,
    promptVersion: 'v1' as const,
    cases: v1Cases,
    aggregate: aggregateBenchmarkResults(v1Cases, 4),
  };
  const v2 = {
    benchmarkVersion: '1.0.0' as const,
    promptVersion: 'v2' as const,
    cases: v2Cases,
    aggregate: aggregateBenchmarkResults(v2Cases, 4),
  };

  const comparison = comparePromptResults(v1, v2);
  assert.deepEqual(comparison.fixedByV2, ['fixed']);
  assert.deepEqual(comparison.regressedByV2, ['regressed']);
  assert.deepEqual(comparison.wrongInBoth, ['wrong-both']);
  assert.deepEqual(comparison.correctInBoth, ['correct-both']);
});

test('benchmark progress formatting covers case outcomes and running status', () => {
  assert.equal(formatElapsed(0), '00:00');
  assert.equal(formatElapsed(65_000), '01:05');
  assert.equal(formatLatency(8_400), '8.4s');

  const output: string[] = [];
  const report = createBenchmarkProgressReporter((line) => output.push(line), () => 0);
  report({
    type: 'case-start',
    index: 1,
    total: 1,
    caseId: 'positive',
    category: 'obvious-match',
    firmTerm: 'Walls',
  });
  report({
    type: 'candidates-ready',
    index: 1,
    total: 1,
    caseId: 'positive',
    candidateCount: 1,
  });
  report({ type: 'mapping', index: 1, total: 1, caseId: 'positive' });
  report({
    type: 'complete',
    index: 1,
    total: 1,
    caseResult: {
      caseId: 'positive',
      category: 'obvious-match',
      expectedConceptId: 'expected',
      retrieval: buildRetrievalBenchmarkResult(['expected'], 'expected'),
      mapper: {
        firmTerm: 'Walls',
        selectedConceptId: 'expected',
        correct: true,
        eligible: true,
        latencyMs: 8_400,
      },
    },
  });

  assert.equal(output[0], '[1/1] positive');
  assert.ok(output.includes('  retrieving candidates...'));
  assert.ok(output.includes('  candidates ready: 1 found'));
  assert.ok(output.includes('  mapping...'));
  assert.ok(output.some((line) => line.includes('[OK] expected')));
  assert.ok(output.some((line) => line.includes('running: 1/1 complete')));
  assert.equal(
    benchmarkCaseClassification({
      caseId: 'unresolved',
      category: 'unresolved',
      expectedConceptId: null,
      retrieval: buildRetrievalBenchmarkResult(['other'], null),
      mapper: {
        firmTerm: 'Tenure',
        selectedConceptId: null,
        correct: true,
        eligible: true,
        latencyMs: 1,
      },
    }),
    'unresolved',
  );
  assert.equal(
    benchmarkCaseClassification({
      caseId: 'retrieval',
      category: 'contextual',
      expectedConceptId: 'expected',
      retrieval: buildRetrievalBenchmarkResult(['other'], 'expected'),
      mapper: {
        firmTerm: 'Structure',
        selectedConceptId: null,
        correct: false,
        eligible: false,
        latencyMs: 1,
      },
    }),
    'retrieval-failure',
  );
  assert.equal(
    benchmarkCaseClassification({
      caseId: 'mapper',
      category: 'contextual',
      expectedConceptId: 'expected',
      retrieval: buildRetrievalBenchmarkResult(['expected'], 'expected'),
      mapper: {
        firmTerm: 'Observed',
        selectedConceptId: 'other',
        correct: false,
        eligible: true,
        latencyMs: 1,
        errorType: 'validation-error',
      },
    }),
    'validation-error',
  );
  report({
    type: 'error',
    index: 1,
    total: 1,
    caseId: 'positive',
    errorType: 'transport-error',
    errorMessage: 'connection refused',
  });
  assert.ok(output.some((line) => line.includes('ERROR: transport-error')));
});
