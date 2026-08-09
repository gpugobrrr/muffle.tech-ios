import type {
  CandidateConcept,
  MappingProposal,
  SemanticMapper,
  SemanticMappingInput,
} from '@/lib/onboarding/semantic-mapping';
import {
  buildSemanticMappingPrompt,
  type SemanticMapperPromptVersion,
} from '@/lib/onboarding/semantic-mapping-prompt';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8080';
const DEFAULT_MODEL = 'local-model';
const MAX_TOKENS = 256;
const PROPOSAL_KEYS = [
  'firmTerm',
  'selectedConceptId',
  'confidence',
  'alternatives',
  'rationale',
] as const;

type ChatCompletionResponse = {
  choices?: {
    message?: {
      content?: unknown;
    };
  }[];
};

export class SemanticMappingHttpError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(status: number, endpoint: string) {
    super(`llama.cpp request failed with HTTP ${status}: ${endpoint}`);
    this.name = 'SemanticMappingHttpError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

export class SemanticMappingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SemanticMappingConfigurationError';
  }
}

export class SemanticMappingOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SemanticMappingOutputError';
  }
}

export class NonCandidateConceptError extends SemanticMappingOutputError {
  constructor(field: string, conceptId: string) {
    super(`${field} contains non-candidate ontology concept ID "${conceptId}".`);
    this.name = 'NonCandidateConceptError';
  }
}

function endpointFor(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
}

function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
    );
  } catch {
    return false;
  }
}

function assertDevelopmentConfiguration(baseUrl: string): void {
  if (process.env.NODE_ENV === 'production') {
    throw new SemanticMappingConfigurationError(
      'The local semantic mapper is development-only and cannot run in production.',
    );
  }
  if (!isLocalhostUrl(baseUrl)) {
    throw new SemanticMappingConfigurationError(
      'The local semantic mapper only permits a localhost llama.cpp endpoint.',
    );
  }
}

function extractContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new SemanticMappingOutputError('llama.cpp response is not an object.');
  }
  const response = payload as ChatCompletionResponse;
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new SemanticMappingOutputError(
      'llama.cpp response did not contain message.content text.',
    );
  }
  return content.trim();
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SemanticMappingOutputError('llama.cpp returned invalid JSON.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateMappingProposal(
  value: unknown,
  candidates: readonly CandidateConcept[],
): MappingProposal {
  if (!isRecord(value)) {
    throw new SemanticMappingOutputError('MappingProposal must be a JSON object.');
  }
  const keys = Object.keys(value).sort();
  const expectedKeys = [...PROPOSAL_KEYS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw new SemanticMappingOutputError(
      `MappingProposal keys must be exactly: ${PROPOSAL_KEYS.join(', ')}; received: ${keys.join(', ')}.`,
    );
  }

  const firmTerm = value.firmTerm;
  const selectedConceptId = value.selectedConceptId;
  const confidence = value.confidence;
  const alternatives = value.alternatives;
  const rationale = value.rationale;
  if (typeof firmTerm !== 'string' || firmTerm.trim().length === 0) {
    throw new SemanticMappingOutputError('firmTerm must be a non-empty string.');
  }
  if (
    selectedConceptId !== null &&
    (typeof selectedConceptId !== 'string' || selectedConceptId.trim().length === 0)
  ) {
    throw new SemanticMappingOutputError(
      'selectedConceptId must be a non-empty string or null.',
    );
  }
  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    throw new SemanticMappingOutputError(
      'confidence must be a finite number between 0 and 1.',
    );
  }
  if (
    !Array.isArray(alternatives) ||
    alternatives.some(
      (alternative) =>
        typeof alternative !== 'string' || alternative.trim().length === 0,
    )
  ) {
    throw new SemanticMappingOutputError(
      'alternatives must be an array of non-empty strings.',
    );
  }
  if (typeof rationale !== 'string' || rationale.trim().length === 0) {
    throw new SemanticMappingOutputError('rationale must be a non-empty string.');
  }

  const candidateIds = new Set(candidates.map((candidate) => candidate.conceptId));
  if (selectedConceptId !== null && !candidateIds.has(selectedConceptId)) {
    throw new NonCandidateConceptError('selectedConceptId', selectedConceptId);
  }
  for (const alternative of alternatives) {
    if (!candidateIds.has(alternative)) {
      throw new NonCandidateConceptError('alternatives', alternative);
    }
  }
  if (new Set(alternatives).size !== alternatives.length) {
    throw new SemanticMappingOutputError('alternatives must not contain duplicates.');
  }

  return {
    firmTerm: firmTerm.trim(),
    selectedConceptId,
    confidence,
    alternatives: [...alternatives],
    rationale: rationale.trim(),
  };
}

export type LlamaCppSemanticMapperOptions = {
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  promptVersion?: SemanticMapperPromptVersion;
};

export class LlamaCppSemanticMapper implements SemanticMapper {
  readonly baseUrl: string;
  readonly model: string;
  private readonly fetchImpl: typeof fetch;
  readonly promptVersion: SemanticMapperPromptVersion;

  constructor(options: LlamaCppSemanticMapperOptions = {}) {
    this.baseUrl =
      options.baseUrl ||
      process.env.MUFFLE_LLAMA_CPP_BASE_URL?.trim() ||
      DEFAULT_BASE_URL;
    this.model =
      options.model ||
      process.env.MUFFLE_LLAMA_CPP_MODEL?.trim() ||
      DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.promptVersion = options.promptVersion ?? 'v1';
    assertDevelopmentConfiguration(this.baseUrl);
  }

  async proposeMapping(input: SemanticMappingInput): Promise<MappingProposal> {
    if (input.candidates.length === 0) {
      throw new SemanticMappingOutputError(
        'Semantic mapping requires at least one candidate concept.',
      );
    }
    const endpoint = endpointFor(this.baseUrl);
    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: buildSemanticMappingPrompt(input, this.promptVersion),
            },
          ],
          temperature: 0,
          max_tokens: MAX_TOKENS,
          response_format: { type: 'json_object' },
          chat_template_kwargs: { enable_thinking: false },
        }),
      });
    } catch (error) {
      throw new SemanticMappingHttpError(
        0,
        `${endpoint} (${error instanceof Error ? error.message : String(error)})`,
      );
    }
    if (!response.ok) {
      throw new SemanticMappingHttpError(response.status, endpoint);
    }

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw new SemanticMappingOutputError(
        'llama.cpp returned an invalid HTTP JSON response.',
      );
    }
    const content = extractContent(payload);
    return validateMappingProposal(parseJson(content), input.candidates);
  }
}
