# Muffle Ontology Review

Private, portrait-first mobile web app for an invited expert surveyor to answer
one ontology question at a time. It is a standalone Next.js project and is not
part of the Expo runtime.

## Data boundary

`npm run ontology:review:generate` at the repository root deterministically
combines the candidate register, its audit, and canonical labels into
`data/ontology-review-v1.json`. The app reads that fixed artifact only; it does
not parse the TypeScript ontology at runtime.

Answers are stored independently with a question-set version. A YES, NO, or NOT
SURE answer never updates `MUFFLE_ONTOLOGY_V1`, a candidate proposal, a
candidate review status, or audit output. A later controlled ontology-promotion
task must interpret the exported human results.

## Local development

1. Generate questions from the repository root:

   ```sh
   npm run ontology:review:generate
   ```

2. Copy `.env.example` to `.env.local` and set `REVIEW_ACCESS_SECRET` and
   `REVIEW_SESSION_SECRET`. Without `DATABASE_URL`, development uses a
   process-local memory store only. It is never used in production.
3. Install and run from this directory:

   ```sh
   npm install
   npm run dev
   ```

## Production persistence

Create a Neon Postgres database through the Vercel Marketplace (or use an
equivalent Postgres provider), run [`db/schema.sql`](db/schema.sql), and set
`DATABASE_URL` in Vercel. The primary key makes each save an upsert for one
reviewer/question-set/question, so changing an answer replaces current state
while preserving the latest `reviewed_at` timestamp.

Set `REVIEW_ACCESS_SECRET` and `REVIEW_SESSION_SECRET` to different high-entropy
values in Vercel. The access code is verified on the server and a signed,
HTTP-only, Secure (in production), SameSite=Strict cookie identifies the
reviewer. No secret is exposed in browser JavaScript. `REVIEWER_ID` is optional
and should be a minimal non-personal identifier.

## Vercel

Create a separate Vercel project and configure its **Root Directory** as
`apps/ontology-review`. Vercel detects Next.js and uses `npm run build`. Ensure
the generated `data/ontology-review-v1.json` is committed after changes to the
candidate register/audit; no Expo build command is involved.

## Exporting results

With `DATABASE_URL` configured, run from the repository root:

```sh
npm run ontology:review:results -- reviewer-id
```

This prints machine-readable JSON with the question-set version, reviewer ID,
answers, and review timestamps. It does not promote concepts or alter any
ontology source.

## Checks

```sh
npm run test
npm run typecheck
npm run lint
npm run build
```
