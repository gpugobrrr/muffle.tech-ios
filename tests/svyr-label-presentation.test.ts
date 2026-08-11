import assert from 'node:assert/strict';
import test from 'node:test';

import { formatSvyrDisplayedLabel } from '../src/lib/svyr-label-presentation';
import { normalizeFieldInputValue, findFieldDefinition } from '../src/lib/field-schema';
import { parseCommand } from '../src/lib/command-parser';
import { executeSurveyOperation } from '../src/lib/survey-operations';
import type { InspectionBrief } from '../src/types/workspace';

test('navigation label renders with square brackets', () => {
  assert.equal(formatSvyrDisplayedLabel('services', 'navigation'), '[services]');
  assert.equal(formatSvyrDisplayedLabel('electricity', 'navigation'), '[electricity]');
});

test('single-choice data-entry label renders with parentheses', () => {
  assert.equal(formatSvyrDisplayedLabel('Present', 'choice'), '(Present)');
});

test('controlled status label renders with parentheses', () => {
  assert.equal(formatSvyrDisplayedLabel('Not inspected', 'choice'), '(Not inspected)');
});

test('multi-choice labels use parentheses', () => {
  for (const label of ['Gas', 'Electricity', 'Water']) {
    assert.equal(formatSvyrDisplayedLabel(label, 'choice'), `(${label})`);
  }
});

test('selecting a parenthesized label still commits the canonical value', () => {
  const field = findFieldDefinition(['prep', 'brief', 'instr', 'source']);
  assert.ok(field);
  assert.equal(normalizeFieldInputValue(field!, 'Portal'), 'portal');
  assert.equal(normalizeFieldInputValue(field!, 'portal'), 'portal');
  assert.notEqual(normalizeFieldInputValue(field!, 'portal'), '(portal)');
});

test('navigation formatting does not alter route tokens', () => {
  const displayed = formatSvyrDisplayedLabel('services', 'navigation');
  assert.equal(displayed, '[services]');
  assert.notEqual(displayed, 'services');
  const parsed = parseCommand('prep/brief/instr/source email');
  assert.equal(parsed.type, 'operation');
});

test('selected presentation keeps parentheses for data-entry choices', () => {
  const unselected = formatSvyrDisplayedLabel('Present', 'choice');
  const selected = formatSvyrDisplayedLabel('Present', 'choice');
  assert.equal(unselected, '(Present)');
  assert.equal(selected, '(Present)');
  assert.notEqual(selected, '[Present]');
});

test('free-text values are not wrapped by choice formatting at commit time', () => {
  const field = findFieldDefinition(['prep', 'brief', 'instr', 'source']);
  assert.ok(field);
  const custom = 'Referral from regional office';
  assert.equal(normalizeFieldInputValue(field!, custom), custom);
  assert.equal(formatSvyrDisplayedLabel(custom, 'choice'), `(${custom})`);
});

test('grouped navigation rows keep square brackets', () => {
  assert.equal(formatSvyrDisplayedLabel('Gas', 'navigation'), '[Gas]');
});

test('presentation mode drives punctuation without route-specific logic', () => {
  const label = 'Unknown';
  assert.equal(formatSvyrDisplayedLabel(label, 'navigation'), `[${label}]`);
  assert.equal(formatSvyrDisplayedLabel(label, 'choice'), `(${label})`);
});

test('typed SVYR source values remain canonical after visual choice labels', () => {
  const brief: InspectionBrief = {
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
  const parsed = parseCommand('prep/brief/instr/source portal');
  assert.equal(parsed.type, 'operation');
  const result = executeSurveyOperation(
    brief,
    parsed.type === 'operation' ? parsed.operation : { operationId: '', arguments: {} },
  );
  assert.equal(result?.value, 'portal');
  assert.notEqual(result?.value, '(portal)');
});
