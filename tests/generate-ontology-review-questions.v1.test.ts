import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeMuffleOntologyV1 } from '@/domain/ontology/muffle-ontology.v1';
import {
  generateOntologyReviewQuestionsV1,
  ONTOLOGY_REVIEW_ANSWER_OPTIONS,
  ONTOLOGY_REVIEW_QUESTION_SET_VERSION,
} from '@/domain/ontology/review/generate-ontology-review-questions.v1';
import {
  generateOntologyReviewQuestionsV2,
  normalizeOntologyReviewComparisonTerm,
  ONTOLOGY_REVIEW_QUESTION_SET_V2_VERSION,
} from '@/domain/ontology/review/generate-ontology-review-questions.v2';
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

test('v2 generation rejects normalized self-comparisons and weak modifier-only pairs', () => {
  const generated = generateOntologyReviewQuestionsV2();
  assert.equal(generated.version, ONTOLOGY_REVIEW_QUESTION_SET_V2_VERSION);
  assert.equal(
    generated.questions.some(
      ({ id }) =>
        id ===
        'question.candidate.building_element.internal_wall.same-as.candidate.building_element.internal_door',
    ),
    false,
  );
  assert.equal(
    generated.questions.some(
      ({ id }) =>
        id ===
        'question.candidate.building_element.electrical_installation.same-as.candidate.building_element.gas_installation',
    ),
    false,
  );

  for (const question of generated.questions.filter(({ id }) =>
    id.includes('.same-as.'),
  )) {
    assert.notEqual(
      normalizeOntologyReviewComparisonTerm(question.context?.sourceTerm ?? ''),
      normalizeOntologyReviewComparisonTerm(question.context?.proposedTerm ?? ''),
    );
    assert.equal(
      question.relatedCandidateIds?.includes(question.candidateId ?? '') ?? false,
      false,
    );
  }
});

test('v2 comparison selection retains meaningful lexical comparisons deterministically', () => {
  const first = generateOntologyReviewQuestionsV2();
  const second = generateOntologyReviewQuestionsV2();
  assert.deepEqual(first, second);
  assert.equal(
    first.questions.some(
      ({ id }) =>
        id ===
        'question.candidate.building_element.drainage.same-as.candidate.building_element.external_drainage',
    ),
    true,
  );
  assert.equal(
    first.questions.some(
      ({ id }) =>
        id ===
        'question.candidate.building_element.roof_covering.same-as.candidate.building_element.roof_structure',
    ),
    true,
  );
});

test('v2 relationship questions test whether the relationship can exist', () => {
  const questions = new Map(
    generateOntologyReviewQuestionsV2().questions.map((question) => [
      question.relationshipId,
      question.question,
    ]),
  );
  assert.equal(
    questions.get('candidate-relation.cause-explains-defect'),
    'Can a recorded defect have a likely cause?',
  );
  assert.equal(
    questions.get('candidate-relation.defect-supported-by-observation'),
    'Can an observation provide support for identifying a defect?',
  );
  assert.equal(
    questions.get('candidate-relation.evidence-supports-observation'),
    'Can evidence support an observation?',
  );
  assert.equal(
    questions.get('candidate-relation.implication-results-from-defect'),
    'Can a defect have an implication?',
  );
  assert.equal(
    questions.get('candidate-relation.investigation-investigates-limitation'),
    'Can further investigation be recommended because inspection was limited?',
  );
  assert.equal(
    questions.get('candidate-relation.recommendation-addresses-defect'),
    'Can a recommendation be made in response to a defect?',
  );
  assert.equal(
    questions.get('candidate-relation.risk-arises-from-implication'),
    'Can an identified implication give rise to a risk?',
  );
});
