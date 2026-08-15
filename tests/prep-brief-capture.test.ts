import assert from 'node:assert/strict';
import test from 'node:test';

import { findCommandNode } from '../src/lib/command-registry';
import { parseCommand } from '../src/lib/command-parser';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import {
  applyFieldValue,
  findFieldDefinition,
  resolveFieldValue,
} from '../src/lib/field-schema';
import {
  readEntryDraft,
  stashEntryDraft,
  suffixForDataEntryReentry,
  type SvyrEntryDraftsByPath,
} from '../src/lib/svyr-entry-drafts';
import { suffixForPath } from '../src/lib/pin-context';
import {
  executeSurveyOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
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

const PREP_WRITE_COMMANDS: { path: string[]; value: string }[] = [
  { path: ['prep', 'brief', 'instr', 'party'], value: 'North & Co' },
  { path: ['prep', 'brief', 'instr', 'client'], value: 'Jane Doe' },
  { path: ['prep', 'brief', 'instr', 'ref'], value: 'REF-2026-001' },
  { path: ['prep', 'brief', 'instr', 'source'], value: 'email' },
  { path: ['prep', 'brief', 'purp'], value: 'Pre-purchase level 2 survey' },
  { path: ['prep', 'brief', 'deliv'], value: 'Standard digital condition report' },
  { path: ['prep', 'brief', 'limit'], value: 'No access to locked loft space' },
];

test('every PREP brief field exposes a live survey write operation', () => {
  for (const { path } of PREP_PATHS) {
    const field = findFieldDefinition(path);
    assert.ok(field?.operationId, path.join('/'));
    assert.ok(field?.readOperationId, path.join('/'));

    const node = findCommandNode(path);
    assert.ok(node);
    assert.equal(node.operationId, field.operationId);
    assert.equal(node.readOperationId, field.readOperationId);
  }
});

test('PREP brief parser and engine dispatch accept all seven field writes', () => {
  let brief = createEmptyBrief();

  for (const { path, value } of PREP_WRITE_COMMANDS) {
    const field = findFieldDefinition(path);
    assert.ok(field?.operationId);

    const command = `${path.join('/')} ${value}`;
    const parsed = parseCommand(command);
    assert.equal(parsed.type, 'operation', command);
    if (parsed.type !== 'operation') continue;
    assert.equal(parsed.operation.operationId, field.operationId);

    const result = executeSurveyOperation(brief, parsed.operation);
    assert.ok(result, command);
    brief = result.brief;
    assert.equal(resolveFieldValue(brief, field.fieldId), value);
  }
});

test('PREP brief read operations resolve through the same schema bindings', () => {
  const brief = applyFieldValue(
    applyFieldValue(
      applyFieldValue(createEmptyBrief(), 'instruction.instructingParty', 'North & Co'),
      'purpose',
      'Pre-purchase level 2 survey',
    ),
    'instruction.client',
    'Jane Doe',
  );

  const partyRead = executeSurveyOperation(brief, {
    operationId: SURVEY_OPERATIONS.readInstructingParty,
    arguments: {},
  });
  const clientRead = executeSurveyOperation(brief, {
    operationId: SURVEY_OPERATIONS.readInstructionClient,
    arguments: {},
  });
  const purposeRead = executeSurveyOperation(brief, {
    operationId: SURVEY_OPERATIONS.readPurpose,
    arguments: {},
  });

  assert.equal(partyRead?.value, 'North & Co');
  assert.equal(clientRead?.value, 'Jane Doe');
  assert.equal(purposeRead?.value, 'Pre-purchase level 2 survey');
});

test('re-entry prefers a stashed draft over the committed PREP field value', () => {
  const path = ['prep', 'brief', 'purp'];
  const committed = 'Committed purpose';
  const draft = 'Draft purpose';

  const suffix = suffixForDataEntryReentry({
    path,
    draft,
    defaultInsertion: 'purp ',
    suffixForPath,
  });
  assert.match(suffix, /Draft purpose$/);

  const reopened = suffixForDataEntryReentry({
    path,
    draft: committed,
    defaultInsertion: 'purp ',
    suffixForPath,
  });
  assert.match(reopened, /Committed purpose$/);
});

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
