import questionSet from '../data/ontology-review-v1.json';

export const QUESTION_SET_VERSION = questionSet.version;
export const ANSWERS = ['yes', 'no', 'not-sure'] as const;
export type ReviewAnswerValue = (typeof ANSWERS)[number];

export type ReviewQuestion = {
  id: string;
  question: string;
  answerType: 'yes-no-not-sure';
};

export type ReviewAnswer = {
  questionId: string;
  answer: ReviewAnswerValue;
  reviewedAt: string;
};

export const questions = questionSet.questions as readonly ReviewQuestion[];
export const questionIds = new Set(questions.map(({ id }) => id));

export function isReviewAnswer(value: unknown): value is ReviewAnswerValue {
  return typeof value === 'string' && (ANSWERS as readonly string[]).includes(value);
}

export function isValidQuestionId(value: unknown): value is string {
  return typeof value === 'string' && questionIds.has(value);
}

export function nextUnansweredQuestion(
  savedAnswers: readonly ReviewAnswer[],
  afterQuestionId?: string,
): ReviewQuestion | undefined {
  const answered = new Set(savedAnswers.map(({ questionId }) => questionId));
  const unanswered = questions.filter(({ id }) => !answered.has(id));
  if (!afterQuestionId) return unanswered[0];
  const start = questions.findIndex(({ id }) => id === afterQuestionId);
  return (
    questions.slice(start + 1).find(({ id }) => !answered.has(id)) ??
    questions.slice(0, Math.max(start, 0)).find(({ id }) => !answered.has(id))
  );
}

export function nextReviewQuestion(questionId: string): ReviewQuestion | undefined {
  const index = questions.findIndex(({ id }) => id === questionId);
  return index >= 0 ? questions[index + 1] : undefined;
}

export function reviewSummary(savedAnswers: readonly ReviewAnswer[]) {
  const values = new Map(savedAnswers.map((answer) => [answer.questionId, answer.answer]));
  return {
    total: questions.length,
    completed: values.size,
    unanswered: questions.length - values.size,
    yes: [...values.values()].filter((answer) => answer === 'yes').length,
    no: [...values.values()].filter((answer) => answer === 'no').length,
    notSure: [...values.values()].filter((answer) => answer === 'not-sure').length,
  };
}
