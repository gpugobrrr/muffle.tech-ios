import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeMuffleOntologyV1 } from '@/domain/ontology/muffle-ontology.v1';
import {
  generateOntologyReviewQuestionsV1,
  ONTOLOGY_REVIEW_ANSWER_OPTIONS,
  ONTOLOGY_REVIEW_QUESTION_SET_VERSION,
} from '@/domain/ontology/review/generate-ontology-review-questions.v1';
import {
  MUFFLE_ONTOLOGY_CANDIDATES_V1,
  MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1,
} from '@/domain/ontology/review/muffle-ontology-candidates.v1';

test('review-question generation is deterministic, valid, and does not mutate sources', () => {
  const ontologyBefore = serializeMuffleOntologyV1();
  const candidatesBefore = structuredClone(MUFFLE_ONTOLOGY_CANDIDATES_V1);
  const first = generateOntologyReviewQuestionsV1();
  const second = generateOntologyReviewQuestionsV1();

  assert.deepEqual(first, second);
  assert.equal(first.version, ONTOLOGY_REVIEW_QUESTION_SET_VERSION);
  assert.equal(new Set(first.questions.map(({ id }) => id)).size, first.questions.length);
  assert.equal(first.questions.length > 0, true);

  for (const question of first.questions) {
    assert.equal(question.question.trim().length > 0, true);
    assert.equal(question.answerType, 'yes-no-not-sure');
    if (question.candidateId) {
      assert.equal(
        MUFFLE_ONTOLOGY_CANDIDATES_V1.some(({ id }) => id === question.candidateId),
        true,
      );
    } else {
      assert.equal(
        MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1.some(({ id }) =>
          question.id.startsWith(`question.${id}.`),
        ),
        true,
      );
    }
    assert.equal(
      question.auditIssueCodes?.every((code) => typeof code === 'string') ?? true,
      true,
    );
  }

  assert.deepEqual(ONTOLOGY_REVIEW_ANSWER_OPTIONS, ['yes', 'no', 'not-sure']);
  assert.equal(serializeMuffleOntologyV1(), ontologyBefore);
  assert.deepEqual(MUFFLE_ONTOLOGY_CANDIDATES_V1, candidatesBefore);
});

test('manual review queue retains questions that cannot be phrased responsibly', () => {
  const generated = generateOntologyReviewQuestionsV1();
  assert.equal(
    generated.manualQuestionReview.every(({ reason, candidateId, relationshipId }) =>
      Boolean(reason.trim()) &&
      (MUFFLE_ONTOLOGY_CANDIDATES_V1.some(({ id }) => id === candidateId) ||
        MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1.some(({ id }) => id === relationshipId)),
    ),
    true,
  );
});
