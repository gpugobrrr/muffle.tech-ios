import { MUFFLE_ONTOLOGY_V1 } from '@/domain/ontology/muffle-ontology.v1';
import { LexicalCandidateRetriever } from '@/lib/onboarding/lexical-candidate-retriever';
import { LlamaCppSemanticMapper } from '@/lib/onboarding/llama-cpp-semantic-mapper';
import {
  comparePromptResults,
  prepareBenchmarkCases,
  runPreparedSemanticMappingBenchmark,
} from '@/lib/onboarding/semantic-mapping-benchmark';
import { SEMANTIC_MAPPING_BENCHMARK_V1 } from '@/lib/onboarding/semantic-mapping-benchmark-v1';
import { createBenchmarkProgressReporter } from '@/lib/onboarding/semantic-mapping-benchmark-progress';

const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const quiet = args.includes('--quiet');
const retriever = new LexicalCandidateRetriever(5);
if (!jsonOnly && !quiet) {
  console.log('Preparing shared candidate sets...');
}
const preparedCases = prepareBenchmarkCases(
  SEMANTIC_MAPPING_BENCHMARK_V1,
  MUFFLE_ONTOLOGY_V1,
  retriever,
);
const progress = !jsonOnly && !quiet ? createBenchmarkProgressReporter() : undefined;
if (!jsonOnly && !quiet) {
  console.log('');
  console.log('Running Prompt v1');
}
const v1 = await runPreparedSemanticMappingBenchmark(
  preparedCases,
  new LlamaCppSemanticMapper({ promptVersion: 'v1' }),
  undefined,
  'v1',
  progress,
);
if (!jsonOnly && !quiet) {
  console.log('Prompt v1 complete');
  console.log('');
  console.log('Running Prompt v2');
}
const v2Progress =
  !jsonOnly && !quiet ? createBenchmarkProgressReporter() : undefined;
const v2 = await runPreparedSemanticMappingBenchmark(
  preparedCases,
  new LlamaCppSemanticMapper({ promptVersion: 'v2' }),
  undefined,
  'v2',
  v2Progress,
);
const comparison = comparePromptResults(v1, v2);
if (!jsonOnly && !quiet) {
  console.log('Prompt v2 complete');
  console.log('');
}

function percent(value) {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function metricRow(label, v1Value, v2Value) {
  return `${label.padEnd(28)}${v1Value.padStart(10)}${v2Value.padStart(10)}`;
}

if (jsonOnly) {
  console.log(JSON.stringify(comparison, null, 2));
} else {
  console.log('Prompt comparison');
  console.log('=================');
  console.log('');
  console.log(`${''.padEnd(28)}${'v1'.padStart(10)}${'v2'.padStart(10)}`);
  console.log(
    metricRow(
      'Eligible positive cases',
      String(v1.aggregate.mapper.eligiblePositiveCases),
      String(v2.aggregate.mapper.eligiblePositiveCases),
    ),
  );
  console.log(
    metricRow(
      'Correct eligible mappings',
      String(v1.aggregate.mapper.correctEligibleMappings),
      String(v2.aggregate.mapper.correctEligibleMappings),
    ),
  );
  console.log(
    metricRow(
      'Conditional mapper accuracy',
      percent(v1.aggregate.mapper.conditionalAccuracy),
      percent(v2.aggregate.mapper.conditionalAccuracy),
    ),
  );
  console.log(
    metricRow(
      'End-to-end positive accuracy',
      percent(v1.aggregate.mapper.endToEndPositiveAccuracy),
      percent(v2.aggregate.mapper.endToEndPositiveAccuracy),
    ),
  );
  console.log(
    metricRow(
      'Unresolved accuracy',
      percent(v1.aggregate.unresolved.accuracy),
      percent(v2.aggregate.unresolved.accuracy),
    ),
  );
  console.log(
    metricRow(
      'False-positive unresolved',
      String(v1.aggregate.unresolved.falsePositiveMappings),
      String(v2.aggregate.unresolved.falsePositiveMappings),
    ),
  );
  console.log(
    metricRow(
      'Hallucinated IDs',
      String(v1.aggregate.safety.hallucinatedIds),
      String(v2.aggregate.safety.hallucinatedIds),
    ),
  );
  console.log(
    metricRow(
      'Invalid JSON',
      String(v1.aggregate.safety.invalidJson),
      String(v2.aggregate.safety.invalidJson),
    ),
  );
  console.log(
    metricRow(
      'Validation failures',
      String(v1.aggregate.safety.validationFailures),
      String(v2.aggregate.safety.validationFailures),
    ),
  );
  console.log(
    metricRow(
      'HTTP failures',
      String(v1.aggregate.safety.httpFailures),
      String(v2.aggregate.safety.httpFailures),
    ),
  );
  console.log(
    metricRow(
      'Mean latency',
      `${v1.aggregate.performance.meanLatencyMs?.toFixed(0) ?? 'n/a'}ms`,
      `${v2.aggregate.performance.meanLatencyMs?.toFixed(0) ?? 'n/a'}ms`,
    ),
  );
  console.log(
    metricRow(
      'Median latency',
      `${v1.aggregate.performance.medianLatencyMs?.toFixed(0) ?? 'n/a'}ms`,
      `${v2.aggregate.performance.medianLatencyMs?.toFixed(0) ?? 'n/a'}ms`,
    ),
  );
  console.log(
    metricRow(
      'Total runtime',
      `${(v1.aggregate.performance.totalRuntimeMs / 1000).toFixed(1)}s`,
      `${(v2.aggregate.performance.totalRuntimeMs / 1000).toFixed(1)}s`,
    ),
  );

  console.log('');
  console.log('Fixed by v2:');
  console.log(
    comparison.fixedByV2.length > 0
      ? comparison.fixedByV2.map((id) => `- ${id}`).join('\n')
      : '- none',
  );
  console.log('Regressed by v2:');
  console.log(
    comparison.regressedByV2.length > 0
      ? comparison.regressedByV2.map((id) => `- ${id}`).join('\n')
      : '- none',
  );
  console.log('Wrong in both:');
  console.log(
    comparison.wrongInBoth.length > 0
      ? comparison.wrongInBoth.map((id) => `- ${id}`).join('\n')
      : '- none',
  );
  console.log('Correct in both:');
  console.log(
    comparison.correctInBoth.length > 0
      ? comparison.correctInBoth.map((id) => `- ${id}`).join('\n')
      : '- none',
  );
}
