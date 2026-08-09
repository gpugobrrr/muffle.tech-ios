import type { MuffleOntologyV1 } from '@/domain/ontology/muffle-ontology.v1';
import {
  NonCandidateConceptError,
  SemanticMappingHttpError,
  SemanticMappingOutputError,
} from '@/lib/onboarding/llama-cpp-semantic-mapper';
import type { ParsedFirmDocument } from '@/lib/onboarding/documents/parsed-document';
import type { PiiMinimizedDocument } from '@/lib/onboarding/documents/privacy/pii-minimized-document';
import type { SemanticFragment } from '@/lib/onboarding/documents/semantic-fragment-extractor';
import type {
  CandidateConcept,
  CandidateRetriever,
  FirmSemanticFragment,
  MappingProposal,
  SemanticMapper,
} from '@/lib/onboarding/semantic-mapping';

export type SemanticMappingInspectionStatus =
  | 'resolved'
  | 'unresolved'
  | 'retrieval_empty'
  | 'mapper_error';

export type SemanticMappingInspectionErrorType =
  | 'invalid_json'
  | 'non_candidate_id'
  | 'validation_error'
  | 'mapper_error';

export type SemanticMappingInspectionError = {
  type: SemanticMappingInspectionErrorType;
  message: string;
};

export type SemanticMappingInspectionResult = {
  fragment: SemanticFragment;
  retrievalInput: FirmSemanticFragment;
  candidates: CandidateConcept[];
  status: SemanticMappingInspectionStatus;
  proposal?: MappingProposal;
  error?: SemanticMappingInspectionError;
  latencyMs: number;
};

export type SemanticMappingInspectionOutput = {
  schemaVersion: 1;
  source: {
    pagesInSource: number;
    parsedPages?: number[];
  };
  summary: {
    completeFragments: number;
    retrievalEligibleFragments: number;
    mappingAttempts: number;
    successfulProposals: number;
    resolved: number;
    unresolved: number;
    retrievalEmpty: number;
    errors: number;
    totalLatencyMs: number;
    meanLatencyMs: number | null;
    medianLatencyMs: number | null;
  };
  results: SemanticMappingInspectionResult[];
};

export type SemanticMappingInspectionProgressEvent =
  | {
      type: 'mapping';
      index: number;
      total: number;
      fragmentId: string;
    }
  | {
      type: 'complete';
      index: number;
      total: number;
      fragmentId: string;
      status: SemanticMappingInspectionStatus;
      latencyMs: number;
    };

export type SemanticMappingInspectionDependencies = {
  parseDocument(
    inputPath: string,
    options: { pages?: readonly number[] },
  ): Promise<ParsedFirmDocument>;
  minimizeDocument(document: ParsedFirmDocument): PiiMinimizedDocument;
  extractFragments(document: PiiMinimizedDocument): SemanticFragment[];
  selectRetrievalFragments(
    fragments: readonly SemanticFragment[],
  ): SemanticFragment[];
  adaptFragment(fragment: SemanticFragment): FirmSemanticFragment;
  retriever: CandidateRetriever;
  mapper: SemanticMapper;
  ontology: MuffleOntologyV1;
  now?: () => number;
};

export type SemanticMappingInspectionOptions = {
  pages?: readonly number[];
  onProgress?: (event: SemanticMappingInspectionProgressEvent) => void;
};

function classifyMapperError(error: unknown): SemanticMappingInspectionError {
  if (error instanceof NonCandidateConceptError) {
    return {
      type: 'non_candidate_id',
      message: 'Mapper returned a concept outside the retrieved candidate set.',
    };
  }
  if (error instanceof SemanticMappingOutputError) {
    return {
      type: error.message.toLowerCase().includes('invalid json')
        ? 'invalid_json'
        : 'validation_error',
      message: 'Mapper response failed validation.',
    };
  }
  return {
    type: 'mapper_error',
    message: 'Mapper failed for this fragment.',
  };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function buildSummary(
  completeFragmentCount: number,
  eligibleFragmentCount: number,
  results: readonly SemanticMappingInspectionResult[],
): SemanticMappingInspectionOutput['summary'] {
  const mapperResults = results.filter(
    ({ status }) => status !== 'retrieval_empty',
  );
  const latencies = mapperResults.map(({ latencyMs }) => latencyMs);
  const totalLatencyMs = latencies.reduce(
    (total, latency) => total + latency,
    0,
  );
  const resolved = results.filter(({ status }) => status === 'resolved').length;
  const unresolved = results.filter(
    ({ status }) => status === 'unresolved',
  ).length;
  return {
    completeFragments: completeFragmentCount,
    retrievalEligibleFragments: eligibleFragmentCount,
    mappingAttempts: mapperResults.length,
    successfulProposals: resolved + unresolved,
    resolved,
    unresolved,
    retrievalEmpty: results.filter(
      ({ status }) => status === 'retrieval_empty',
    ).length,
    errors: results.filter(({ status }) => status === 'mapper_error').length,
    totalLatencyMs,
    meanLatencyMs:
      latencies.length > 0 ? totalLatencyMs / latencies.length : null,
    medianLatencyMs: median(latencies),
  };
}

export async function inspectFirmPdfSemanticMappings(
  inputPath: string,
  options: SemanticMappingInspectionOptions,
  dependencies: SemanticMappingInspectionDependencies,
): Promise<SemanticMappingInspectionOutput> {
  const parsed = await dependencies.parseDocument(inputPath, {
    pages: options.pages,
  });
  const minimized = dependencies.minimizeDocument(parsed);
  const completeFragments = dependencies.extractFragments(minimized);
  const retrievalFragments =
    dependencies.selectRetrievalFragments(completeFragments);
  const now = dependencies.now ?? (() => performance.now());
  const results: SemanticMappingInspectionResult[] = [];

  for (const [fragmentIndex, fragment] of retrievalFragments.entries()) {
    const index = fragmentIndex + 1;
    const retrievalInput = dependencies.adaptFragment(fragment);
    const candidates = dependencies.retriever.retrieve(
      retrievalInput,
      dependencies.ontology,
    );
    if (candidates.length === 0) {
      const result: SemanticMappingInspectionResult = {
        fragment,
        retrievalInput,
        candidates,
        status: 'retrieval_empty',
        latencyMs: 0,
      };
      results.push(result);
      options.onProgress?.({
        type: 'complete',
        index,
        total: retrievalFragments.length,
        fragmentId: fragment.id,
        status: result.status,
        latencyMs: result.latencyMs,
      });
      continue;
    }

    options.onProgress?.({
      type: 'mapping',
      index,
      total: retrievalFragments.length,
      fragmentId: fragment.id,
    });
    const startedAt = now();
    let result: SemanticMappingInspectionResult;
    try {
      const proposal = await dependencies.mapper.proposeMapping({
        fragment: retrievalInput,
        candidates,
      });
      result = {
        fragment,
        retrievalInput,
        candidates,
        status:
          proposal.selectedConceptId === null ? 'unresolved' : 'resolved',
        proposal,
        latencyMs: now() - startedAt,
      };
    } catch (error) {
      if (error instanceof SemanticMappingHttpError) throw error;
      result = {
        fragment,
        retrievalInput,
        candidates,
        status: 'mapper_error',
        error: classifyMapperError(error),
        latencyMs: now() - startedAt,
      };
    }
    results.push(result);
    options.onProgress?.({
      type: 'complete',
      index,
      total: retrievalFragments.length,
      fragmentId: fragment.id,
      status: result.status,
      latencyMs: result.latencyMs,
    });
  }

  return {
    schemaVersion: 1,
    source: {
      pagesInSource: minimized.pageCount,
      ...(minimized.parsedPages
        ? { parsedPages: [...minimized.parsedPages] }
        : {}),
    },
    summary: buildSummary(
      completeFragments.length,
      retrievalFragments.length,
      results,
    ),
    results,
  };
}
