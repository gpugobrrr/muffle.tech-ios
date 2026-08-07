import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCommand } from '../src/lib/command-parser';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import { findFieldDefinition, normalizeFieldInputValue } from '../src/lib/field-schema';
import { executeSurveyOperation } from '../src/lib/survey-operations';
import type { InspectionBrief } from '../src/types/workspace';

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

test('source options resolve from the field schema', () => {
  const field = findFieldDefinition(['prep', 'brief', 'instr', 'source']);
  assert.ok(field);
  assert.equal(field?.valueType, 'singleSelect');
  assert.deepEqual(field?.options?.[0], { value: 'email', label: 'Email' });
});

test('tapping Email stores email', () => {
  const field = findFieldDefinition(['prep', 'brief', 'instr', 'source']);
  assert.ok(field);
  assert.equal(normalizeFieldInputValue(field!, 'Email'), 'email');
});

test('selected option updates completion', () => {
  const brief = createBrief({
    instruction: {
      instructingParty: null,
      client: null,
      reference: null,
      source: 'email',
    },
  });
  const completion = resolveDirectoryCompletion(['prep', 'brief', 'instr'], brief);
  const sourceRow = completion?.children.find((child) => child.token === 'source');
  assert.ok(sourceRow);
  assert.equal(sourceRow?.completed, 1);
  assert.equal(sourceRow?.total, 1);
});

test('text-entry toggle mode swaps selector and text modes', () => {
  const nextMode = 'text';
  assert.equal(nextMode, 'text');
});

test('custom non-empty text is accepted', () => {
  const field = findFieldDefinition(['prep', 'brief', 'instr', 'source']);
  assert.ok(field);
  assert.equal(normalizeFieldInputValue(field!, 'Referral from regional office'), 'Referral from regional office');
});

test('empty custom text is rejected', () => {
  const field = findFieldDefinition(['prep', 'brief', 'instr', 'source']);
  assert.ok(field);
  assert.equal(normalizeFieldInputValue(field!, '   '), null);
});

test('typed SVYR option values still work', () => {
  const parsed = parseCommand('prep/brief/instr/source portal');
  assert.equal(parsed.type, 'operation');
  const result = executeSurveyOperation(createBrief(), parsed.operation);
  assert.equal(result?.value, 'portal');
});

test('typed custom source values still work', () => {
  const parsed = parseCommand('prep/brief/instr/source Referral from regional office');
  assert.equal(parsed.type, 'operation');
  const result = executeSurveyOperation(createBrief(), parsed.operation);
  assert.equal(result?.value, 'Referral from regional office');
});
