import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCommand } from '../src/lib/command-parser';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import {
  findFieldDefinition,
  normalizeFieldInputValue,
  type FieldDefinition,
} from '../src/lib/field-schema';
import { buildSingleChoiceSuggestions } from '../src/lib/single-choice';
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

test('single-choice suggestions derive from schema and retain canonical values', () => {
  const field = findFieldDefinition(['prep', 'brief', 'instr', 'source']);
  assert.ok(field);
  const suggestions = buildSingleChoiceSuggestions(field!, 'portal');
  assert.deepEqual(
    suggestions.map(({ label, canonicalValue, selected }) => ({
      label,
      canonicalValue,
      selected,
    })),
    field!.options?.map(({ label, value }) => ({
      label,
      canonicalValue: value,
      selected: value === 'portal',
    })),
  );
  assert.equal(
    suggestions.find(({ canonicalValue }) => canonicalValue === 'portal')?.label,
    'Client portal',
  );
});

test('unavailable and unknown single-choice values fail validation', () => {
  const source = findFieldDefinition(['prep', 'brief', 'instr', 'source']);
  assert.ok(source);
  const field = {
    ...source,
    options: [
      ...(source!.options ?? []),
      { value: 'retired', label: 'Retired channel', available: false },
    ],
  } satisfies FieldDefinition;
  const suggestions = buildSingleChoiceSuggestions(field, null);
  assert.equal(
    suggestions.find(({ canonicalValue }) => canonicalValue === 'retired')
      ?.available,
    false,
  );
  assert.equal(normalizeFieldInputValue(field, 'retired'), null);
  assert.equal(normalizeFieldInputValue(source!, 'unlisted channel'), null);
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

test('empty single-choice input is rejected', () => {
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

test('typed custom source values do not bypass the controlled vocabulary', () => {
  const parsed = parseCommand('prep/brief/instr/source Referral from regional office');
  assert.equal(parsed.type, 'incomplete');
});

test('Engine rejects a single-choice value outside the schema', () => {
  const result = executeSurveyOperation(createBrief(), {
    operationId: 'survey.brief.instruction.source.set',
    arguments: { value: 'unlisted channel' },
  });
  assert.equal(result, null);
});
