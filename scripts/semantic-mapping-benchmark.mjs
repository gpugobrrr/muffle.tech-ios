import {
  MUFFLE_ONTOLOGY_V1,
} from '@/domain/ontology/muffle-ontology.v1';
import { LexicalCandidateRetriever } from '@/lib/onboarding/lexical-candidate-retriever';
import { LlamaCppSemanticMapper } from '@/lib/onboarding/llama-cpp-semantic-mapper';
import {
  runSemanticMappingBenchmark,
} from '@/lib/onboarding/semantic-mapping-benchmark';
import { SEMANTIC_MAPPING_BENCHMARK_V1 } from '@/lib/onboarding/semantic-mapping-benchmark-v1';
import { createBenchmarkProgressReporter } from '@/lib/onboarding/semantic-mapping-benchmark-progress';

const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const failuresOnly = args.includes('--failures');
const quiet = args.includes('--quiet');
const retriever = new LexicalCandidateRetriever(5);
const mapper = new LlamaCppSemanticMapper();
const progress =
  !jsonOnly && !quiet ? createBenchmarkProgressReporter() : undefined;

if (!jsonOnly && !quiet) {
  console.log(`Semantic Mapping Benchmark v1`);
  console.log(`Model endpoint: ${mapper.baseUrl}`);
  console.log(`Model: ${mapper.model}`);
  console.log(`Prompt: ${mapper.promptVersion}`);
  console.log(`Cases: ${SEMANTIC_MAPPING_BENCHMARK_V1.length}`);
  console.log('');
}

const result = await runSemanticMappingBenchmark(
  SEMANTIC_MAPPING_BENCHMARK_V1,
  MUFFLE_ONTOLOGY_V1,
  retriever,
  mapper,
  undefined,
  mapper.promptVersion,
  progress,
);

function percent(value) {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function seconds(value) {
  return `${(value / 1000).toFixed(1)}s`;
}

function failureClassification(caseResult) {
  if (
    caseResult.expectedConceptId &&
    caseResult.retrieval.recallAt5 === false
  ) {
    return 'retrieval-failure';
  }
  if (caseResult.mapper?.errorType) return caseResult.mapper.errorType;
  if (caseResult.expectedConceptId) return 'mapper-failure';
  return 'unresolved-failure';
}

function diagnosticCases() {
  return result.cases.filter((caseResult) => !caseResult.mapper?.correct);
}

function printFailureDiagnostics() {
  const diagnostics = diagnosticCases();
  if (diagnostics.length === 0) return;
  console.log('');
  console.log('Failed / diagnostic cases');
  console.log('-------------------------');
  for (const caseResult of diagnostics) {
    const mapper = caseResult.mapper;
    console.log(`CASE: ${caseResult.caseId} [${caseResult.category}]`);
    console.log(`Firm term: ${mapper?.firmTerm ?? 'Not provided'}`);
    console.log(`Nearby heading: ${mapper?.nearbyHeading ?? 'Not provided'}`);
    console.log(`Representative text: ${mapper?.representativeText ?? 'Not provided'}`);
    console.log(`Expected: ${caseResult.expectedConceptId ?? 'null'}`);
    console.log(
      `Expected retrieval rank: ${
        caseResult.retrieval.expectedRank ?? 'absent from top-5'
      }`,
    );
    console.log('Candidates:');
    caseResult.retrieval.candidates.forEach((candidate, index) => {
      console.log(
        `  ${index + 1}. ${candidate.conceptId} | score ${candidate.score.toFixed(
          3,
        )} | ${candidate.label}`,
      );
      console.log(
        `     aliases: ${
          candidate.aliases.length > 0 ? candidate.aliases.join(', ') : 'None'
        }`,
      );
      console.log(`     description: ${candidate.description}`);
    });
    console.log(`Selected: ${mapper?.selectedConceptId ?? 'null'}`);
    console.log(`Confidence: ${mapper?.confidence ?? 'Not provided'}`);
    console.log(`Rationale: ${mapper?.rationale ?? 'Not provided'}`);
    console.log(`Latency: ${mapper?.latencyMs.toFixed(0) ?? 'n/a'}ms`);
    console.log(`Classification: ${failureClassification(caseResult)}`);
    if (mapper?.errorMessage) console.log(`Error: ${mapper.errorMessage}`);
    console.log('');
  }
}

if (jsonOnly) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const { aggregate } = result;
  console.log(`Semantic Mapping Benchmark v${result.benchmarkVersion}`);
  console.log('='.repeat(30));
  console.log('');
  console.log(`Cases: ${aggregate.caseCount}`);
  console.log(`Positive cases: ${aggregate.positiveCaseCount}`);
  console.log(`Unresolved cases: ${aggregate.unresolvedCaseCount}`);
  console.log('');
  console.log('Retrieval');
  console.log('---------');
  console.log(`Top-1 accuracy: ${percent(aggregate.retrieval.top1Accuracy)}`);
  console.log(`Recall@3: ${percent(aggregate.retrieval.recallAt3)}`);
  console.log(`Recall@5: ${percent(aggregate.retrieval.recallAt5)}`);
  console.log(
    `Expected present in top-5: ${aggregate.retrieval.expectedPresentInTop5}/${aggregate.positiveCaseCount}`,
  );
  console.log('');
  console.log('Mapper');
  console.log('------');
  console.log(`Eligible positive cases: ${aggregate.mapper.eligiblePositiveCases}`);
  console.log(
    `Correct eligible mappings: ${aggregate.mapper.correctEligibleMappings}`,
  );
  console.log(
    `Conditional mapper accuracy: ${percent(aggregate.mapper.conditionalAccuracy)}`,
  );
  console.log(
    `End-to-end positive accuracy: ${percent(aggregate.mapper.endToEndPositiveAccuracy)}`,
  );
  console.log('');
  console.log('Unresolved');
  console.log('----------');
  console.log(
    `Correct null results: ${aggregate.unresolved.correctNullResults}/${aggregate.unresolvedCaseCount}`,
  );
  console.log(`Unresolved accuracy: ${percent(aggregate.unresolved.accuracy)}`);
  console.log(`False positives: ${aggregate.unresolved.falsePositiveMappings}`);
  console.log('');
  console.log('Safety');
  console.log('------');
  console.log(`Hallucinated/non-candidate IDs: ${aggregate.safety.hallucinatedIds}`);
  console.log(`Invalid JSON: ${aggregate.safety.invalidJson}`);
  console.log(`Validation failures: ${aggregate.safety.validationFailures}`);
  console.log(`HTTP failures: ${aggregate.safety.httpFailures}`);
  console.log('');
  console.log('Performance');
  console.log('-----------');
  console.log(
    `Mean latency: ${
      aggregate.performance.meanLatencyMs === null
        ? 'n/a'
        : `${aggregate.performance.meanLatencyMs.toFixed(0)}ms`
    }`,
  );
  console.log(
    `Median latency: ${
      aggregate.performance.medianLatencyMs === null
        ? 'n/a'
        : `${aggregate.performance.medianLatencyMs.toFixed(0)}ms`
    }`,
  );
  console.log(`Total runtime: ${seconds(aggregate.performance.totalRuntimeMs)}`);

  if (failuresOnly) printFailureDiagnostics();
}
