import { currentReviewerId } from '../lib/auth';
import { getReviewAnswerStore } from '../lib/answer-store';
import { questions } from '../lib/review';
import { ReviewClient } from './review-client';

export default async function Home() {
  const reviewerId = await currentReviewerId();
  const answers = reviewerId
    ? await getReviewAnswerStore().getAnswers(reviewerId)
    : [];

  return <ReviewClient authenticated={Boolean(reviewerId)} initialAnswers={answers} total={questions.length} />;
}
