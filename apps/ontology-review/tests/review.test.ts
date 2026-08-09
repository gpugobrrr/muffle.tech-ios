import assert from 'node:assert/strict';
import test from 'node:test';

import { createMemoryReviewAnswerStore } from '../lib/answer-store';
import {
  ANSWERS,
  QUESTION_SET_VERSION,
  isReviewAnswer,
  isValidQuestionId,
  nextReviewQuestion,
  nextUnansweredQuestion,
  questions,
  reviewSummary,
} from '../lib/review';

test('question dataset has unique non-empty valid questions', () => {
  assert.equal(QUESTION_SET_VERSION, 'ontology-review-v1');
  assert.equal(new Set(questions.map(({ id }) => id)).size, questions.length);
  for (const question of questions) {
    assert.equal(question.question.trim().length > 0, true);
    assert.equal(question.answerType, 'yes-no-not-sure');
    assert.equal(isValidQuestionId(question.id), true);
  }
});

test('answer validation only accepts the three supported answers', () => {
  assert.deepEqual(ANSWERS, ['yes', 'no', 'not-sure']);
  assert.equal(isReviewAnswer('yes'), true);
  assert.equal(isReviewAnswer('no'), true);
  assert.equal(isReviewAnswer('not-sure'), true);
  assert.equal(isReviewAnswer('maybe'), false);
  assert.equal(isReviewAnswer(undefined), false);
});

test('progress and resume select the next unanswered question', () => {
  const [first, second] = questions;
  assert.ok(first);
  assert.ok(second);
  const answers = [{ questionId: first.id, answer: 'yes' as const, reviewedAt: '2026-01-01T00:00:00.000Z' }];
  assert.equal(nextUnansweredQuestion(answers)?.id, second.id);
  assert.equal(nextUnansweredQuestion(answers, first.id)?.id, second.id);
  assert.deepEqual(reviewSummary(answers), {
    total: questions.length,
    completed: 1,
    unanswered: questions.length - 1,
    yes: 1,
    no: 0,
    notSure: 0,
  });
});

test('all complete has no next unanswered question', () => {
  const answers = questions.map((question) => ({
    questionId: question.id,
    answer: 'not-sure' as const,
    reviewedAt: '2026-01-01T00:00:00.000Z',
  }));
  assert.equal(nextUnansweredQuestion(answers), undefined);
  assert.equal(reviewSummary(answers).completed, questions.length);
});

test('reviewing saved answers moves through each question in order', () => {
  assert.equal(nextReviewQuestion(questions[0]?.id ?? '')?.id, questions[1]?.id);
  assert.equal(nextReviewQuestion(questions.at(-1)?.id ?? ''), undefined);
});

test('answer store keeps one current answer per reviewer and question', async () => {
  const store = createMemoryReviewAnswerStore();
  const question = questions[0];
  assert.ok(question);
  await store.saveAnswer('reviewer-a', { questionId: question.id, answer: 'yes' });
  await store.saveAnswer('reviewer-a', { questionId: question.id, answer: 'no' });
  await store.saveAnswer('reviewer-b', { questionId: question.id, answer: 'not-sure' });

  assert.deepEqual(await store.getAnswers('reviewer-a'), [
    {
      questionId: question.id,
      answer: 'no',
      reviewedAt: (await store.getAnswers('reviewer-a'))[0]?.reviewedAt,
    },
  ]);
  assert.equal((await store.getAnswers('reviewer-b'))[0]?.answer, 'not-sure');
});
