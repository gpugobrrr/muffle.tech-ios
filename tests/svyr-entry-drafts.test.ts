import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { resolveDirectoryCompletion } from '../src/lib/completion';
import { suffixForPath } from '../src/lib/pin-context';
import { executeSurveyOperation } from '../src/lib/survey-operations';
import {
  clearEntryDraft,
  readEntryDraft,
  resolveDataEntryReentryDraft,
  stashEntryDraft,
  suffixForDataEntryReentry,
  type SvyrEntryDraftsByPath,
} from '../src/lib/svyr-entry-drafts';
import { resolveSvyrBarSegmentTarget } from '../src/lib/svyr-bar-navigation';
import type { InspectionBrief } from '../src/types/workspace';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createBrief(overrides?: Partial<InspectionBrief>): InspectionBrief {
  return {
    instruction: {
      instructingParty: null,
      client: null,
      reference: null,
      source: null,
    },
    purpose: null,
    deliverable: null,
    limitation: null,
    ...overrides,
  } as InspectionBrief;
}

type NavState = {
  path: string[];
  draft: string;
  activeEntry: boolean;
  brief: InspectionBrief;
  draftsByPath: SvyrEntryDraftsByPath;
  operations: string[];
  completionParty: number | null;
};

function applyUnconditionalBarNavigation(
  state: NavState,
  target: string[],
): NavState {
  const nextDrafts = state.activeEntry
    ? stashEntryDraft(state.draftsByPath, state.path, state.draft)
    : state.draftsByPath;
  return {
    ...state,
    path: target,
    draft: '',
    activeEntry: false,
    draftsByPath: nextDrafts,
  };
}

function reenterField(state: NavState, fieldPath: string[]): NavState {
  const draft = readEntryDraft(state.draftsByPath, fieldPath);
  return {
    ...state,
    path: fieldPath,
    activeEntry: true,
    draft: draft ?? '',
  };
}

function partyCompleted(brief: InspectionBrief): number {
  const completion = resolveDirectoryCompletion(
    ['prep', 'brief', 'instr'],
    brief,
  );
  return (
    completion?.children.find((child) => child.token === 'party')?.completed ??
    0
  );
}

function baseState(
  overrides: Partial<NavState> & Pick<NavState, 'path' | 'draft'>,
): NavState {
  const brief = overrides.brief ?? createBrief();
  return {
    path: overrides.path,
    draft: overrides.draft,
    activeEntry: overrides.activeEntry ?? true,
    brief,
    draftsByPath: overrides.draftsByPath ?? {},
    operations: overrides.operations ?? [],
    completionParty: partyCompleted(brief),
  };
}

test('empty draft final-segment BACK exits normally', () => {
  const field = ['prep', 'brief', 'instr', 'party'];
  const state = baseState({ path: field, draft: '' });
  const target = resolveSvyrBarSegmentTarget(field, 3);
  assert.ok(target);
  const next = applyUnconditionalBarNavigation(state, target!);
  assert.deepEqual(next.path, ['prep', 'brief', 'instr']);
  assert.equal(next.activeEntry, false);
  assert.equal(readEntryDraft(next.draftsByPath, field), undefined);
});

test('non-empty draft final-segment BACK exits without Engine write', () => {
  const field = ['prep', 'brief', 'instr', 'party'];
  const state = baseState({ path: field, draft: 'Smith & Co' });
  const target = resolveSvyrBarSegmentTarget(field, 3);
  assert.ok(target);
  const next = applyUnconditionalBarNavigation(state, target!);
  assert.deepEqual(next.path, ['prep', 'brief', 'instr']);
  assert.equal(next.activeEntry, false);
  assert.equal(next.brief.instruction.instructingParty, null);
  assert.deepEqual(next.operations, []);
  assert.equal(partyCompleted(next.brief), state.completionParty);
  assert.equal(readEntryDraft(next.draftsByPath, field), 'Smith & Co');
});

test('re-entering the same field restores its transient draft', () => {
  const field = ['prep', 'brief', 'instr', 'party'];
  let state = baseState({ path: field, draft: 'Smith & Co' });
  state = applyUnconditionalBarNavigation(
    state,
    resolveSvyrBarSegmentTarget(field, 3)!,
  );
  state = reenterField(state, field);
  assert.equal(state.draft, 'Smith & Co');
  assert.equal(state.activeEntry, true);
});

test('entering a different field does not show the party draft', () => {
  const party = ['prep', 'brief', 'instr', 'party'];
  const client = ['prep', 'brief', 'instr', 'client'];
  let state = baseState({ path: party, draft: 'Smith & Co' });
  state = applyUnconditionalBarNavigation(
    state,
    resolveSvyrBarSegmentTarget(party, 3)!,
  );
  state = reenterField(state, client);
  assert.equal(state.draft, '');
  assert.equal(readEntryDraft(state.draftsByPath, party), 'Smith & Co');
});

test('earlier-segment jump preserves the party draft', () => {
  const party = ['prep', 'brief', 'instr', 'party'];
  let state = baseState({ path: party, draft: 'Temp Party' });
  state = applyUnconditionalBarNavigation(
    state,
    resolveSvyrBarSegmentTarget(party, 1)!,
  );
  assert.deepEqual(state.path, ['prep', 'brief']);
  assert.equal(readEntryDraft(state.draftsByPath, party), 'Temp Party');
  state = reenterField(state, party);
  assert.equal(state.draft, 'Temp Party');
});

test('root jump preserves the field draft', () => {
  const party = ['prep', 'brief', 'instr', 'party'];
  let state = baseState({ path: party, draft: 'Root Draft' });
  state = applyUnconditionalBarNavigation(state, []);
  assert.deepEqual(state.path, []);
  assert.equal(readEntryDraft(state.draftsByPath, party), 'Root Draft');
});

test('successful commit clears that field transient draft', () => {
  const party = ['prep', 'brief', 'instr', 'party'];
  let drafts = stashEntryDraft({}, party, 'Smith & Co');
  const before = createBrief();
  const result = executeSurveyOperation(before, {
    operationId: 'survey.brief.instruction.party.set',
    arguments: { value: 'Smith & Co' },
  });
  assert.ok(result);
  drafts = clearEntryDraft(drafts, party);
  assert.equal(readEntryDraft(drafts, party), undefined);
  assert.equal(result!.brief.instruction.instructingParty, 'Smith & Co');
  const restored = suffixForDataEntryReentry({
    path: party,
    draft: readEntryDraft(drafts, party),
    defaultInsertion: 'prep/brief/instr/party ',
    suffixForPath,
  });
  assert.equal(restored, 'prep/brief/instr/party ');
});

test('stash helpers are field-scoped and empty clears', () => {
  const party = ['prep', 'brief', 'instr', 'party'];
  const client = ['prep', 'brief', 'instr', 'client'];
  let drafts = stashEntryDraft({}, party, 'A');
  drafts = stashEntryDraft(drafts, client, 'B');
  assert.equal(readEntryDraft(drafts, party), 'A');
  assert.equal(readEntryDraft(drafts, client), 'B');
  drafts = stashEntryDraft(drafts, party, '');
  assert.equal(readEntryDraft(drafts, party), undefined);
  assert.equal(readEntryDraft(drafts, client), 'B');
});

test('canonical finding value wins over stashed draft on re-entry', () => {
  assert.equal(
    resolveDataEntryReentryDraft({
      canonicalValue: 'Consumer unit appears dated.',
      stashedDraft: 'older uncommitted draft',
    }),
    'Consumer unit appears dated.',
  );
  assert.equal(
    resolveDataEntryReentryDraft({
      canonicalValue: null,
      stashedDraft: 'resume editing',
    }),
    'resume editing',
  );
});

test('controller commits finding fields before bar navigation', () => {
  const workspace = readFileSync(
    path.join(repoRoot, 'src/hooks/use-workspace.ts'),
    'utf8',
  );
  assert.match(workspace, /tryCommitActiveFindingEntry/);
  assert.match(workspace, /commitOutcome === 'failed'/);
});

test('shared SvyrBar remains the sole path-bar implementation', () => {
  const dock = readFileSync(
    path.join(repoRoot, 'src/components/command-dock.tsx'),
    'utf8',
  );
  const textEntry = readFileSync(
    path.join(repoRoot, 'src/components/text-entry-page.tsx'),
    'utf8',
  );
  assert.match(dock, /<SvyrBar/);
  assert.doesNotMatch(
    textEntry,
    /from '@\/components\/(?:svyr-bar|workspace-terminal)'/,
  );
});
