import { NextResponse } from 'next/server';

import { getReviewAnswerStore } from '../../../lib/answer-store';
import { currentReviewerId } from '../../../lib/auth';
import { isReviewAnswer, isValidQuestionId } from '../../../lib/review';

async function reviewerOrUnauthorized() {
  const reviewerId = await currentReviewerId();
  return reviewerId;
}

export async function GET() {
  const reviewerId = await reviewerOrUnauthorized();
  if (!reviewerId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  return NextResponse.json({ answers: await getReviewAnswerStore().getAnswers(reviewerId) });
}

export async function PUT(request: Request) {
  const reviewerId = await reviewerOrUnauthorized();
  if (!reviewerId) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const body = await request.json().catch(() => undefined);
  if (!isValidQuestionId(body?.questionId) || !isReviewAnswer(body?.answer)) {
    return NextResponse.json({ error: 'Invalid review answer.' }, { status: 400 });
  }

  const answer = await getReviewAnswerStore().saveAnswer(reviewerId, {
    questionId: body.questionId,
    answer: body.answer,
  });
  return NextResponse.json({ answer });
}
