import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type {
  OntologyReviewQuestion,
  OntologyReviewQuestionSet,
} from '@/domain/ontology/review/generate-ontology-review-questions.v1';
import {
  formatOntologyReviewInterpretationMarkdown,
  interpretOntologyReviewResultsV1,
  serializeOntologyReviewInterpretationJson,
  type OntologyReviewQuestionSetEvidence,
} from '@/domain/ontology/review/interpret-ontology-review-results.v1';

function question(
  id: string,
  candidateId: string | undefined,
  sourceTerm: string,
  proposedTerm?: string,
): OntologyReviewQuestion {
  return {
    id,
    candidateId,
    auditIssueCodes: ['EXPERT_REVIEW_REQUIRED'],
    question: `Review ${sourceTerm}`,
    context: { sourceTerm, proposedTerm },
    answerType: 'yes-no-not-sure',
  };
}

function questionSet(
  questions: readonly OntologyReviewQuestion[],
): OntologyReviewQuestionSetEvidence {
  return {
    version: 'ontology-review-v1',
    questions,
    manualQuestionReview: [],
  };
}

function answer(
  questionId: string,
  value: 'yes' | 'no' | 'not-sure',
): Record<string, string> {
  return {
    reviewer_id: 'reviewer-test',
    question_set_version: 'ontology-review-v1',
    question_id: questionId,
    answer: value,
    reviewed_at: '2026-08-09T17:00:00.000Z',
  };
}

function interpret(
  questions: readonly OntologyReviewQuestion[],
  answerPayload: unknown,
) {
  return interpretOntologyReviewResultsV1({
    questionSet: questionSet(questions),
    answerPayload,
    sourceDescriptor: 'fixture.json',
  });
}

test('answers match by question ID rather than array position', () => {
  const canonical = question(
    'question.candidate.cause.canonical-independence',
    'candidate.cause',
    'Cause',
  );
  const sameAs = question(
    'question.candidate.alias.main-walls.alias',
    'candidate.alias.main-walls',
    'Main Walls',
    'External wall',
  );
  const result = interpret(
    [canonical, sameAs],
    [answer(sameAs.id, 'no'), answer(canonical.id, 'yes')],
  );

  assert.deepEqual(
    result.interpretedItems.map(({ questionId, answer, disposition }) => ({
      questionId,
      answer,
      disposition,
    })),
    [
      {
        questionId: sameAs.id,
        answer: 'no',
        disposition: 'keep-distinct',
      },
      {
        questionId: canonical.id,
        answer: 'yes',
        disposition: 'approve-for-canonical-review',
      },
    ],
  );
});

test('duplicate, unknown, missing, and invalid answers are reported deterministically', () => {
  const known = question(
    'question.candidate.cause.canonical-independence',
    'candidate.cause',
    'Cause',
  );
  const invalid = {
    ...answer(known.id, 'yes'),
    question_id: 'question.invalid-value',
    answer: 'maybe',
  };
  const payload = [
    answer(known.id, 'yes'),
    answer('question.unknown', 'no'),
    answer(known.id, 'no'),
    invalid,
  ];
  const first = interpret([known], payload);
  const second = interpret([known], [...payload].reverse());

  assert.deepEqual(
    first.validationIssues.map(({ code, questionId }) => ({ code, questionId })),
    second.validationIssues.map(({ code, questionId }) => ({ code, questionId })),
  );
  assert.equal(
    serializeOntologyReviewInterpretationJson(first),
    serializeOntologyReviewInterpretationJson(second),
  );
  assert.deepEqual(
    first.validationIssues.map(({ code }) => code),
    [
      'DUPLICATE_ANSWER_ID',
      'INVALID_ANSWER_VALUE',
      'MISSING_ANSWER',
      'UNKNOWN_QUESTION_ID',
    ],
  );
  assert.equal(first.counts.unknownAnswers, 1);
  assert.equal(first.counts.missingAnswers, 1);
  assert.equal(first.counts.matchedAnswers, 0);
});

test('missing reviewer, version mismatch, and malformed records are rejected', () => {
  const known = question(
    'question.candidate.cause.canonical-independence',
    'candidate.cause',
    'Cause',
  );
  const result = interpret([known], [
    null,
    { question_id: known.id, question_set_version: 'ontology-review-v1', answer: 'yes' },
    {
      reviewer_id: 'reviewer-test',
      question_set_version: 'ontology-review-v2',
      question_id: known.id,
      answer: 'yes',
    },
  ]);
  assert.deepEqual(
    result.validationIssues.map(({ code }) => code),
    [
      'MALFORMED_ANSWER_RECORD',
      'MISSING_ANSWER',
      'MISSING_REVIEWER_ID',
      'QUESTION_SET_VERSION_MISMATCH',
    ],
  );
});

test('v1 self-comparisons and the known unrelated comparison are unusable', () => {
  const self = question(
    'question.candidate.building_element.external_drainage.same-as.candidate.building_element.external_drainage',
    'candidate.building_element.external_drainage',
    'External drainage',
    'External drainage',
  );
  const unrelated = question(
    'question.candidate.building_element.internal_wall.same-as.candidate.building_element.internal_door',
    'candidate.building_element.internal_wall',
    'Internal wall',
    'Internal door',
  );
  const result = interpret(
    [self, unrelated],
    [answer(unrelated.id, 'yes'), answer(self.id, 'yes')],
  );
  const byId = new Map(result.interpretedItems.map((item) => [item.questionId, item]));

  assert.equal(byId.get(self.id)?.disposition, 'invalid-question');
  assert.equal(byId.get(self.id)?.usableAsOntologyEvidence, false);
  assert.equal(byId.get(unrelated.id)?.disposition, 'reask-required');
  assert.equal(byId.get(unrelated.id)?.usableAsOntologyEvidence, false);
});

test('all v1 relationship answers require re-asking regardless of answer value', () => {
  const relationshipIds = [
    'question.candidate-relation.cause-explains-defect.relationship',
    'question.candidate-relation.defect-supported-by-observation.relationship',
    'question.candidate-relation.evidence-supports-observation.relationship',
  ];
  const questions = relationshipIds.map((id) =>
    question(id, undefined, 'Relationship subject', 'Relationship object'),
  );
  const result = interpret(questions, [
    answer(relationshipIds[0], 'yes'),
    answer(relationshipIds[1], 'no'),
    answer(relationshipIds[2], 'not-sure'),
  ]);
  assert.deepEqual(
    result.interpretedItems.map(
      ({ disposition, usableAsOntologyEvidence }) => ({
        disposition,
        usableAsOntologyEvidence,
      }),
    ),
    [
      { disposition: 'reask-required', usableAsOntologyEvidence: false },
      { disposition: 'reask-required', usableAsOntologyEvidence: false },
      { disposition: 'reask-required', usableAsOntologyEvidence: false },
    ],
  );
});

test('valid question categories produce conservative evidence dispositions', () => {
  const canonicalYes = question(
    'question.candidate.cause.canonical-independence',
    'candidate.cause',
    'Cause',
  );
  const canonicalUnsure = question(
    'question.candidate.risk.canonical-independence',
    'candidate.risk',
    'Risk',
  );
  const sameNo = question(
    'question.candidate.alias.main-walls.alias',
    'candidate.alias.main-walls',
    'Main Walls',
    'External wall',
  );
  const sameYes = question(
    'question.candidate.building_element.drainage.same-as.candidate.building_element.external_drainage',
    'candidate.building_element.drainage',
    'Drainage',
    'External drainage',
  );
  const publicationNo = question(
    'question.candidate.publication.rics-d4-main-walls.publication-wording',
    'candidate.publication.rics-d4-main-walls',
    'D4 Main Walls',
  );
  const result = interpret(
    [canonicalYes, canonicalUnsure, sameNo, sameYes, publicationNo],
    [
      answer(publicationNo.id, 'no'),
      answer(sameYes.id, 'yes'),
      answer(sameNo.id, 'no'),
      answer(canonicalUnsure.id, 'not-sure'),
      answer(canonicalYes.id, 'yes'),
    ],
  );
  const dispositions = Object.fromEntries(
    result.interpretedItems.map(({ questionId, disposition }) => [
      questionId,
      disposition,
    ]),
  );
  assert.equal(dispositions[canonicalYes.id], 'approve-for-canonical-review');
  assert.equal(dispositions[canonicalUnsure.id], 'keep-uncertain');
  assert.equal(dispositions[sameNo.id], 'keep-distinct');
  assert.equal(dispositions[sameYes.id], 'merge-or-alias-review');
  assert.equal(
    dispositions[publicationNo.id],
    'publication-boundary-supported',
  );
});

test('frozen v1 history remains 55 generated questions plus six manual items', () => {
  const frozen = JSON.parse(
    readFileSync(
      'apps/ontology-review/data/ontology-review-v1.json',
      'utf8',
    ),
  ) as OntologyReviewQuestionSet;
  assert.equal(frozen.version, 'ontology-review-v1');
  assert.equal(frozen.questions.length, 55);
  assert.equal(frozen.manualQuestionReview.length, 6);
  assert.equal(
    frozen.questions.some(
      ({ id }) =>
        id ===
        'question.candidate.building_element.internal_wall.same-as.candidate.building_element.internal_door',
    ),
    true,
  );

  const payload = [...frozen.questions]
    .reverse()
    .map(({ id }) => answer(id, 'not-sure'));
  const first = interpretOntologyReviewResultsV1({
    questionSet: frozen,
    answerPayload: payload,
    sourceDescriptor: 'frozen-fixture.json',
  });
  const second = interpretOntologyReviewResultsV1({
    questionSet: frozen,
    answerPayload: [...payload].reverse(),
    sourceDescriptor: 'frozen-fixture.json',
  });
  assert.equal(first.manualReviewItems.length, 6);
  assert.equal(
    first.manualReviewItems.every(
      ({ disposition, usableAsOntologyEvidence }) =>
        disposition === 'manual-review-required' && !usableAsOntologyEvidence,
    ),
    true,
  );
  assert.equal(
    serializeOntologyReviewInterpretationJson(first),
    serializeOntologyReviewInterpretationJson(second),
  );
  assert.equal(
    formatOntologyReviewInterpretationMarkdown(first),
    formatOntologyReviewInterpretationMarkdown(second),
  );
});
