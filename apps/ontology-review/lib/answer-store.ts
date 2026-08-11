import { neon } from '@neondatabase/serverless';

import {
  QUESTION_SET_VERSION,
  type ReviewAnswer,
  type ReviewAnswerValue,
} from './review';

export interface ReviewAnswerStore {
  getAnswers(reviewerId: string): Promise<ReviewAnswer[]>;
  saveAnswer(
    reviewerId: string,
    answer: { questionId: string; answer: ReviewAnswerValue },
  ): Promise<ReviewAnswer>;
}

function key(reviewerId: string, questionId: string): string {
  return `${reviewerId}\u0000${QUESTION_SET_VERSION}\u0000${questionId}`;
}

export function createMemoryReviewAnswerStore(): ReviewAnswerStore {
  const globalMemory = globalThis as typeof globalThis & {
    __muffleOntologyReviewAnswers?: Map<string, ReviewAnswer>;
  };
  const answers =
    globalMemory.__muffleOntologyReviewAnswers ??
    (globalMemory.__muffleOntologyReviewAnswers = new Map<string, ReviewAnswer>());
  return {
    async getAnswers(reviewerId) {
      return [...answers.entries()]
        .filter(([entryKey]) => entryKey.startsWith(`${reviewerId}\u0000${QUESTION_SET_VERSION}\u0000`))
        .map(([, answer]) => answer)
        .sort((left, right) => left.questionId.localeCompare(right.questionId));
    },
    async saveAnswer(reviewerId, answer) {
      const saved = { ...answer, reviewedAt: new Date().toISOString() };
      answers.set(key(reviewerId, answer.questionId), saved);
      return saved;
    },
  };
}

const memoryStore = createMemoryReviewAnswerStore();

function postgresStore(databaseUrl: string): ReviewAnswerStore {
  const sql = neon(databaseUrl);
  return {
    async getAnswers(reviewerId) {
      const rows = await sql`
        SELECT question_id, answer, reviewed_at
        FROM ontology_review_answers
        WHERE reviewer_id = ${reviewerId} AND question_set_version = ${QUESTION_SET_VERSION}
        ORDER BY question_id
      `;
      return rows.map((row) => ({
        questionId: String(row.question_id),
        answer: row.answer as ReviewAnswerValue,
        reviewedAt: new Date(String(row.reviewed_at)).toISOString(),
      }));
    },
    async saveAnswer(reviewerId, answer) {
      const rows = await sql`
        INSERT INTO ontology_review_answers
          (reviewer_id, question_set_version, question_id, answer, reviewed_at, updated_at)
        VALUES (${reviewerId}, ${QUESTION_SET_VERSION}, ${answer.questionId}, ${answer.answer}, NOW(), NOW())
        ON CONFLICT (reviewer_id, question_set_version, question_id)
        DO UPDATE SET answer = EXCLUDED.answer, reviewed_at = NOW(), updated_at = NOW()
        RETURNING question_id, answer, reviewed_at
      `;
      const row = rows[0];
      return {
        questionId: String(row.question_id),
        answer: row.answer as ReviewAnswerValue,
        reviewedAt: new Date(String(row.reviewed_at)).toISOString(),
      };
    },
  };
}

export function getReviewAnswerStore(): ReviewAnswerStore {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) return postgresStore(databaseUrl);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL must be configured in production.');
  }
  return memoryStore;
}
