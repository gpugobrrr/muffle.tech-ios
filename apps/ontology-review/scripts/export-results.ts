import { neon } from '@neondatabase/serverless';

import { QUESTION_SET_VERSION } from '../lib/review';

const reviewerId = process.argv[2] ?? process.env.REVIEWER_ID ?? 'expert-reviewer';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be configured to export persisted review answers.');
}

const sql = neon(databaseUrl);
const rows = await sql`
  SELECT question_id, answer, reviewed_at
  FROM ontology_review_answers
  WHERE reviewer_id = ${reviewerId} AND question_set_version = ${QUESTION_SET_VERSION}
  ORDER BY question_id
`;

console.log(
  JSON.stringify(
    {
      questionSetVersion: QUESTION_SET_VERSION,
      reviewerId,
      answers: rows.map((row) => ({
        questionId: String(row.question_id),
        answer: String(row.answer),
        reviewedAt: new Date(String(row.reviewed_at)).toISOString(),
      })),
    },
    null,
    2,
  ),
);
