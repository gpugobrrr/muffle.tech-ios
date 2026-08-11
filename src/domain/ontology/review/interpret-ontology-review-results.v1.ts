import {
  auditMuffleOntologyCandidatesV1,
  type OntologyCandidateAuditResult,
} from '@/domain/ontology/review/audit-muffle-ontology-candidates.v1';
import type {
  OntologyReviewAnswer,
  OntologyReviewManualQuestion,
  OntologyReviewQuestion,
} from '@/domain/ontology/review/generate-ontology-review-questions.v1';
import {
  MUFFLE_ONTOLOGY_CANDIDATES_V1,
  MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1,
  type OntologyCandidateProposal,
  type OntologyCandidateRelationship,
} from '@/domain/ontology/review/muffle-ontology-candidates.v1';

export const ONTOLOGY_REVIEW_INTERPRETER_VERSION =
  'ontology-review-interpreter-v1' as const;

export type OntologyReviewDisposition =
  | 'approve-for-canonical-review'
  | 'hold-from-canonical-review'
  | 'keep-distinct'
  | 'merge-or-alias-review'
  | 'keep-uncertain'
  | 'publication-boundary-supported'
  | 'relationship-supported'
  | 'relationship-not-supported'
  | 'reask-required'
  | 'manual-review-required'
  | 'invalid-question'
  | 'insufficient-evidence';

export type OntologyReviewValidationIssue = {
  severity: 'error' | 'warning';
  code: string;
  questionId?: string;
  message: string;
};

export type OntologyReviewQuestionSetEvidence = {
  version: string;
  questions: readonly OntologyReviewQuestion[];
  manualQuestionReview: readonly OntologyReviewManualQuestion[];
};

export type NormalizedOntologyReviewAnswer = {
  questionId: string;
  answer: OntologyReviewAnswer;
  reviewerId: string;
  questionSetVersion: string;
  reviewedAt?: string;
  updatedAt?: string;
};

export type InterpretedOntologyReviewItem = {
  questionSetVersion: string;
  questionId: string;
  candidateId?: string;
  relationshipId?: string;
  auditIssueCodes: readonly string[];
  currentAuditIssueCodes: readonly string[];
  questionText: string;
  answer: OntologyReviewAnswer;
  reviewerId: string;
  reviewedAt?: string;
  updatedAt?: string;
  sourceTerm?: string;
  proposedTerm?: string;
  proposedConceptId?: string;
  mapsToExistingConceptId?: string;
  disposition: OntologyReviewDisposition;
  reasonCode: string;
  usableAsOntologyEvidence: boolean;
  furtherExpertReviewRequired: boolean;
};

export type InterpretedOntologyManualReviewItem = {
  questionSetVersion: string;
  candidateId?: string;
  relationshipId?: string;
  auditIssueCodes: readonly string[];
  currentAuditIssueCodes: readonly string[];
  sourceTerm?: string;
  proposedConceptId?: string;
  reason: string;
  disposition: 'manual-review-required';
  usableAsOntologyEvidence: false;
  furtherExpertReviewRequired: true;
};

export type OntologyReviewInterpretationCounts = {
  generatedQuestions: number;
  answersReceived: number;
  matchedAnswers: number;
  yes: number;
  no: number;
  notSure: number;
  usableEvidence: number;
  invalidQuestions: number;
  reaskRequired: number;
  manualReviewRequired: number;
  unknownAnswers: number;
  missingAnswers: number;
};

export type OntologyReviewInterpretationResult = {
  interpreterVersion: typeof ONTOLOGY_REVIEW_INTERPRETER_VERSION;
  questionSetVersion: string;
  sourceDescriptor: string;
  reviewers: readonly string[];
  counts: OntologyReviewInterpretationCounts;
  dispositionTotals: Readonly<Record<string, number>>;
  validationIssues: readonly OntologyReviewValidationIssue[];
  interpretedItems: readonly InterpretedOntologyReviewItem[];
  manualReviewItems: readonly InterpretedOntologyManualReviewItem[];
};

export type InterpretOntologyReviewResultsInput = {
  questionSet: OntologyReviewQuestionSetEvidence;
  answerPayload: unknown;
  sourceDescriptor: string;
  candidates?: readonly OntologyCandidateProposal[];
  relationships?: readonly OntologyCandidateRelationship[];
  audit?: OntologyCandidateAuditResult;
};

type AnswerDecision = Pick<
  InterpretedOntologyReviewItem,
  | 'disposition'
  | 'reasonCode'
  | 'usableAsOntologyEvidence'
  | 'furtherExpertReviewRequired'
>;

type UnknownRecord = Record<string, unknown>;

const KNOWN_V1_BAD_COMPARISON =
  'question.candidate.building_element.internal_wall.same-as.candidate.building_element.internal_door';

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valueAt(record: UnknownRecord, camel: string, snake: string): unknown {
  return record[camel] ?? record[snake];
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeTerm(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueSorted(values: readonly string[] | undefined): string[] {
  return [...new Set(values ?? [])].sort();
}

function sortValidationIssues(
  issues: readonly OntologyReviewValidationIssue[],
): OntologyReviewValidationIssue[] {
  return [...issues].sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      (left.questionId ?? '').localeCompare(right.questionId ?? '') ||
      left.message.localeCompare(right.message),
  );
}

function normalizedAnswers(
  payload: unknown,
  expectedVersion: string,
  issues: OntologyReviewValidationIssue[],
): { answersReceived: number; answers: NormalizedOntologyReviewAnswer[] } {
  let rows: unknown[];
  let envelopeVersion: string | undefined;
  let envelopeReviewerId: string | undefined;

  if (Array.isArray(payload)) {
    rows = payload;
  } else if (isRecord(payload) && Array.isArray(payload.answers)) {
    rows = payload.answers;
    envelopeVersion = textValue(
      valueAt(payload, 'questionSetVersion', 'question_set_version'),
    );
    envelopeReviewerId = textValue(valueAt(payload, 'reviewerId', 'reviewer_id'));
  } else {
    issues.push({
      severity: 'error',
      code: 'MALFORMED_ANSWER_PAYLOAD',
      message: 'Answer payload must be an array or an object containing an answers array.',
    });
    return { answersReceived: 0, answers: [] };
  }

  const answers: NormalizedOntologyReviewAnswer[] = [];
  rows.forEach((row) => {
    if (!isRecord(row)) {
      issues.push({
        severity: 'error',
        code: 'MALFORMED_ANSWER_RECORD',
        message: 'Answer record must be an object.',
      });
      return;
    }
    const questionId = textValue(valueAt(row, 'questionId', 'question_id'));
    const reviewerId =
      textValue(valueAt(row, 'reviewerId', 'reviewer_id')) ?? envelopeReviewerId;
    const questionSetVersion =
      textValue(valueAt(row, 'questionSetVersion', 'question_set_version')) ??
      envelopeVersion;
    const answer = valueAt(row, 'answer', 'answer');
    const reviewedAt = valueAt(row, 'reviewedAt', 'reviewed_at');
    const updatedAt = valueAt(row, 'updatedAt', 'updated_at');

    if (!questionId) {
      issues.push({
        severity: 'error',
        code: 'MALFORMED_ANSWER_RECORD',
        message: 'Answer record requires a question ID.',
      });
      return;
    }
    if (!reviewerId) {
      issues.push({
        severity: 'error',
        code: 'MISSING_REVIEWER_ID',
        questionId,
        message: 'Answer record requires a reviewer ID.',
      });
      return;
    }
    if (!questionSetVersion) {
      issues.push({
        severity: 'error',
        code: 'MISSING_QUESTION_SET_VERSION',
        questionId,
        message: 'Answer record requires a question-set version.',
      });
      return;
    }
    if (questionSetVersion !== expectedVersion) {
      issues.push({
        severity: 'error',
        code: 'QUESTION_SET_VERSION_MISMATCH',
        questionId,
        message: 'Answer question-set version does not match the supplied question set.',
      });
      return;
    }
    if (answer !== 'yes' && answer !== 'no' && answer !== 'not-sure') {
      issues.push({
        severity: 'error',
        code: 'INVALID_ANSWER_VALUE',
        questionId,
        message: 'Answer must be yes, no, or not-sure.',
      });
      return;
    }
    if (
      (reviewedAt !== undefined && typeof reviewedAt !== 'string') ||
      (updatedAt !== undefined && typeof updatedAt !== 'string')
    ) {
      issues.push({
        severity: 'error',
        code: 'MALFORMED_ANSWER_RECORD',
        questionId,
        message: 'Review timestamps must be strings when present.',
      });
      return;
    }

    answers.push({
      questionId,
      answer,
      reviewerId,
      questionSetVersion,
      reviewedAt: textValue(reviewedAt),
      updatedAt: textValue(updatedAt),
    });
  });

  return { answersReceived: rows.length, answers };
}

function currentAuditCodes(
  audit: OntologyCandidateAuditResult,
  id: string | undefined,
): string[] {
  if (!id) return [];
  return uniqueSorted(
    [...audit.errors, ...audit.warnings]
      .filter(
        ({ candidateId, relatedCandidateIds }) =>
          candidateId === id || relatedCandidateIds?.includes(id) === true,
      )
      .map(({ code }) => code),
  );
}

function relationshipIdForQuestion(
  question: OntologyReviewQuestion,
  relationships: readonly OntologyCandidateRelationship[],
): string | undefined {
  return (
    question.relationshipId ??
    relationships.find(({ id }) => question.id === `question.${id}.relationship`)?.id
  );
}

function isSameAsQuestion(question: OntologyReviewQuestion): boolean {
  return (
    question.id.includes('.same-as.') ||
    question.id.endsWith('.same-as-existing') ||
    question.id.endsWith('.alias')
  );
}

function isSelfComparison(
  question: OntologyReviewQuestion,
  candidate: OntologyCandidateProposal | undefined,
  candidatesById: ReadonlyMap<string, OntologyCandidateProposal>,
): boolean {
  if (!isSameAsQuestion(question)) return false;
  const source = normalizeTerm(question.context?.sourceTerm);
  const proposed = normalizeTerm(question.context?.proposedTerm);
  if (source && source === proposed) return true;
  if (question.relatedCandidateIds?.includes(question.candidateId ?? '')) return true;
  const candidateTarget =
    candidate?.proposedConceptId ?? candidate?.mapsToExistingConceptId;
  return (
    Boolean(candidateTarget) &&
    question.relatedCandidateIds?.some((id) => {
      const related = candidatesById.get(id);
      return (
        related?.proposedConceptId === candidateTarget ||
        related?.mapsToExistingConceptId === candidateTarget
      );
    }) === true
  );
}

function answerDecision(
  questionSetVersion: string,
  question: OntologyReviewQuestion,
  answer: OntologyReviewAnswer,
  selfComparison: boolean,
  hasValidReference: boolean,
): AnswerDecision {
  if (!hasValidReference) {
    return {
      disposition: 'invalid-question',
      reasonCode: 'unresolved-question-reference',
      usableAsOntologyEvidence: false,
      furtherExpertReviewRequired: true,
    };
  }
  if (selfComparison) {
    return {
      disposition: 'invalid-question',
      reasonCode: 'normalized-self-comparison',
      usableAsOntologyEvidence: false,
      furtherExpertReviewRequired: true,
    };
  }
  if (
    questionSetVersion === 'ontology-review-v1' &&
    question.id === KNOWN_V1_BAD_COMPARISON
  ) {
    return {
      disposition: 'reask-required',
      reasonCode: 'v1-unrelated-duplicate-comparison',
      usableAsOntologyEvidence: false,
      furtherExpertReviewRequired: true,
    };
  }
  if (
    questionSetVersion === 'ontology-review-v1' &&
    question.id.startsWith('question.candidate-relation.') &&
    question.id.endsWith('.relationship')
  ) {
    return {
      disposition: 'reask-required',
      reasonCode: 'v1-relationship-wording-tested-definition-not-validity',
      usableAsOntologyEvidence: false,
      furtherExpertReviewRequired: true,
    };
  }

  if (question.id.endsWith('.canonical-independence')) {
    if (answer === 'yes') {
      return {
        disposition: 'approve-for-canonical-review',
        reasonCode: 'canonical-independence-supported',
        usableAsOntologyEvidence: true,
        furtherExpertReviewRequired: true,
      };
    }
    if (answer === 'no') {
      return {
        disposition: 'hold-from-canonical-review',
        reasonCode: 'canonical-independence-not-supported',
        usableAsOntologyEvidence: true,
        furtherExpertReviewRequired: true,
      };
    }
    return {
      disposition: 'keep-uncertain',
      reasonCode: 'canonical-independence-uncertain',
      usableAsOntologyEvidence: false,
      furtherExpertReviewRequired: true,
    };
  }

  if (isSameAsQuestion(question)) {
    if (answer === 'yes') {
      return {
        disposition: 'merge-or-alias-review',
        reasonCode: 'same-as-supported-requires-controlled-review',
        usableAsOntologyEvidence: true,
        furtherExpertReviewRequired: true,
      };
    }
    if (answer === 'no') {
      return {
        disposition: 'keep-distinct',
        reasonCode: 'same-as-rejected',
        usableAsOntologyEvidence: true,
        furtherExpertReviewRequired: false,
      };
    }
    return {
      disposition: 'keep-uncertain',
      reasonCode: 'same-as-uncertain',
      usableAsOntologyEvidence: false,
      furtherExpertReviewRequired: true,
    };
  }

  if (question.id.endsWith('.publication-wording')) {
    if (answer === 'no') {
      return {
        disposition: 'publication-boundary-supported',
        reasonCode: 'publication-only-wording-supported',
        usableAsOntologyEvidence: true,
        furtherExpertReviewRequired: false,
      };
    }
    if (answer === 'not-sure') {
      return {
        disposition: 'keep-uncertain',
        reasonCode: 'publication-boundary-uncertain',
        usableAsOntologyEvidence: false,
        furtherExpertReviewRequired: true,
      };
    }
    return {
      disposition: 'manual-review-required',
      reasonCode: 'underlying-concept-possible-but-publication-record-not-canonical',
      usableAsOntologyEvidence: true,
      furtherExpertReviewRequired: true,
    };
  }

  if (question.id.endsWith('.relationship')) {
    if (answer === 'yes') {
      return {
        disposition: 'relationship-supported',
        reasonCode: 'relationship-validity-supported',
        usableAsOntologyEvidence: true,
        furtherExpertReviewRequired: true,
      };
    }
    if (answer === 'no') {
      return {
        disposition: 'relationship-not-supported',
        reasonCode: 'relationship-validity-not-supported',
        usableAsOntologyEvidence: true,
        furtherExpertReviewRequired: true,
      };
    }
    return {
      disposition: 'keep-uncertain',
      reasonCode: 'relationship-validity-uncertain',
      usableAsOntologyEvidence: false,
      furtherExpertReviewRequired: true,
    };
  }

  return {
    disposition: 'insufficient-evidence',
    reasonCode: 'question-type-has-no-approved-interpretation-rule',
    usableAsOntologyEvidence: false,
    furtherExpertReviewRequired: true,
  };
}

function dispositionTotals(
  items: readonly InterpretedOntologyReviewItem[],
  manualItems: readonly InterpretedOntologyManualReviewItem[],
): Record<string, number> {
  const totals = new Map<string, number>();
  for (const disposition of [
    ...items.map(({ disposition }) => disposition),
    ...manualItems.map(({ disposition }) => disposition),
  ]) {
    totals.set(disposition, (totals.get(disposition) ?? 0) + 1);
  }
  return Object.fromEntries([...totals].sort(([left], [right]) => left.localeCompare(right)));
}

export function interpretOntologyReviewResultsV1(
  input: InterpretOntologyReviewResultsInput,
): OntologyReviewInterpretationResult {
  const candidates = input.candidates ?? MUFFLE_ONTOLOGY_CANDIDATES_V1;
  const relationships =
    input.relationships ?? MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1;
  const audit =
    input.audit ??
    auditMuffleOntologyCandidatesV1({ candidates, relationships });
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const relationshipsById = new Map(
    relationships.map((relationship) => [relationship.id, relationship]),
  );
  const issues: OntologyReviewValidationIssue[] = [];
  if (!input.questionSet.version.trim()) {
    issues.push({
      severity: 'error',
      code: 'MALFORMED_QUESTION_SET_VERSION',
      message: 'Question set requires a non-empty version.',
    });
  }

  const questionGroups = new Map<string, OntologyReviewQuestion[]>();
  for (const question of input.questionSet.questions) {
    questionGroups.set(question.id, [...(questionGroups.get(question.id) ?? []), question]);
  }
  for (const [questionId, questions] of questionGroups) {
    if (!questionId.trim() || questions.length > 1) {
      issues.push({
        severity: 'error',
        code: questions.length > 1 ? 'DUPLICATE_QUESTION_ID' : 'MALFORMED_QUESTION',
        questionId,
        message:
          questions.length > 1
            ? 'Question-set question ID is duplicated.'
            : 'Question requires a non-empty ID.',
      });
    }
  }
  const questionsById = new Map(
    [...questionGroups]
      .filter(([, questions]) => questions.length === 1)
      .map(([id, questions]) => [id, questions[0]] as const),
  );

  const normalized = normalizedAnswers(
    input.answerPayload,
    input.questionSet.version,
    issues,
  );
  const answerGroups = new Map<string, NormalizedOntologyReviewAnswer[]>();
  for (const answer of normalized.answers) {
    answerGroups.set(answer.questionId, [
      ...(answerGroups.get(answer.questionId) ?? []),
      answer,
    ]);
  }
  for (const [questionId, answers] of answerGroups) {
    if (answers.length > 1) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_ANSWER_ID',
        questionId,
        message: 'More than one answer was supplied for the same question ID.',
      });
    }
  }

  const matchedAnswers = new Map<string, NormalizedOntologyReviewAnswer>();
  let unknownAnswers = 0;
  for (const [questionId, answers] of [...answerGroups].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (answers.length !== 1) continue;
    if (!questionsById.has(questionId)) {
      unknownAnswers += 1;
      issues.push({
        severity: 'error',
        code: 'UNKNOWN_QUESTION_ID',
        questionId,
        message: 'Answer references a question not present in the supplied question set.',
      });
      continue;
    }
    matchedAnswers.set(questionId, answers[0]);
  }

  const interpretedItems: InterpretedOntologyReviewItem[] = [];
  for (const question of [...questionsById.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const answer = matchedAnswers.get(question.id);
    if (!answer) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_ANSWER',
        questionId: question.id,
        message: 'Question has no usable matched answer.',
      });
      continue;
    }
    const candidate = question.candidateId
      ? candidatesById.get(question.candidateId)
      : undefined;
    const relationshipId = relationshipIdForQuestion(question, relationships);
    const hasValidReference =
      (!question.candidateId || Boolean(candidate)) &&
      (!question.id.endsWith('.relationship') ||
        Boolean(relationshipId && relationshipsById.has(relationshipId)));
    if (!hasValidReference) {
      issues.push({
        severity: 'error',
        code: 'BROKEN_QUESTION_REFERENCE',
        questionId: question.id,
        message: 'Question candidate or relationship reference does not resolve.',
      });
    }
    const decision = answerDecision(
      input.questionSet.version,
      question,
      answer.answer,
      isSelfComparison(question, candidate, candidatesById),
      hasValidReference,
    );
    interpretedItems.push({
      questionSetVersion: input.questionSet.version,
      questionId: question.id,
      candidateId: question.candidateId,
      relationshipId,
      auditIssueCodes: uniqueSorted(question.auditIssueCodes),
      currentAuditIssueCodes: currentAuditCodes(
        audit,
        question.candidateId ?? relationshipId,
      ),
      questionText: question.question,
      answer: answer.answer,
      reviewerId: answer.reviewerId,
      reviewedAt: answer.reviewedAt,
      updatedAt: answer.updatedAt,
      sourceTerm: question.context?.sourceTerm ?? candidate?.sourceTerm,
      proposedTerm: question.context?.proposedTerm ?? candidate?.label,
      proposedConceptId: candidate?.proposedConceptId,
      mapsToExistingConceptId: candidate?.mapsToExistingConceptId,
      ...decision,
    });
  }

  const manualReviewItems = [...input.questionSet.manualQuestionReview]
    .sort(
      (left, right) =>
        (left.candidateId ?? '').localeCompare(right.candidateId ?? '') ||
        (left.relationshipId ?? '').localeCompare(right.relationshipId ?? '') ||
        left.reason.localeCompare(right.reason),
    )
    .map((item): InterpretedOntologyManualReviewItem => {
      const candidate = item.candidateId
        ? candidatesById.get(item.candidateId)
        : undefined;
      const referenceId = item.candidateId ?? item.relationshipId;
      if (
        (item.candidateId && !candidate) ||
        (item.relationshipId && !relationshipsById.has(item.relationshipId))
      ) {
        issues.push({
          severity: 'error',
          code: 'BROKEN_MANUAL_REVIEW_REFERENCE',
          questionId: referenceId,
          message: 'Manual-review candidate or relationship reference does not resolve.',
        });
      }
      return {
        questionSetVersion: input.questionSet.version,
        candidateId: item.candidateId,
        relationshipId: item.relationshipId,
        auditIssueCodes: uniqueSorted(item.auditIssueCodes),
        currentAuditIssueCodes: currentAuditCodes(audit, referenceId),
        sourceTerm: candidate?.sourceTerm,
        proposedConceptId: candidate?.proposedConceptId,
        reason: item.reason,
        disposition: 'manual-review-required',
        usableAsOntologyEvidence: false,
        furtherExpertReviewRequired: true,
      };
    });

  const missingAnswers = input.questionSet.questions.filter(
    ({ id }) => !matchedAnswers.has(id),
  ).length;
  const reviewers = uniqueSorted(interpretedItems.map(({ reviewerId }) => reviewerId));
  const totals = dispositionTotals(interpretedItems, manualReviewItems);
  return {
    interpreterVersion: ONTOLOGY_REVIEW_INTERPRETER_VERSION,
    questionSetVersion: input.questionSet.version,
    sourceDescriptor: input.sourceDescriptor,
    reviewers,
    counts: {
      generatedQuestions: input.questionSet.questions.length,
      answersReceived: normalized.answersReceived,
      matchedAnswers: interpretedItems.length,
      yes: interpretedItems.filter(({ answer }) => answer === 'yes').length,
      no: interpretedItems.filter(({ answer }) => answer === 'no').length,
      notSure: interpretedItems.filter(({ answer }) => answer === 'not-sure').length,
      usableEvidence: interpretedItems.filter(
        ({ usableAsOntologyEvidence }) => usableAsOntologyEvidence,
      ).length,
      invalidQuestions: totals['invalid-question'] ?? 0,
      reaskRequired: totals['reask-required'] ?? 0,
      manualReviewRequired: totals['manual-review-required'] ?? 0,
      unknownAnswers,
      missingAnswers,
    },
    dispositionTotals: totals,
    validationIssues: sortValidationIssues(issues),
    interpretedItems,
    manualReviewItems,
  };
}

export function serializeOntologyReviewInterpretationJson(
  result: OntologyReviewInterpretationResult,
): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function formatOntologyReviewInterpretationMarkdown(
  result: OntologyReviewInterpretationResult,
): string {
  const lines = [
    '# Ontology review interpretation',
    '',
    `- Interpreter: \`${result.interpreterVersion}\``,
    `- Question set: \`${result.questionSetVersion}\``,
    `- Source: \`${result.sourceDescriptor}\``,
    `- Reviewers: ${result.reviewers.join(', ') || 'none'}`,
    '',
    '## Counts',
    '',
    `- Answers received / matched: ${result.counts.answersReceived} / ${result.counts.matchedAnswers}`,
    `- Yes / no / not sure: ${result.counts.yes} / ${result.counts.no} / ${result.counts.notSure}`,
    `- Usable evidence: ${result.counts.usableEvidence}`,
    `- Invalid questions: ${result.counts.invalidQuestions}`,
    `- Re-ask required: ${result.counts.reaskRequired}`,
    `- Manual review required: ${result.counts.manualReviewRequired}`,
    `- Unknown / missing answers: ${result.counts.unknownAnswers} / ${result.counts.missingAnswers}`,
    '',
    '## Dispositions',
    '',
    ...Object.entries(result.dispositionTotals).map(
      ([disposition, count]) => `- ${disposition}: ${count}`,
    ),
  ];

  const excluded = result.interpretedItems.filter(
    ({ disposition }) =>
      disposition === 'invalid-question' || disposition === 'reask-required',
  );
  if (excluded.length > 0) {
    lines.push(
      '',
      '## Excluded from ontology evidence',
      '',
      ...excluded.map(
        ({ questionId, disposition, answer }) =>
          `- \`${questionId}\`: ${disposition} (original answer: ${answer})`,
      ),
    );
  }
  if (result.manualReviewItems.length > 0) {
    lines.push(
      '',
      '## Manual review queue',
      '',
      ...result.manualReviewItems.map(
        ({ candidateId, relationshipId, reason }) =>
          `- \`${candidateId ?? relationshipId ?? 'unresolved-reference'}\`: ${reason}`,
      ),
    );
  }
  if (result.validationIssues.length > 0) {
    lines.push(
      '',
      '## Validation issues',
      '',
      ...result.validationIssues.map(
        ({ severity, code, questionId, message }) =>
          `- ${severity.toUpperCase()} \`${code}\`${questionId ? ` (\`${questionId}\`)` : ''}: ${message}`,
      ),
    );
  }
  lines.push(
    '',
    '> This artifact is deterministic review evidence. It does not modify or approve the canonical ontology.',
    '',
  );
  return lines.join('\n');
}
