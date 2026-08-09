import type { MuffleOntologyV1 } from '@/domain/ontology/muffle-ontology.v1';
import type { PiiMinimizedDocument } from '@/lib/onboarding/documents/privacy/pii-minimized-document';
import { isSemanticElementHeading } from '@/lib/onboarding/documents/semantic-fragment-extractor';
import { isAdministrativeSemanticText } from '@/lib/onboarding/documents/semantic-fragment-retrieval';
import type {
  CandidateConcept,
  CandidateRetriever,
} from '@/lib/onboarding/semantic-mapping';

export type OntologyTermType = 'element' | 'section' | 'unknown';

export type OntologySeedDocument = {
  /** Privacy-safe caller-supplied ID, such as source-1. */
  sourceDocumentId: string;
  document: PiiMinimizedDocument;
};

export type OntologyTermEvidence = {
  sourceDocumentId: string;
  termType: OntologyTermType;
  originalTerm: string;
  normalizedTerm: string;
  page: number;
  sourceBlockIds: string[];
  sectionHeading?: string;
};

export type OntologyConceptProposal = {
  id: string;
  status: 'candidate';
  termType: OntologyTermType;
  normalizedTerm: string;
  sourceTerms: string[];
  occurrences: number;
  sourceDocumentCount: number;
  evidence: OntologyTermEvidence[];
  existingConceptMatches: CandidateConcept[];
};

const STRUCTURAL_CODE_PATTERN = /^[A-Z][0-9]+\s+/;
const NON_DOMAIN_NAVIGATION_HEADINGS = new Set(['contents']);
const STANDALONE_PLACEHOLDER_PATTERN =
  /^\[(?:EMAIL|PHONE|POSTCODE|PERSON|ADDRESS|REFERENCE|SIGNATURE|PROFESSIONAL_ID)\]$/;
const TERM_TYPE_ORDER: Record<OntologyTermType, number> = {
  element: 0,
  section: 1,
  unknown: 2,
};

type StructuralHeading = {
  sourceBlockId: string;
  page: number;
  originalTerm: string;
  termType: OntologyTermType;
};

function stableCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function displayTerm(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export function normalizeOntologySeedTerm(
  value: string,
  stripStructuralCode = false,
): string {
  const normalized = displayTerm(value);
  const withoutCode = stripStructuralCode
    ? normalized.replace(STRUCTURAL_CODE_PATTERN, '')
    : normalized;
  return withoutCode
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isEligibleHeadingText(value: string): boolean {
  const normalized = displayTerm(value);
  return (
    normalized.length > 0 &&
    !STANDALONE_PLACEHOLDER_PATTERN.test(normalized) &&
    !isAdministrativeSemanticText(normalized) &&
    !NON_DOMAIN_NAVIGATION_HEADINGS.has(
      normalizeOntologySeedTerm(normalized),
    )
  );
}

function classifyStructuralHeadings(
  document: PiiMinimizedDocument,
): StructuralHeading[] {
  const headings = document.blocks
    .filter(
      (block) =>
        block.type === 'heading' &&
        !block.likelyPageFurniture &&
        block.text !== undefined &&
        isEligibleHeadingText(block.text),
    )
    .map((block) => ({
      sourceBlockId: block.sourceBlockId,
      page: block.page,
      originalTerm: displayTerm(block.text ?? ''),
    }));

  return headings.map((heading, index) => {
    if (isSemanticElementHeading(heading.originalTerm)) {
      return { ...heading, termType: 'element' };
    }
    const nextUncodedIndex = headings.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        !isSemanticElementHeading(candidate.originalTerm),
    );
    const end =
      nextUncodedIndex === -1 ? headings.length : nextUncodedIndex;
    const hasCodedChild = headings
      .slice(index + 1, end)
      .some((candidate) => isSemanticElementHeading(candidate.originalTerm));
    return {
      ...heading,
      termType: hasCodedChild ? 'section' : 'unknown',
    };
  });
}

export function extractOntologyTermEvidence(
  source: OntologySeedDocument,
): OntologyTermEvidence[] {
  const evidence: OntologyTermEvidence[] = [];
  let sectionHeading: string | undefined;

  for (const heading of classifyStructuralHeadings(source.document)) {
    if (heading.termType === 'section') {
      sectionHeading = heading.originalTerm;
    }
    const normalizedTerm = normalizeOntologySeedTerm(
      heading.originalTerm,
      heading.termType === 'element',
    );
    if (!normalizedTerm) continue;
    evidence.push({
      sourceDocumentId: source.sourceDocumentId,
      termType: heading.termType,
      originalTerm: heading.originalTerm,
      normalizedTerm,
      page: heading.page,
      sourceBlockIds: [heading.sourceBlockId],
      ...(heading.termType !== 'section' && sectionHeading
        ? { sectionHeading }
        : {}),
    });
  }

  return evidence;
}

export function collectOntologyTermEvidence(
  sources: readonly OntologySeedDocument[],
): OntologyTermEvidence[] {
  return sources.flatMap(extractOntologyTermEvidence);
}

function proposalId(
  termType: OntologyTermType,
  normalizedTerm: string,
): string {
  const slug = normalizedTerm.replace(/\s+/g, '-');
  return `ontology-proposal:${termType}:${slug}`;
}

function groupKey(evidence: OntologyTermEvidence): string {
  return `${evidence.termType}\u0000${evidence.normalizedTerm}`;
}

function sortEvidence(
  evidence: readonly OntologyTermEvidence[],
): OntologyTermEvidence[] {
  return [...evidence].sort(
    (left, right) =>
      stableCompare(left.sourceDocumentId, right.sourceDocumentId) ||
      left.page - right.page ||
      stableCompare(
        left.sourceBlockIds.join('\u0000'),
        right.sourceBlockIds.join('\u0000'),
      ),
  );
}

export function generateOntologyConceptProposals(
  sources: readonly OntologySeedDocument[],
  ontology: MuffleOntologyV1,
  retriever: CandidateRetriever,
): OntologyConceptProposal[] {
  const groups = new Map<string, OntologyTermEvidence[]>();
  for (const evidence of collectOntologyTermEvidence(sources)) {
    const key = groupKey(evidence);
    const group = groups.get(key);
    if (group) group.push(evidence);
    else groups.set(key, [evidence]);
  }

  return [...groups.values()]
    .map((group): OntologyConceptProposal => {
      const evidence = sortEvidence(group);
      const first = evidence[0];
      const existingConceptMatches = retriever
        .retrieve(
          {
            firmTerm: first.normalizedTerm,
            ...(first.sectionHeading
              ? { nearbyHeading: first.sectionHeading }
              : {}),
          },
          ontology,
        )
        .filter(({ score }) => score > 0);
      return {
        id: proposalId(first.termType, first.normalizedTerm),
        status: 'candidate',
        termType: first.termType,
        normalizedTerm: first.normalizedTerm,
        sourceTerms: [
          ...new Set(evidence.map(({ originalTerm }) => originalTerm)),
        ].sort(stableCompare),
        occurrences: evidence.length,
        sourceDocumentCount: new Set(
          evidence.map(({ sourceDocumentId }) => sourceDocumentId),
        ).size,
        evidence,
        existingConceptMatches,
      };
    })
    .sort(
      (left, right) =>
        TERM_TYPE_ORDER[left.termType] - TERM_TYPE_ORDER[right.termType] ||
        stableCompare(left.normalizedTerm, right.normalizedTerm),
    );
}
