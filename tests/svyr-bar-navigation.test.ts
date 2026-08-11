import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  resolveSvyrBarRootTarget,
  resolveSvyrBarSegmentTarget,
  SVYR_BAR_LAYOUT,
} from '../src/lib/svyr-bar-navigation';
import type { InspectionBrief } from '../src/types/workspace';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

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

/**
 * Minimal stand-in for shared-bar navigation: always leaves data entry and
 * never Engine-writes. Draft text is not committed here.
 */
function applyBarNavigation(state: {
  path: string[];
  draft: string;
  activeEntry: boolean;
  brief: InspectionBrief;
  operations: string[];
}, target: string[]) {
  return {
    ...state,
    path: target,
    draft: '',
    activeEntry: false,
  };
}

test('earlier segments jump directly to that path level', () => {
  const path = ['prep', 'brief', 'instr', 'source'];
  assert.deepEqual(resolveSvyrBarSegmentTarget(path, 0), ['prep']);
  assert.deepEqual(resolveSvyrBarSegmentTarget(path, 1), ['prep', 'brief']);
  assert.deepEqual(resolveSvyrBarSegmentTarget(path, 2), [
    'prep',
    'brief',
    'instr',
  ]);
});

test('final segment on prep/brief returns to prep', () => {
  assert.deepEqual(resolveSvyrBarSegmentTarget(['prep', 'brief'], 1), ['prep']);
});

test('final segment on prep/brief/instr returns to prep/brief', () => {
  assert.deepEqual(
    resolveSvyrBarSegmentTarget(['prep', 'brief', 'instr'], 2),
    ['prep', 'brief'],
  );
});

test('final segment on text leaf exits to parent directory', () => {
  assert.deepEqual(
    resolveSvyrBarSegmentTarget(['prep', 'brief', 'instr', 'party'], 3),
    ['prep', 'brief', 'instr'],
  );
});

test('final segment on single-choice leaf exits to parent directory', () => {
  assert.deepEqual(
    resolveSvyrBarSegmentTarget(['prep', 'brief', 'instr', 'source'], 3),
    ['prep', 'brief', 'instr'],
  );
});

test('root press never pops below an empty path', () => {
  assert.deepEqual(resolveSvyrBarRootTarget([]), []);
  assert.deepEqual(resolveSvyrBarRootTarget(['prep', 'brief']), []);
});

test('out-of-range segment indexes are rejected', () => {
  assert.equal(resolveSvyrBarSegmentTarget(['prep'], -1), null);
  assert.equal(resolveSvyrBarSegmentTarget(['prep'], 1), null);
});

test('breadcrumb back with a non-empty draft exits without submitting', () => {
  const brief = createBrief();
  const state = {
    path: ['prep', 'brief', 'instr', 'party'],
    draft: 'Acme',
    activeEntry: true,
    brief,
    operations: [] as string[],
  };
  const target = resolveSvyrBarSegmentTarget(state.path, 3);
  assert.ok(target);
  const next = applyBarNavigation(state, target!);
  assert.deepEqual(next.path, ['prep', 'brief', 'instr']);
  assert.equal(next.activeEntry, false);
  assert.deepEqual(next.operations, []);
  assert.equal(next.brief.instruction.instructingParty, null);
  assert.equal(state.draft, 'Acme');
});

test('empty-draft final-segment back exits data entry without Engine writes', () => {
  const brief = createBrief({
    instruction: {
      instructingParty: null,
      client: null,
      reference: null,
      source: 'phone',
    },
  });
  const beforeSource = brief.instruction.source;
  const state = {
    path: ['prep', 'brief', 'instr', 'source'],
    draft: '',
    activeEntry: true,
    brief,
    operations: [] as string[],
  };
  const target = resolveSvyrBarSegmentTarget(state.path, 3);
  assert.ok(target);
  const next = applyBarNavigation(state, target!);
  assert.ok(next);
  assert.deepEqual(next!.path, ['prep', 'brief', 'instr']);
  assert.equal(next!.activeEntry, false);
  assert.equal(next!.brief.instruction.source, beforeSource);
  assert.deepEqual(next!.operations, []);
});

test('shared layout contract is stable', () => {
  assert.equal(SVYR_BAR_LAYOUT.minHeight, 36);
  assert.equal(SVYR_BAR_LAYOUT.paddingHorizontal, 12);
  assert.equal(SVYR_BAR_LAYOUT.pathMinHeight, 28);
});

test('CommandDock is the only runtime host of SvyrBar', () => {
  const dock = readSrc('src/components/command-dock.tsx');
  const textEntry = readSrc('src/components/text-entry-page.tsx');
  const singleChoice = readSrc('src/components/single-choice-entry-page.tsx');
  const dataEntry = readSrc('src/components/svyr-data-entry-panel.tsx');
  const iface = readSrc('src/components/svyr-interface.tsx');
  const autocomplete = readSrc('src/components/autocomplete-area.tsx');

  assert.match(dock, /from '@\/components\/svyr-bar'/);
  assert.match(dock, /<SvyrBar/);
  assert.match(iface, /<CommandDock/);
  assert.doesNotMatch(textEntry, /from '@\/components\/(?:svyr-bar|workspace-terminal)'/);
  assert.doesNotMatch(
    singleChoice,
    /from '@\/components\/(?:svyr-bar|workspace-terminal)'/,
  );
  assert.doesNotMatch(dataEntry, /from '@\/components\/(?:svyr-bar|workspace-terminal)'/);
  assert.doesNotMatch(
    autocomplete,
    /from '@\/components\/(?:svyr-bar|workspace-terminal)'/,
  );
});

test('navigation and capture pages share one dock-mounted bar wiring', () => {
  const iface = readSrc('src/components/svyr-interface.tsx');
  assert.match(iface, /path=\{svyrBarPath\}/);
  assert.match(iface, /onSegmentPress=\{controller\.navigateToDataEntrySegment\}/);
  assert.match(iface, /onRootPress=\{controller\.navigateToSvyrRoot\}/);
  assert.doesNotMatch(iface, /showTerminal=/);
  assert.doesNotMatch(iface, /dataEntryActive=/);
});
