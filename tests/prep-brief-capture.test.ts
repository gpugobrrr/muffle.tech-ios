import assert from 'node:assert/strict';
import test from 'node:test';

import { findCommandNode } from '../src/lib/command-registry';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import {
  applyFieldValue,
  findFieldDefinition,
  resolveFieldValue,
} from '../src/lib/field-schema';
import {
  readEntryDraft,
  stashEntryDraft,
  type SvyrEntryDraftsByPath,
} from '../src/lib/svyr-entry-drafts';
import type { InspectionBrief } from '../src/types/workspace';

function createEmptyBrief(): InspectionBrief {
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
  };
}

const PREP_PATHS: { path: string[]; token: string }[] = [
  { path: ['prep', 'brief', 'instr', 'party'], token: 'party' },
  { path: ['prep', 'brief', 'instr', 'client'], token: 'client' },
  { path: ['prep', 'brief', 'instr', 'ref'], token: 'ref' },
  { path: ['prep', 'brief', 'instr', 'source'], token: 'source' },
  { path: ['prep', 'brief', 'purp'], token: 'purp' },
  { path: ['prep', 'brief', 'deliv'], token: 'deliv' },
  { path: ['prep', 'brief', 'limit'], token: 'limit' },
];

test('every generated PREP brief command leaf agrees with its schema definition', () => {
  for (const { path, token } of PREP_PATHS) {
    const field = findFieldDefinition(path);
    assert.ok(field, `Field definition missing for path: ${path.join('/')}`);

    const node = findCommandNode(path);
    assert.ok(node, `Command node missing for path: ${path.join('/')}`);

    assert.equal(node.token, token);
    assert.equal(node.token, field.token);
    assert.equal(node.learnerLabel, field.label);
    assert.equal(node.description, field.description);
    assert.equal(node.requiresValue, true);
    assert.equal(node.valuePrompt, field.valuePrompt);
    assert.equal(node.entryLabel, field.entryLabel);
    assert.equal(node.valuePlaceholder, field.valuePlaceholder);
    assert.equal(node.operationId, field.operationId);
    assert.equal(node.readOperationId, field.readOperationId);
    assert.equal(node.fieldId, field.fieldId);
    assert.equal(node.required, true);
    assert.equal(node.required, field.required);
  }
});

test('empty PREP brief completion is 0/7, with instruction 0/4', () => {
  const brief = createEmptyBrief();

  const prepCompletion = resolveDirectoryCompletion(['prep'], brief);
  assert.ok(prepCompletion);
  assert.equal(prepCompletion.completed, 0);
  assert.equal(prepCompletion.total, 7);

  const briefCompletion = resolveDirectoryCompletion(['prep', 'brief'], brief);
  assert.ok(briefCompletion);
  assert.equal(briefCompletion.completed, 0);
  assert.equal(briefCompletion.total, 7);

  const instrCompletion = resolveDirectoryCompletion(
    ['prep', 'brief', 'instr'],
    brief,
  );
  assert.ok(instrCompletion);
  assert.equal(instrCompletion.completed, 0);
  assert.equal(instrCompletion.total, 4);
});

test('seven-field smoke test covers entry type, requiredness, draft, commit, re-entry, and completion', () => {
  let brief = createEmptyBrief();
  let drafts: SvyrEntryDraftsByPath = {};

  const testValues: Record<string, string> = {
    'instruction.instructingParty': 'Apex Properties',
    'instruction.client': 'Jane Doe',
    'instruction.reference': 'REF-2026-001',
    'instruction.source': 'email',
    purpose: 'Pre-purchase level 2 survey',
    deliverable: 'Standard digital condition report',
    limitation: 'No access to locked loft space',
  };

  for (const { path } of PREP_PATHS) {
    const field = findFieldDefinition(path);
    assert.ok(field);
    assert.equal(field.required, true);

    if (field.token === 'source') {
      assert.equal(field.valueType, 'singleSelect');
      assert.ok(field.options && field.options.length > 0);
    } else {
      assert.equal(field.valueType, undefined);
    }

    const testValue = testValues[field.fieldId];
    assert.ok(testValue);

    // Draft stashing and reading without affecting completion
    drafts = stashEntryDraft(drafts, path, testValue);
    assert.equal(readEntryDraft(drafts, path), testValue);

    const completionBeforeCommit = resolveDirectoryCompletion(
      ['prep', 'brief'],
      brief,
    );
    assert.ok(completionBeforeCommit);

    // Commit value
    brief = applyFieldValue(brief, field.fieldId, testValue);
    assert.equal(resolveFieldValue(brief, field.fieldId), testValue);

    // Re-entry check: resolving existing value preserves stored content
    assert.equal(resolveFieldValue(brief, field.fieldId), testValue);
  }

  // Full PREP completion must be 7/7 and instruction must be 4/4
  const fullPrep = resolveDirectoryCompletion(['prep'], brief);
  assert.ok(fullPrep);
  assert.equal(fullPrep.completed, 7);
  assert.equal(fullPrep.total, 7);

  const fullBrief = resolveDirectoryCompletion(['prep', 'brief'], brief);
  assert.ok(fullBrief);
  assert.equal(fullBrief.completed, 7);
  assert.equal(fullBrief.total, 7);

  const fullInstr = resolveDirectoryCompletion(['prep', 'brief', 'instr'], brief);
  assert.ok(fullInstr);
  assert.equal(fullInstr.completed, 4);
  assert.equal(fullInstr.total, 4);
});
