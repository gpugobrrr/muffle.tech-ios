import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { verifyCommandContract } from '../src/lib/command-contract';
import {
  canRemoveLastEditableCommandSegment,
  parseEditableCommand,
  removeLastEditableCommandSegment,
} from '../src/lib/command-edit';
import { getCommandAssistance, parseCommand } from '../src/lib/command-parser';
import { formatCommandPath } from '../src/lib/command-registry';
import { structuredCommandPathFromInput } from '../src/lib/field-information';
import { SVYR_HINT_COPY, SVYR_HINT_IDS } from '../src/lib/hint-repository';
import { suffixForPath } from '../src/lib/pin-context';
import {
  clearEntryDraft,
  readEntryDraft,
  stashEntryDraft,
  suffixForDataEntryReentry,
} from '../src/lib/svyr-entry-drafts';
import { executeSurveyOperation } from '../src/lib/survey-operations';
import type { InspectionBrief } from '../src/types/workspace';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const PIN_UI_COPY = 'Pin this path for repeated entry';

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

test('PIN UI REMOVED: capture/navigation sources never render pin copy', () => {
  const sources = [
    'src/components/svyr-interface.tsx',
    'src/components/command-dock.tsx',
    'src/components/svyr-bar.tsx',
    'src/components/svyr-navigation-page.tsx',
    'src/lib/hint-repository.ts',
    'src/hooks/use-workspace.ts',
  ];
  for (const relative of sources) {
    assert.doesNotMatch(
      readSrc(relative),
      new RegExp(PIN_UI_COPY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      relative,
    );
  }
  assert.ok(!Object.values(SVYR_HINT_COPY).includes(PIN_UI_COPY));
  assert.ok(!(SVYR_HINT_IDS as readonly string[]).includes('pinPath'));
});

test('UNPIN UI REMOVED: no pin-specific unpin / toggle wiring remains', () => {
  const iface = readSrc('src/components/svyr-interface.tsx');
  const dock = readSrc('src/components/command-dock.tsx');
  const bar = readSrc('src/components/svyr-bar.tsx');
  const workspace = readSrc('src/hooks/use-workspace.ts');

  for (const source of [iface, dock, bar, workspace]) {
    assert.doesNotMatch(source, /onToggleCurrentPathPin/);
    assert.doesNotMatch(source, /toggleCurrentPathPin/);
    assert.doesNotMatch(source, /canPinCurrentPath/);
    assert.doesNotMatch(source, /isCurrentPathPinned/);
    assert.doesNotMatch(source, /pinnedCommandPrefix/);
  }
});

test('PIN STATE REMOVED: workspace controller has no live pin fields', () => {
  const workspace = readSrc('src/hooks/use-workspace.ts');
  assert.doesNotMatch(workspace, /pinnedCommandPrefix/);
  assert.doesNotMatch(workspace, /setPinnedCommandPrefix/);
  assert.doesNotMatch(workspace, /applyPinContext/);
  assert.doesNotMatch(workspace, /applyUnpinContext/);
  assert.doesNotMatch(workspace, /transientFeedback/);
  assert.doesNotMatch(workspace, /case 'pin-context'/);
  assert.doesNotMatch(workspace, /case 'cannot-pin'/);
  // Shared path helpers remain in pin-context.ts (pathKey / suffixForPath).
  assert.match(workspace, /from '@\/lib\/pin-context'/);
});

test('PIN HANDLERS REMOVED: pin helpers no longer compose or toggle context', () => {
  const pinContext = readSrc('src/lib/pin-context.ts');
  assert.doesNotMatch(pinContext, /composeFullCommand/);
  assert.doesNotMatch(pinContext, /pinCommandForPath/);
  assert.doesNotMatch(pinContext, /isPinnablePath/);
  assert.doesNotMatch(pinContext, /unpin/);
  assert.match(pinContext, /export function suffixForPath/);
  assert.match(pinContext, /export function pathKey/);
});

test('NAVIGATION REGRESSION: route suggestions still resolve without a pin prefix', () => {
  const root = getCommandAssistance('');
  assert.ok(root.some((item) => item.type === 'token' && item.label.includes('services')));
  const services = getCommandAssistance('services/');
  assert.ok(
    services.some((item) => item.type === 'token' && item.commandPath.includes('heating')),
  );
  assert.deepEqual(
    structuredCommandPathFromInput('services/heating'),
    ['services', 'heating'],
  );
});

test('BREADCRUMB REGRESSION: structural path formatting stays pin-independent', () => {
  assert.equal(formatCommandPath(['services', 'heating']), 'services/heating');
  assert.equal(suffixForPath(['services', 'heating']), 'services/heating');
  const parsed = parseEditableCommand('services/heating');
  assert.deepEqual(parsed.structuredTokens, ['services', 'heating']);
  assert.equal(parsed.valueText, '');
});

test('CAPTURE REGRESSION: data-entry commit works without pinning', () => {
  const result = executeSurveyOperation(createBrief(), {
    operationId: 'survey.brief.instruction.party.set',
    arguments: { value: 'North & Co' },
  });
  assert.ok(result);
  assert.equal(result!.brief.instruction.instructingParty, 'North & Co');
});

test('RE-ENTRY: leaving and returning restores drafts without a pinned prefix', () => {
  const pathTokens = ['prep', 'brief', 'instr', 'party'];
  let drafts = stashEntryDraft({}, pathTokens, 'North & Co');
  assert.equal(readEntryDraft(drafts, pathTokens), 'North & Co');
  const restored = suffixForDataEntryReentry({
    path: pathTokens,
    draft: readEntryDraft(drafts, pathTokens),
    defaultInsertion: 'prep/brief/instr/party ',
    suffixForPath,
  });
  assert.equal(restored, 'prep/brief/instr/party North & Co');
  drafts = clearEntryDraft(drafts, pathTokens);
  assert.equal(readEntryDraft(drafts, pathTokens), undefined);
});

test('NO EMPTY SPACE: dock/interface no longer reserve a pin-row slot', () => {
  const dock = readSrc('src/components/command-dock.tsx');
  const iface = readSrc('src/components/svyr-interface.tsx');
  assert.doesNotMatch(dock, /pinPath/);
  assert.doesNotMatch(dock, /transientFeedback/);
  assert.doesNotMatch(iface, /pinPath/);
  assert.doesNotMatch(iface, /Pin this path/);
  assert.doesNotMatch(iface, /handleTogglePin/);
});

test('COMMAND REGRESSION: pin/unpin parse as unknown; unrelated parsing still passes', () => {
  assert.equal(parseCommand('prep/brief pin').type, 'unknown');
  assert.equal(parseCommand('unpin').type, 'unknown');
  assert.equal(parseCommand('pin').type, 'unknown');

  const party = parseCommand('prep/brief/instr/party North & Co');
  assert.equal(party.type, 'operation');

  assert.equal(canRemoveLastEditableCommandSegment('services/heating'), true);
  assert.equal(
    removeLastEditableCommandSegment('services/heating'),
    'services',
  );

  const failures = verifyCommandContract();
  assert.deepEqual(failures, []);
});
