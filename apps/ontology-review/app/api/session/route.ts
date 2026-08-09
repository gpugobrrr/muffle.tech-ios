import { NextResponse } from 'next/server';

import {
  createSessionValue,
  sessionCookie,
  verifyAccessSecret,
} from '../../../lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  if (!verifyAccessSecret(body?.accessSecret)) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, createSessionValue(), sessionCookie.options);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, '', { ...sessionCookie.options, maxAge: 0 });
  return response;
}
