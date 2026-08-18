import {
  CANONICAL_DEFECT_LIST,
  type CanonicalDefectDefinition,
  type CanonicalDefectId,
} from '@/domain/ontology/canonical-defects';
import {
  normalizePhrase,
  stemToken,
  tokenize,
} from '@/domain/normalization/deterministic-matcher';

export const SEMANTIC_CONFIDENCE_THRESHOLD = 0.65;

export type SemanticMatch = {
  defectId: Exclude<CanonicalDefectId, 'unclassified'>;
  confidence: number;
  scores: Readonly<Record<string, number>>;
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'from',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'along',
  'out',
  'up',
  'into',
  'over',
  'there',
  'their',
  'no',
]);

function contentTokens(input: string): string[] {
  return tokenize(input)
    .filter((token) => !STOP_WORDS.has(token) && !/^cr[123]$/.test(token))
    .map(stemToken);
}

function charNgrams(text: string, size = 3): Set<string> {
  const compact = normalizePhrase(text)
    .split(' ')
    .filter((token) => !STOP_WORDS.has(token))
    .join('');
  const grams = new Set<string>();
  if (compact.length < size) {
    if (compact.length > 0) grams.add(compact);
    return grams;
  }
  for (let index = 0; index <= compact.length - size; index += 1) {
    grams.add(compact.slice(index, index + size));
  }
  return grams;
}

function diceCoefficient(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const gram of left) {
    if (right.has(gram)) intersection += 1;
  }
  return (2 * intersection) / (left.size + right.size);
}

function cosineSimilarity(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const leftValue = left[key] ?? 0;
    const rightValue = right[key] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function defectVector(
  definition: CanonicalDefectDefinition,
): Record<string, number> {
  const vector: Record<string, number> = {};
  for (const [token, weight] of Object.entries(definition.tokenWeights)) {
    vector[stemToken(token)] = Math.max(vector[stemToken(token)] ?? 0, weight);
  }
  return vector;
}

function queryVector(
  tokens: readonly string[],
  featureSpace: Readonly<Record<string, number>>,
): Record<string, number> {
  const vector: Record<string, number> = {};
  for (const token of tokens) {
    if (featureSpace[token] !== undefined) {
      vector[token] = (vector[token] ?? 0) + 1;
    }
  }
  return vector;
}

function ngramScore(
  query: string,
  definition: CanonicalDefectDefinition,
): number {
  const queryGrams = charNgrams(query);
  let best = diceCoefficient(queryGrams, charNgrams(definition.title));
  for (const alias of definition.aliases) {
    best = Math.max(best, diceCoefficient(queryGrams, charNgrams(alias)));
  }
  for (const phrase of definition.semanticPhrases) {
    best = Math.max(best, diceCoefficient(queryGrams, charNgrams(phrase)));
  }
  return best;
}

function tokenOverlapScore(
  tokens: readonly string[],
  definition: CanonicalDefectDefinition,
): number {
  const querySet = new Set(tokens);
  const weighted = Object.entries(definition.tokenWeights);
  if (weighted.length === 0 || querySet.size === 0) return 0;

  let matchedWeight = 0;
  let totalWeight = 0;
  for (const [token, weight] of weighted) {
    totalWeight += weight;
    if (querySet.has(stemToken(token))) {
      matchedWeight += weight;
    }
  }

  let queryHits = 0;
  const triggerStems = new Set(weighted.map(([token]) => stemToken(token)));
  for (const token of querySet) {
    if (triggerStems.has(token)) queryHits += 1;
  }

  const recall = totalWeight > 0 ? matchedWeight / totalWeight : 0;
  const precision = queryHits / querySet.size;
  return 0.6 * recall + 0.4 * precision;
}

function scoreDefect(
  query: string,
  tokens: readonly string[],
  definition: CanonicalDefectDefinition,
): number {
  const features = defectVector(definition);
  const cosine = cosineSimilarity(queryVector(tokens, features), features);
  const overlap = tokenOverlapScore(tokens, definition);
  const ngram = ngramScore(query, definition);
  return 0.35 * cosine + 0.3 * overlap + 0.35 * ngram;
}

export function matchSemantic(input: string): SemanticMatch | null {
  const tokens = contentTokens(input);
  if (tokens.length === 0) return null;

  const scores: Record<string, number> = {};
  let bestId: Exclude<CanonicalDefectId, 'unclassified'> | null = null;
  let bestScore = 0;

  for (const definition of CANONICAL_DEFECT_LIST) {
    const score = scoreDefect(input, tokens, definition);
    scores[definition.id] = score;
    if (score > bestScore) {
      bestScore = score;
      bestId = definition.id;
    }
  }

  if (!bestId || bestScore < SEMANTIC_CONFIDENCE_THRESHOLD) {
    return null;
  }

  return {
    defectId: bestId,
    confidence: bestScore,
    scores,
  };
}

export function scoreSemanticCandidates(
  input: string,
): Readonly<Record<string, number>> {
  const tokens = contentTokens(input);
  const scores: Record<string, number> = {};
  for (const definition of CANONICAL_DEFECT_LIST) {
    scores[definition.id] = scoreDefect(input, tokens, definition);
  }
  return scores;
}
