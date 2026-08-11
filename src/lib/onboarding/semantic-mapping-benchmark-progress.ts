import type {
  BenchmarkCaseResult,
  BenchmarkProgressEvent,
  BenchmarkProgressReporter,
} from '@/lib/onboarding/semantic-mapping-benchmark';

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
}

export function formatLatency(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function benchmarkCaseClassification(
  caseResult: BenchmarkCaseResult,
): string {
  if (caseResult.mapper?.correct) {
    return caseResult.expectedConceptId ? 'correct' : 'unresolved';
  }
  if (
    caseResult.expectedConceptId &&
    caseResult.retrieval.recallAt5 === false
  ) {
    return 'retrieval-failure';
  }
  if (caseResult.mapper?.errorType) return caseResult.mapper.errorType;
  if (caseResult.expectedConceptId) return 'mapper-failure';
  return caseResult.mapper?.correct ? 'unresolved' : 'unresolved-failure';
}

type ProgressState = {
  startedAt: number;
  completed: number;
  positiveProcessed: number;
  positiveCorrect: number;
  eligibleProcessed: number;
  eligibleCorrect: number;
  unresolvedProcessed: number;
  unresolvedCorrect: number;
  errors: number;
  latencyTotalMs: number;
};

export function createBenchmarkProgressReporter(
  write: (line: string) => void = (line) => console.log(line),
  now: () => number = () => performance.now(),
): BenchmarkProgressReporter {
  const state: ProgressState = {
    startedAt: now(),
    completed: 0,
    positiveProcessed: 0,
    positiveCorrect: 0,
    eligibleProcessed: 0,
    eligibleCorrect: 0,
    unresolvedProcessed: 0,
    unresolvedCorrect: 0,
    errors: 0,
    latencyTotalMs: 0,
  };

  return (event: BenchmarkProgressEvent) => {
    switch (event.type) {
      case 'case-start':
        write(`[${event.index}/${event.total}] ${event.caseId}`);
        write(`  term: ${event.firmTerm}`);
        write('  retrieving candidates...');
        return;
      case 'candidates-ready':
        write(`  candidates ready: ${event.candidateCount} found`);
        return;
      case 'mapping':
        write('  mapping...');
        return;
      case 'error':
        state.errors += 1;
        write(`  ERROR: ${event.errorType}: ${event.errorMessage}`);
        return;
      case 'complete': {
        const { caseResult } = event;
        const mapper = caseResult.mapper;
        state.completed += 1;
        state.latencyTotalMs += mapper?.latencyMs ?? 0;
        if (caseResult.expectedConceptId) {
          state.positiveProcessed += 1;
          if (mapper?.correct) state.positiveCorrect += 1;
          if (mapper?.eligible) {
            state.eligibleProcessed += 1;
            if (mapper.correct) state.eligibleCorrect += 1;
          }
        } else {
          state.unresolvedProcessed += 1;
          if (mapper?.correct) state.unresolvedCorrect += 1;
        }

        const classification = benchmarkCaseClassification(caseResult);
        const selected = mapper?.selectedConceptId ?? 'null';
        const expected = caseResult.expectedConceptId ?? 'null';
        const status =
          mapper?.correct && caseResult.expectedConceptId
            ? `[OK] ${selected}`
            : mapper?.correct
              ? '[OK] unresolved / null'
              : `[FAIL] selected ${selected}`;
        write(`  ${status}`);
        write(`  expected: ${expected}`);
        write(`  classification: ${classification}`);
        write(`  latency: ${formatLatency(mapper?.latencyMs ?? 0)}`);
        write(
          `  running: ${state.completed}/${event.total} complete; ` +
            `positive ${state.positiveCorrect}/${state.positiveProcessed}; ` +
            `eligible ${state.eligibleCorrect}/${state.eligibleProcessed}; ` +
            `unresolved ${state.unresolvedCorrect}/${state.unresolvedProcessed}; ` +
            `errors ${state.errors}; ` +
            `mean latency ${
              state.completed > 0
                ? formatLatency(state.latencyTotalMs / state.completed)
                : 'n/a'
            }; elapsed ${formatElapsed(now() - state.startedAt)}`,
        );
        return;
      }
    }
  };
}
