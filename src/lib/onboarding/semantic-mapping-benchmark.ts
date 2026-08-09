import type { MuffleOntologyV1 } from '@/domain/ontology/muffle-ontology.v1';
import {
  NonCandidateConceptError,
  SemanticMappingHttpError,
  SemanticMappingOutputError,
} from '@/lib/onboarding/llama-cpp-semantic-mapper';
import type {
  CandidateRetriever,
  CandidateConcept,
  FirmSemanticFragment,
  SemanticMapper,
} from '@/lib/onboarding/semantic-mapping';
import type { SemanticMappingBenchmarkCase } from '@/lib/onboarding/semantic-mapping-benchmark-v1';
import type { SemanticMapperPromptVersion } from '@/lib/onboarding/semantic-mapping-prompt';

export type BenchmarkErrorType =
  | 'transport-error'
  | 'invalid-json'
  | 'hallucinated-id'
  | 'validation-error';

export type RetrievalBenchmarkResult = {
  candidateIds: string[];
  candidates: CandidateConcept[];
  expectedRank: number | null;
  top1: boolean | null;
  recallAt3: boolean | null;
  recallAt5: boolean | null;
};

export type MapperBenchmarkResult = {
  firmTerm: string;
  nearbyHeading?: string;
  representativeText?: string;
  selectedConceptId: string | null;
  confidence?: number;
  alternatives?: string[];
  rationale?: string;
  correct: boolean;
  eligible: boolean;
  latencyMs: number;
  errorType?: BenchmarkErrorType;
  errorMessage?: string;
};

export type BenchmarkCaseResult = {
  caseId: string;
  category: SemanticMappingBenchmarkCase['category'];
  expectedConceptId: string | null;
  retrieval: RetrievalBenchmarkResult;
  mapper?: MapperBenchmarkResult;
};

export type BenchmarkSafetyMetrics = {
  hallucinatedIds: number;
  invalidJson: number;
  validationFailures: number;
  httpFailures: number;
};

export type BenchmarkAggregateResult = {
  caseCount: number;
  positiveCaseCount: number;
  unresolvedCaseCount: number;
  retrieval: {
    top1Accuracy: number | null;
    recallAt3: number | null;
    recallAt5: number | null;
    expectedPresentInTop5: number;
  };
  mapper: {
    eligiblePositiveCases: number;
    correctEligibleMappings: number;
    conditionalAccuracy: number | null;
    endToEndPositiveAccuracy: number | null;
  };
  unresolved: {
    correctNullResults: number;
    accuracy: number | null;
    falsePositiveMappings: number;
  };
  safety: BenchmarkSafetyMetrics;
  performance: {
    meanLatencyMs: number | null;
    medianLatencyMs: number | null;
    totalRuntimeMs: number;
  };
};

export type SemanticMappingBenchmarkResult = {
  benchmarkVersion: '1.0.0';
  promptVersion: SemanticMapperPromptVersion;
  cases: BenchmarkCaseResult[];
  aggregate: BenchmarkAggregateResult;
};

export type PreparedBenchmarkCase = {
  benchmarkCase: SemanticMappingBenchmarkCase;
  candidates: CandidateConcept[];
};

export type PromptComparisonResult = {
  benchmarkVersion: '1.0.0';
  v1: SemanticMappingBenchmarkResult;
  v2: SemanticMappingBenchmarkResult;
  fixedByV2: string[];
  regressedByV2: string[];
  wrongInBoth: string[];
  correctInBoth: string[];
};

export type BenchmarkProgressEvent =
  | {
      type: 'case-start';
      index: number;
      total: number;
      caseId: string;
      category: SemanticMappingBenchmarkCase['category'];
      firmTerm: string;
    }
  | {
      type: 'candidates-ready';
      index: number;
      total: number;
      caseId: string;
      candidateCount: number;
    }
  | {
      type: 'mapping';
      index: number;
      total: number;
      caseId: string;
    }
  | {
      type: 'error';
      index: number;
      total: number;
      caseId: string;
      errorType: BenchmarkErrorType;
      errorMessage: string;
    }
  | {
      type: 'complete';
      index: number;
      total: number;
      caseResult: BenchmarkCaseResult;
    };

export type BenchmarkProgressReporter = (
  event: BenchmarkProgressEvent,
) => void;

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function expectedConceptRank(
  candidateIds: readonly string[],
  expectedConceptId: string | null,
): number | null {
  if (!expectedConceptId) return null;
  const index = candidateIds.indexOf(expectedConceptId);
  return index >= 0 ? index + 1 : null;
}

export function buildRetrievalBenchmarkResult(
  candidateIds: readonly string[],
  expectedConceptId: string | null,
  candidates: readonly CandidateConcept[] = [],
): RetrievalBenchmarkResult {
  const expectedRank = expectedConceptRank(candidateIds, expectedConceptId);
  if (!expectedConceptId) {
    return {
      candidateIds: [...candidateIds],
      candidates: [...candidates],
      expectedRank: null,
      top1: null,
      recallAt3: null,
      recallAt5: null,
    };
  }
  return {
    candidateIds: [...candidateIds],
    candidates: [...candidates],
    expectedRank,
    top1: expectedRank === 1,
    recallAt3: expectedRank !== null && expectedRank <= 3,
    recallAt5: expectedRank !== null && expectedRank <= 5,
  };
}

export function classifyMapperError(error: unknown): BenchmarkErrorType {
  if (error instanceof SemanticMappingHttpError) return 'transport-error';
  if (error instanceof NonCandidateConceptError) return 'hallucinated-id';
  if (
    error instanceof SemanticMappingOutputError &&
    error.message.toLowerCase().includes('invalid json')
  ) {
    return 'invalid-json';
  }
  return 'validation-error';
}

function errorResult(
  error: unknown,
  fragment: FirmSemanticFragment,
  eligible: boolean,
  latencyMs: number,
): MapperBenchmarkResult {
  return {
    firmTerm: fragment.firmTerm,
    nearbyHeading: fragment.nearbyHeading,
    representativeText: fragment.representativeText,
    selectedConceptId: null,
    correct: false,
    eligible,
    latencyMs,
    errorType: classifyMapperError(error),
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

export function aggregateBenchmarkResults(
  results: readonly BenchmarkCaseResult[],
  totalRuntimeMs: number,
): BenchmarkAggregateResult {
  const positive = results.filter((result) => result.expectedConceptId !== null);
  const unresolved = results.filter((result) => result.expectedConceptId === null);
  const retrievalTop1 = positive.filter((result) => result.retrieval.top1).length;
  const retrievalAt3 = positive.filter((result) => result.retrieval.recallAt3).length;
  const retrievalAt5 = positive.filter((result) => result.retrieval.recallAt5).length;
  const eligiblePositive = positive.filter(
    (result) => result.retrieval.recallAt5,
  );
  const correctEligible = eligiblePositive.filter(
    (result) => result.mapper?.correct,
  ).length;
  const endToEndCorrect = positive.filter((result) => result.mapper?.correct).length;
  const correctNullResults = unresolved.filter(
    (result) => result.mapper?.selectedConceptId === null && !result.mapper.errorType,
  ).length;
  const falsePositiveMappings = unresolved.filter(
    (result) =>
      result.mapper?.selectedConceptId !== null &&
      result.mapper?.selectedConceptId !== undefined,
  ).length;
  const mapperResults = results
    .map((result) => result.mapper)
    .filter((mapper): mapper is MapperBenchmarkResult => Boolean(mapper));
  const latencies = mapperResults.map((mapper) => mapper.latencyMs);
  const sortedLatencies = [...latencies].sort((left, right) => left - right);
  const medianIndex = Math.floor(sortedLatencies.length / 2);
  const medianLatencyMs =
    sortedLatencies.length === 0
      ? null
      : sortedLatencies.length % 2 === 1
        ? sortedLatencies[medianIndex]
        : (sortedLatencies[medianIndex - 1] + sortedLatencies[medianIndex]) / 2;
  const errorCount = (type: BenchmarkErrorType) =>
    mapperResults.filter((mapper) => mapper.errorType === type).length;

  return {
    caseCount: results.length,
    positiveCaseCount: positive.length,
    unresolvedCaseCount: unresolved.length,
    retrieval: {
      top1Accuracy: ratio(retrievalTop1, positive.length),
      recallAt3: ratio(retrievalAt3, positive.length),
      recallAt5: ratio(retrievalAt5, positive.length),
      expectedPresentInTop5: retrievalAt5,
    },
    mapper: {
      eligiblePositiveCases: eligiblePositive.length,
      correctEligibleMappings: correctEligible,
      conditionalAccuracy: ratio(correctEligible, eligiblePositive.length),
      endToEndPositiveAccuracy: ratio(endToEndCorrect, positive.length),
    },
    unresolved: {
      correctNullResults,
      accuracy: ratio(correctNullResults, unresolved.length),
      falsePositiveMappings,
    },
    safety: {
      hallucinatedIds: errorCount('hallucinated-id'),
      invalidJson: errorCount('invalid-json'),
      validationFailures: errorCount('validation-error'),
      httpFailures: errorCount('transport-error'),
    },
    performance: {
      meanLatencyMs: ratio(
        latencies.reduce((total, latency) => total + latency, 0),
        latencies.length,
      ),
      medianLatencyMs,
      totalRuntimeMs,
    },
  };
}

export async function runSemanticMappingBenchmark(
  cases: readonly SemanticMappingBenchmarkCase[],
  ontology: MuffleOntologyV1,
  retriever: CandidateRetriever,
  mapper: SemanticMapper,
  now: () => number = () => performance.now(),
  promptVersion: SemanticMapperPromptVersion = 'v1',
  onProgress?: BenchmarkProgressReporter,
): Promise<SemanticMappingBenchmarkResult> {
  const preparedCases = prepareBenchmarkCases(cases, ontology, retriever);
  return runPreparedSemanticMappingBenchmark(
    preparedCases,
    mapper,
    now,
    promptVersion,
    onProgress,
  );
}

export function prepareBenchmarkCases(
  cases: readonly SemanticMappingBenchmarkCase[],
  ontology: MuffleOntologyV1,
  retriever: CandidateRetriever,
): PreparedBenchmarkCase[] {
  return cases.map((benchmarkCase) => ({
    benchmarkCase,
    candidates: retriever.retrieve(benchmarkCase.fragment, ontology),
  }));
}

export async function runPreparedSemanticMappingBenchmark(
  preparedCases: readonly PreparedBenchmarkCase[],
  mapper: SemanticMapper,
  now: () => number = () => performance.now(),
  promptVersion: SemanticMapperPromptVersion = 'v1',
  onProgress?: BenchmarkProgressReporter,
): Promise<SemanticMappingBenchmarkResult> {
  const startedAt = now();
  const results: BenchmarkCaseResult[] = [];

  for (const [caseIndex, { benchmarkCase, candidates }] of preparedCases.entries()) {
    const index = caseIndex + 1;
    const total = preparedCases.length;
    onProgress?.({
      type: 'case-start',
      index,
      total,
      caseId: benchmarkCase.id,
      category: benchmarkCase.category,
      firmTerm: benchmarkCase.fragment.firmTerm,
    });
    const candidateIds = candidates.map((candidate) => candidate.conceptId);
    const retrieval = buildRetrievalBenchmarkResult(
      candidateIds,
      benchmarkCase.expectedConceptId,
      candidates,
    );
    onProgress?.({
      type: 'candidates-ready',
      index,
      total,
      caseId: benchmarkCase.id,
      candidateCount: candidates.length,
    });
    const eligible =
      benchmarkCase.expectedConceptId === null ||
      retrieval.recallAt5 === true;
    onProgress?.({
      type: 'mapping',
      index,
      total,
      caseId: benchmarkCase.id,
    });
    const requestStartedAt = now();
    let mapperResult: MapperBenchmarkResult;
    try {
      const proposal = await mapper.proposeMapping({
        fragment: benchmarkCase.fragment,
        candidates,
      });
      const latencyMs = now() - requestStartedAt;
      mapperResult = {
        firmTerm: benchmarkCase.fragment.firmTerm,
        nearbyHeading: benchmarkCase.fragment.nearbyHeading,
        representativeText: benchmarkCase.fragment.representativeText,
        selectedConceptId: proposal.selectedConceptId,
        confidence: proposal.confidence,
        alternatives: proposal.alternatives,
        rationale: proposal.rationale,
        correct:
          benchmarkCase.expectedConceptId === null
            ? proposal.selectedConceptId === null
            : eligible &&
              proposal.selectedConceptId === benchmarkCase.expectedConceptId,
        eligible,
        latencyMs,
      };
    } catch (error) {
      const errorType = classifyMapperError(error);
      onProgress?.({
        type: 'error',
        index,
        total,
        caseId: benchmarkCase.id,
        errorType,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      mapperResult = errorResult(
        error,
        benchmarkCase.fragment,
        eligible,
        now() - requestStartedAt,
      );
    }
    const caseResult = {
      caseId: benchmarkCase.id,
      category: benchmarkCase.category,
      expectedConceptId: benchmarkCase.expectedConceptId,
      retrieval,
      mapper: mapperResult,
    };
    results.push(caseResult);
    onProgress?.({
      type: 'complete',
      index,
      total,
      caseResult,
    });
  }

  const totalRuntimeMs = now() - startedAt;
  return {
    benchmarkVersion: '1.0.0',
    promptVersion,
    cases: results,
    aggregate: aggregateBenchmarkResults(results, totalRuntimeMs),
  };
}

export function comparePromptResults(
  v1: SemanticMappingBenchmarkResult,
  v2: SemanticMappingBenchmarkResult,
): PromptComparisonResult {
  const v2ById = new Map(v2.cases.map((result) => [result.caseId, result]));
  const fixedByV2: string[] = [];
  const regressedByV2: string[] = [];
  const wrongInBoth: string[] = [];
  const correctInBoth: string[] = [];

  for (const v1Case of v1.cases) {
    const v2Case = v2ById.get(v1Case.caseId);
    if (!v2Case) continue;
    const v1Correct = v1Case.mapper?.correct === true;
    const v2Correct = v2Case.mapper?.correct === true;
    if (!v1Correct && v2Correct) fixedByV2.push(v1Case.caseId);
    else if (v1Correct && !v2Correct) regressedByV2.push(v1Case.caseId);
    else if (!v1Correct && !v2Correct) wrongInBoth.push(v1Case.caseId);
    else correctInBoth.push(v1Case.caseId);
  }

  return {
    benchmarkVersion: v1.benchmarkVersion,
    v1,
    v2,
    fixedByV2,
    regressedByV2,
    wrongInBoth,
    correctInBoth,
  };
}
