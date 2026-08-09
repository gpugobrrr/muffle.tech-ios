import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'ontology_review_session';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured.`);
  return value;
}

function sign(value: string): string {
  return createHmac('sha256', requiredEnvironment('REVIEW_SESSION_SECRET'))
    .update(value)
    .digest('base64url');
}

export function configuredReviewerId(): string {
  return process.env.REVIEWER_ID?.trim() || 'expert-reviewer';
}

export function createSessionValue(reviewerId = configuredReviewerId()): string {
  const payload = Buffer.from(JSON.stringify({ reviewerId })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSession(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return undefined;
  const expected = sign(payload);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return undefined;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof decoded.reviewerId === 'string' ? decoded.reviewerId : undefined;
  } catch {
    return undefined;
  }
}

export async function currentReviewerId(): Promise<string | undefined> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export function verifyAccessSecret(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const expected = requiredEnvironment('REVIEW_ACCESS_SECRET');
  return (
    value.length === expected.length &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  );
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  options: {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  },
};
