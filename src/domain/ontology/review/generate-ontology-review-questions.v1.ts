import {
  MUFFLE_ONTOLOGY_V1,
  type MuffleOntologyV1,
} from '@/domain/ontology/muffle-ontology.v1';
import {
  auditMuffleOntologyCandidatesV1,
  type OntologyCandidateAuditIssue,
  type OntologyCandidateAuditResult,
} from '@/domain/ontology/review/audit-muffle-ontology-candidates.v1';
import {
  MUFFLE_ONTOLOGY_CANDIDATES_V1,
  MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1,
  type OntologyCandidateProposal,
  type OntologyCandidateRelationship,
} from '@/domain/ontology/review/muffle-ontology-candidates.v1';

export const ONTOLOGY_REVIEW_QUESTION_SET_VERSION = 'ontology-review-v1' as const;
export const ONTOLOGY_REVIEW_ANSWER_OPTIONS = ['yes', 'no', 'not-sure'] as const;

export type OntologyReviewAnswer = (typeof ONTOLOGY_REVIEW_ANSWER_OPTIONS)[number];

export type OntologyReviewQuestion = {
  id: string;
  candidateId?: string;
  auditIssueCodes?: readonly string[];
  question: string;
  context?: {
    sourceTerm?: string;
    proposedTerm?: string;
  };
  answerType: 'yes-no-not-sure';
};

export type OntologyReviewManualQuestion = {
  candidateId?: string;
  relationshipId?: string;
  auditIssueCodes: readonly string[];
  reason: string;
};

export type OntologyReviewQuestionSet = {
  version: typeof ONTOLOGY_REVIEW_QUESTION_SET_VERSION;
  questions: readonly OntologyReviewQuestion[];
  manualQuestionReview: readonly OntologyReviewManualQuestion[];
};

export type GenerateOntologyReviewQuestionsInput = {
  candidates?: readonly OntologyCandidateProposal[];
  relationships?: readonly OntologyCandidateRelationship[];
  audit?: OntologyCandidateAuditResult;
  ontology?: MuffleOntologyV1;
};

function displayTerm(candidate: OntologyCandidateProposal): string {
  return candidate.label?.trim() || candidate.sourceTerm.trim();
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

function questionFor(
  candidate: OntologyCandidateProposal,
  issues: readonly OntologyCandidateAuditIssue[],
  candidatesById: ReadonlyMap<string, OntologyCandidateProposal>,
  ontology: MuffleOntologyV1,
): OntologyReviewQuestion | undefined {
  const term = displayTerm(candidate);
  const codes = issues.map(({ code }) => code).sort();
  const duplicate = issues.find(({ code }) => code === 'POTENTIAL_SEMANTIC_DUPLICATE');
  if (duplicate?.relatedCandidateIds?.[0]) {
    const other = candidatesById.get(duplicate.relatedCandidateIds[0]);
    if (other) {
      return {
        id: `question.${candidate.id}.same-as.${other.id}`,
        candidateId: candidate.id,
        auditIssueCodes: codes,
        question: `Does “${term}” mean the same thing as “${displayTerm(other)}” in a surveying inspection?`,
        context: { sourceTerm: candidate.sourceTerm, proposedTerm: displayTerm(other) },
        answerType: 'yes-no-not-sure',
      };
    }
  }

  const overlap = issues.find(({ code }) => code === 'OVERLAPS_EXISTING_CANONICAL_CONCEPT');
  if (overlap) {
    const existing = canonicalLabel(ontology, overlap.conceptId);
    return {
      id: `question.${candidate.id}.same-as-existing`,
      candidateId: candidate.id,
      auditIssueCodes: codes,
      question: `Does “${term}” mean the same thing as “${existing}” in a surveying inspection?`,
      context: { sourceTerm: candidate.sourceTerm, proposedTerm: existing },
      answerType: 'yes-no-not-sure',
    };
  }

  if (candidate.classification === 'alias' && candidate.mapsToExistingConceptId) {
    const existing = canonicalLabel(ontology, candidate.mapsToExistingConceptId);
    return {
      id: `question.${candidate.id}.alias`,
      candidateId: candidate.id,
      auditIssueCodes: codes,
      question: `Does “${candidate.sourceTerm}” mean the same thing as “${existing}”?`,
      context: { sourceTerm: candidate.sourceTerm, proposedTerm: existing },
      answerType: 'yes-no-not-sure',
    };
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
      question: `Should an inspection note be treated separately from evidence that supports a finding?`,
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

/**
 * Converts deterministic audit findings into compact, surveyor-readable questions.
 * It deliberately does not modify the candidate register or canonical ontology.
 */
export function generateOntologyReviewQuestionsV1(
  input: GenerateOntologyReviewQuestionsInput = {},
): OntologyReviewQuestionSet {
  const candidates = input.candidates ?? MUFFLE_ONTOLOGY_CANDIDATES_V1;
  const relationships =
    input.relationships ?? MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1;
  const ontology = input.ontology ?? MUFFLE_ONTOLOGY_V1;
  const audit =
    input.audit ??
    auditMuffleOntologyCandidatesV1({ candidates, ontology });
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const questions: OntologyReviewQuestion[] = [];
  const manualQuestionReview: OntologyReviewManualQuestion[] = [];

  for (const candidate of [...candidates].sort((left, right) => left.id.localeCompare(right.id))) {
    const issues = candidateIssues(audit, candidate.id);
    if (!candidate.expertReviewRequired && issues.length === 0) continue;

    const question = questionFor(candidate, issues, candidatesById, ontology);
    if (question) {
      questions.push(question);
    } else if (issues.length > 0 || candidate.expertReviewRequired) {
      manualQuestionReview.push({
        candidateId: candidate.id,
        auditIssueCodes: issues.map(({ code }) => code).sort(),
        reason:
          'Existing structured metadata does not support one focused yes/no/not-sure question.',
      });
    }
  }

  for (const relationship of [...relationships].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!relationship.expertReviewRequired) continue;
    const subject = labelForId(candidates, ontology, relationship.subjectId);
    const object = labelForId(candidates, ontology, relationship.objectId);
    questions.push({
      id: `question.${relationship.id}.relationship`,
      auditIssueCodes: ['EXPERT_REVIEW_REQUIRED'],
      question: `Should “${subject}” be understood as “${relationship.predicate.replaceAll('_', ' ')}” “${object}” in a surveying finding?`,
      context: { sourceTerm: subject, proposedTerm: object },
      answerType: 'yes-no-not-sure',
    });
  }

  return {
    version: ONTOLOGY_REVIEW_QUESTION_SET_VERSION,
    questions,
    manualQuestionReview,
  };
}
