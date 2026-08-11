import {
  MUFFLE_ONTOLOGY_V1,
  type MuffleOntologyV1,
} from '@/domain/ontology/muffle-ontology.v1';
import {
  auditMuffleOntologyCandidatesV1,
  type OntologyCandidateAuditIssue,
  type OntologyCandidateAuditResult,
} from '@/domain/ontology/review/audit-muffle-ontology-candidates.v1';
import type {
  OntologyReviewManualQuestion,
  OntologyReviewQuestion,
} from '@/domain/ontology/review/generate-ontology-review-questions.v1';
import {
  MUFFLE_ONTOLOGY_CANDIDATES_V1,
  MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1,
  type OntologyCandidateProposal,
  type OntologyCandidateRelationship,
} from '@/domain/ontology/review/muffle-ontology-candidates.v1';

export const ONTOLOGY_REVIEW_QUESTION_SET_V2_VERSION = 'ontology-review-v2' as const;

export type OntologyReviewQuestionSetV2 = {
  version: typeof ONTOLOGY_REVIEW_QUESTION_SET_V2_VERSION;
  questions: readonly OntologyReviewQuestion[];
  manualQuestionReview: readonly OntologyReviewManualQuestion[];
};

export type GenerateOntologyReviewQuestionsV2Input = {
  candidates?: readonly OntologyCandidateProposal[];
  relationships?: readonly OntologyCandidateRelationship[];
  audit?: OntologyCandidateAuditResult;
  ontology?: MuffleOntologyV1;
};

const GENERIC_COMPARISON_TOKENS = new Set([
  'building',
  'element',
  'external',
  'installation',
  'internal',
  'property',
  'system',
]);

function displayTerm(candidate: OntologyCandidateProposal): string {
  return candidate.label?.trim() || candidate.sourceTerm.trim();
}

export function normalizeOntologyReviewComparisonTerm(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(\w{4,})s\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function meaningfulTokens(value: string): Set<string> {
  return new Set(
    normalizeOntologyReviewComparisonTerm(value)
      .split(' ')
      .filter((token) => token && !GENERIC_COMPARISON_TOKENS.has(token)),
  );
}

function candidateTarget(candidate: OntologyCandidateProposal): string | undefined {
  return candidate.proposedConceptId ?? candidate.mapsToExistingConceptId;
}

function isMeaningfulComparison(
  left: OntologyCandidateProposal,
  right: OntologyCandidateProposal,
): boolean {
  const leftTerm = displayTerm(left);
  const rightTerm = displayTerm(right);
  const leftTarget = candidateTarget(left);
  const rightTarget = candidateTarget(right);
  if (
    left.id === right.id ||
    normalizeOntologyReviewComparisonTerm(leftTerm) ===
      normalizeOntologyReviewComparisonTerm(rightTerm) ||
    (leftTarget && rightTarget && leftTarget === rightTarget)
  ) {
    return false;
  }

  const rightTokens = meaningfulTokens(rightTerm);
  return [...meaningfulTokens(leftTerm)].some((token) => rightTokens.has(token));
}

function hasMeaningfulTermOverlap(left: string, right: string): boolean {
  if (
    normalizeOntologyReviewComparisonTerm(left) ===
    normalizeOntologyReviewComparisonTerm(right)
  ) {
    return false;
  }
  const rightTokens = meaningfulTokens(right);
  return [...meaningfulTokens(left)].some((token) => rightTokens.has(token));
}

function candidateIssues(
  audit: OntologyCandidateAuditResult,
  candidateId: string,
): OntologyCandidateAuditIssue[] {
  return audit.warnings.filter(
    (issue) =>
      issue.candidateId === candidateId ||
      issue.relatedCandidateIds?.includes(candidateId) === true,
  );
}

function canonicalLabel(ontology: MuffleOntologyV1, conceptId: string | undefined): string {
  return (
    ontology.concepts.find((concept) => concept.id === conceptId)?.label ??
    conceptId ??
    'the existing surveying concept'
  );
}

function labelForId(
  candidates: readonly OntologyCandidateProposal[],
  ontology: MuffleOntologyV1,
  id: string,
): string {
  const candidate = candidates.find(
    ({ proposedConceptId, mapsToExistingConceptId }) =>
      proposedConceptId === id || mapsToExistingConceptId === id,
  );
  return candidate ? displayTerm(candidate) : canonicalLabel(ontology, id);
}

function duplicatePeer(
  candidate: OntologyCandidateProposal,
  issues: readonly OntologyCandidateAuditIssue[],
  candidatesById: ReadonlyMap<string, OntologyCandidateProposal>,
): OntologyCandidateProposal | undefined {
  const peers = issues
    .filter(({ code }) => code === 'POTENTIAL_SEMANTIC_DUPLICATE')
    .flatMap((issue) => [issue.candidateId, ...(issue.relatedCandidateIds ?? [])])
    .filter((id): id is string => Boolean(id) && id !== candidate.id)
    .map((id) => candidatesById.get(id))
    .filter((peer): peer is OntologyCandidateProposal => Boolean(peer))
    .filter((peer) => candidate.id.localeCompare(peer.id) < 0)
    .filter((peer) => isMeaningfulComparison(candidate, peer))
    .sort((left, right) => left.id.localeCompare(right.id));
  return peers[0];
}

function uniqueIssueCodes(issues: readonly OntologyCandidateAuditIssue[]): string[] {
  return [...new Set(issues.map(({ code }) => code))].sort();
}

function questionFor(
  candidate: OntologyCandidateProposal,
  issues: readonly OntologyCandidateAuditIssue[],
  candidatesById: ReadonlyMap<string, OntologyCandidateProposal>,
  ontology: MuffleOntologyV1,
): OntologyReviewQuestion | undefined {
  const term = displayTerm(candidate);
  const codes = uniqueIssueCodes(issues);
  const other = duplicatePeer(candidate, issues, candidatesById);
  if (other) {
    return {
      id: `question.${candidate.id}.same-as.${other.id}`,
      candidateId: candidate.id,
      relatedCandidateIds: [other.id],
      auditIssueCodes: codes,
      question: `Does “${term}” mean the same thing as “${displayTerm(other)}” in a surveying inspection?`,
      context: { sourceTerm: candidate.sourceTerm, proposedTerm: displayTerm(other) },
      answerType: 'yes-no-not-sure',
    };
  }

  const overlap = issues.find(({ code }) => code === 'OVERLAPS_EXISTING_CANONICAL_CONCEPT');
  if (overlap) {
    const existing = canonicalLabel(ontology, overlap.conceptId);
    if (hasMeaningfulTermOverlap(term, existing)) {
      return {
        id: `question.${candidate.id}.same-as-existing`,
        candidateId: candidate.id,
        auditIssueCodes: codes,
        question: `Does “${term}” mean the same thing as “${existing}” in a surveying inspection?`,
        context: { sourceTerm: candidate.sourceTerm, proposedTerm: existing },
        answerType: 'yes-no-not-sure',
      };
    }
  }

  if (candidate.classification === 'alias' && candidate.mapsToExistingConceptId) {
    const existing = canonicalLabel(ontology, candidate.mapsToExistingConceptId);
    if (hasMeaningfulTermOverlap(candidate.sourceTerm, existing)) {
      return {
        id: `question.${candidate.id}.alias`,
        candidateId: candidate.id,
        auditIssueCodes: codes,
        question: `Does “${candidate.sourceTerm}” mean the same thing as “${existing}”?`,
        context: { sourceTerm: candidate.sourceTerm, proposedTerm: existing },
        answerType: 'yes-no-not-sure',
      };
    }
  }

  if (codes.includes('ATTRIBUTE_ENTITY_SUSPICION')) {
    return {
      id: `question.${candidate.id}.attribute-or-concept`,
      candidateId: candidate.id,
      auditIssueCodes: codes,
      question: `Should “${term}” be treated as a separate surveying concept rather than a property or value?`,
      context: { sourceTerm: candidate.sourceTerm },
      answerType: 'yes-no-not-sure',
    };
  }

  if (codes.includes('NOTE_EVIDENCE_CONFUSION')) {
    return {
      id: `question.${candidate.id}.note-or-evidence`,
      candidateId: candidate.id,
      auditIssueCodes: codes,
      question: 'Should an inspection note be treated separately from evidence that supports a finding?',
      context: { sourceTerm: candidate.sourceTerm },
      answerType: 'yes-no-not-sure',
    };
  }

  if (
    candidate.classification === 'publication' ||
    codes.includes('REPORT_TERMINOLOGY_AS_CANONICAL')
  ) {
    return {
      id: `question.${candidate.id}.publication-wording`,
      candidateId: candidate.id,
      auditIssueCodes: codes,
      question: `Does “${candidate.sourceTerm}” describe an underlying surveying concept rather than only a report heading?`,
      context: { sourceTerm: candidate.sourceTerm },
      answerType: 'yes-no-not-sure',
    };
  }

  if (
    candidate.classification === 'proposed-canonical-concept' &&
    (candidate.confidence === 'low' || candidate.expertReviewRequired)
  ) {
    return {
      id: `question.${candidate.id}.canonical-independence`,
      candidateId: candidate.id,
      auditIssueCodes: codes,
      question: `Would “${term}” still be a meaningful surveying concept if report headings changed?`,
      context: { sourceTerm: candidate.sourceTerm },
      answerType: 'yes-no-not-sure',
    };
  }

  return undefined;
}

function lowerFirst(value: string): string {
  return value ? value[0].toLowerCase() + value.slice(1) : value;
}

function article(value: string): string {
  return /^[aeiou]/i.test(value) ? 'an' : 'a';
}

function relationshipQuestion(
  relationship: OntologyCandidateRelationship,
  subjectLabel: string,
  objectLabel: string,
): string | undefined {
  const subject = lowerFirst(subjectLabel);
  const object = lowerFirst(objectLabel);
  const templates: Partial<
    Record<OntologyCandidateRelationship['predicate'], () => string>
  > = {
    explains: () => `Can ${article(object)} recorded ${object} have a likely ${subject}?`,
    is_supported_by: () =>
      `Can ${article(object)} ${object} provide support for identifying ${article(subject)} ${subject}?`,
    supports: () => `Can ${subject} support ${article(object)} ${object}?`,
    results_from: () => `Can ${article(object)} ${object} have ${article(subject)} ${subject}?`,
    investigates: () =>
      `Can ${subject} be recommended because inspection was limited?`,
    addresses: () =>
      `Can ${article(subject)} ${subject} be made in response to ${article(object)} ${object}?`,
    arises_from: () =>
      `Can an identified ${object} give rise to ${article(subject)} ${subject}?`,
  };
  return templates[relationship.predicate]?.();
}

/**
 * Produces the corrected future review set. The completed v1 JSON remains frozen
 * and is intentionally not regenerated by this function.
 */
export function generateOntologyReviewQuestionsV2(
  input: GenerateOntologyReviewQuestionsV2Input = {},
): OntologyReviewQuestionSetV2 {
  const candidates = input.candidates ?? MUFFLE_ONTOLOGY_CANDIDATES_V1;
  const relationships =
    input.relationships ?? MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1;
  const ontology = input.ontology ?? MUFFLE_ONTOLOGY_V1;
  const audit =
    input.audit ??
    auditMuffleOntologyCandidatesV1({ candidates, relationships, ontology });
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const questions: OntologyReviewQuestion[] = [];
  const manualQuestionReview: OntologyReviewManualQuestion[] = [];

  for (const candidate of [...candidates].sort((left, right) => left.id.localeCompare(right.id))) {
    const issues = candidateIssues(audit, candidate.id);
    if (!candidate.expertReviewRequired && issues.length === 0) continue;
    const question = questionFor(candidate, issues, candidatesById, ontology);
    if (question) {
      questions.push(question);
    } else {
      manualQuestionReview.push({
        candidateId: candidate.id,
        auditIssueCodes: uniqueIssueCodes(issues),
        reason:
          'Existing structured metadata does not support one focused yes/no/not-sure question.',
      });
    }
  }

  for (const relationship of [...relationships].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!relationship.expertReviewRequired) continue;
    const subject = labelForId(candidates, ontology, relationship.subjectId);
    const object = labelForId(candidates, ontology, relationship.objectId);
    const question = relationshipQuestion(relationship, subject, object);
    if (!question) {
      manualQuestionReview.push({
        relationshipId: relationship.id,
        auditIssueCodes: ['EXPERT_REVIEW_REQUIRED'],
        reason:
          'No deterministic professional wording is defined for this relationship predicate.',
      });
      continue;
    }
    questions.push({
      id: `question.${relationship.id}.relationship`,
      relationshipId: relationship.id,
      auditIssueCodes: ['EXPERT_REVIEW_REQUIRED'],
      question,
      context: { sourceTerm: subject, proposedTerm: object },
      answerType: 'yes-no-not-sure',
    });
  }

  return {
    version: ONTOLOGY_REVIEW_QUESTION_SET_V2_VERSION,
    questions,
    manualQuestionReview,
  };
}
