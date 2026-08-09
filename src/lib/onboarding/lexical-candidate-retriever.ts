import type { MuffleOntologyV1, OntologyConcept } from '@/domain/ontology/muffle-ontology.v1';
import type {
  CandidateConcept,
  CandidateRetriever,
  FirmSemanticFragment,
} from '@/lib/onboarding/semantic-mapping';

const DEFAULT_TOP_K = 5;
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'for',
  'in',
  'of',
  'on',
  'the',
  'to',
  'with',
]);

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
}

function normalizeToken(token: string): string {
  return token.endsWith('s') && token.length > 3 ? token.slice(0, -1) : token;
}

function tokens(value: string): string[] {
  return [...new Set(normalize(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map(normalizeToken))];
}

function parentContext(
  concept: OntologyConcept,
  ontology: MuffleOntologyV1,
): string {
  const labels: string[] = [];
  let parentId = concept.parentId;
  while (parentId) {
    const parent = ontology.concepts.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    labels.push(`${parent.label} ${parent.id}`);
    parentId = parent.parentId;
  }
  return labels.join(' ');
}

function searchableText(
  concept: OntologyConcept,
  ontology: MuffleOntologyV1,
): string {
  return [
    concept.id,
    concept.label,
    ...(concept.aliases ?? []),
    concept.description,
    parentContext(concept, ontology),
  ].join(' ');
}

function scoreConcept(
  fragment: FirmSemanticFragment,
  concept: OntologyConcept,
  ontology: MuffleOntologyV1,
): CandidateConcept {
  const query = [
    fragment.firmTerm,
    fragment.nearbyHeading ?? '',
    fragment.representativeText ?? '',
  ].join(' ');
  const queryTokens = tokens(query);
  const conceptText = normalize(searchableText(concept, ontology));
  const conceptTokens = new Set(tokens(searchableText(concept, ontology)));
  const matchedTerms = queryTokens.filter((token) => conceptTokens.has(token));
  const phrase = normalize(fragment.firmTerm);
  const phraseMatch = phrase.length > 0 && conceptText.includes(phrase);
  const labelMatch =
    normalize(concept.label).includes(phrase) ||
    phrase.includes(normalize(concept.label));
  const score = Math.min(
    1,
    matchedTerms.length / Math.max(queryTokens.length, 1) +
      (phraseMatch ? 0.35 : 0) +
      (labelMatch ? 0.25 : 0),
  );

  return {
    conceptId: concept.id,
    label: concept.label,
    aliases: concept.aliases ?? [],
    description: concept.description,
    score,
    matchedTerms,
  };
}

export class LexicalCandidateRetriever implements CandidateRetriever {
  readonly topK: number;

  constructor(topK = DEFAULT_TOP_K) {
    if (!Number.isInteger(topK) || topK < 1) {
      throw new Error('Candidate retriever topK must be a positive integer.');
    }
    this.topK = topK;
  }

  retrieve(
    fragment: FirmSemanticFragment,
    ontology: MuffleOntologyV1,
  ): CandidateConcept[] {
    const scored = ontology.concepts
      .filter((concept) => concept.canonical)
      .map((concept) => scoreConcept(fragment, concept, ontology))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.conceptId.localeCompare(right.conceptId),
      );

    return scored.slice(0, this.topK);
  }
}

export const defaultCandidateRetriever = new LexicalCandidateRetriever();
