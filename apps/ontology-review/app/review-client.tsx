'use client';

import { FormEvent, useMemo, useState } from 'react';

import {
  nextUnansweredQuestion,
  nextReviewQuestion,
  questions,
  reviewSummary,
  type ReviewAnswer,
  type ReviewAnswerValue,
} from '../lib/review';

type Props = {
  authenticated: boolean;
  initialAnswers: ReviewAnswer[];
  total: number;
};

type Screen = 'home' | 'review' | 'complete';

export function ReviewClient({ authenticated, initialAnswers, total }: Props) {
  const [isAuthenticated, setIsAuthenticated] = useState(authenticated);
  const [answers, setAnswers] = useState(initialAnswers);
  const [screen, setScreen] = useState<Screen>(
    authenticated && initialAnswers.length === total ? 'complete' : 'home',
  );
  const [questionId, setQuestionId] = useState<string | undefined>();
  const [reviewingAnswers, setReviewingAnswers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  const summary = useMemo(() => reviewSummary(answers), [answers]);
  const question =
    questions.find(({ id }) => id === questionId) ??
    nextUnansweredQuestion(answers);
  const questionIndex = question ? questions.findIndex(({ id }) => id === question.id) : -1;

  function begin(reviewAnswers = false) {
    const next = reviewAnswers ? questions[0] : nextUnansweredQuestion(answers);
    if (!next) {
      setScreen('complete');
      return;
    }
    setReviewingAnswers(reviewAnswers);
    setQuestionId(next.id);
    setMessage(undefined);
    setScreen('review');
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const accessSecret = form.get('accessSecret');
    setSaving(true);
    setMessage(undefined);
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessSecret }),
    });
    setSaving(false);
    if (!response.ok) {
      setMessage('Access could not be verified. Please try again.');
      return;
    }
    setIsAuthenticated(true);
  }

  async function answer(value: ReviewAnswerValue) {
    if (!question || saving) return;
    setSaving(true);
    setMessage('Saving…');
    const response = await fetch('/api/answers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: question.id, answer: value }),
    });
    const payload = await response.json().catch(() => undefined);
    setSaving(false);
    if (!response.ok || !payload?.answer) {
      setMessage('Could not save. Please try again.');
      return;
    }
    const saved = payload.answer as ReviewAnswer;
    const updated = [...answers.filter(({ questionId: id }) => id !== saved.questionId), saved];
    setAnswers(updated);
    const next = reviewingAnswers
      ? nextReviewQuestion(question.id)
      : nextUnansweredQuestion(updated, question.id);
    if (next) {
      setQuestionId(next.id);
      setMessage(undefined);
    } else {
      setScreen('complete');
      setMessage(undefined);
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="shell login">
        <p className="brand">Muffle</p>
        <h1>Ontology Review</h1>
        <form onSubmit={signIn}>
          <label htmlFor="access-secret">Access code</label>
          <input id="access-secret" name="accessSecret" type="password" autoComplete="current-password" required />
          <button className="primary" disabled={saving}>{saving ? 'CHECKING…' : 'CONTINUE'}</button>
          {message && <p className="status" role="alert">{message}</p>}
        </form>
      </main>
    );
  }

  if (screen === 'complete') {
    return (
      <main className="shell home">
        <p className="brand">Muffle</p>
        <h1>Review complete</h1>
        <p className="count">{summary.completed} of {summary.total} completed</p>
        <dl className="totals">
          <div><dt>Yes</dt><dd>{summary.yes}</dd></div>
          <div><dt>No</dt><dd>{summary.no}</dd></div>
          <div><dt>Not sure</dt><dd>{summary.notSure}</dd></div>
        </dl>
        <p className="thanks">Thank you.</p>
        <button className="primary" onClick={() => begin(true)}>REVIEW ANSWERS</button>
      </main>
    );
  }

  if (screen === 'home') {
    return (
      <main className="shell home">
        <p className="brand">Muffle</p>
        <h1>Ontology Review</h1>
        <p className="count">{summary.total} questions<br />{summary.completed} completed</p>
        <button className="primary" onClick={() => begin()}>
          {summary.completed > 0 ? 'CONTINUE' : 'START'}
        </button>
      </main>
    );
  }

  if (!question) return null;
  return (
    <main className="shell review">
      <div className="progress" aria-live="polite">{questionIndex + 1} of {total}</div>
      <h1 className="question">{question.question}</h1>
      <div className="answer-actions" aria-label="Answer options">
        <button className="answer" disabled={saving} onClick={() => answer('yes')}>YES</button>
        <button className="answer" disabled={saving} onClick={() => answer('no')}>NO</button>
        <button className="answer" disabled={saving} onClick={() => answer('not-sure')}>NOT SURE</button>
      </div>
      <div className="review-footer">
        <button
          className="back"
          disabled={saving || questionIndex === 0}
          onClick={() => setQuestionId(questions[questionIndex - 1]?.id)}
        >
          Back
        </button>
        <p className="status" aria-live="polite">{message}</p>
      </div>
    </main>
  );
}
