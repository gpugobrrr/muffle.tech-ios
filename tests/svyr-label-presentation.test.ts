import assert from 'node:assert/strict';
import test from 'node:test';

import { formatSvyrDisplayedLabel } from '../src/lib/svyr-label-presentation';
import { buildSingleChoiceSuggestions } from '../src/lib/single-choice';
import { buildMultiChoiceSuggestions } from '../src/lib/multi-choice';
import {
  findFieldDefinition,
  normalizeFieldInputValue,
} from '../src/lib/field-schema';
import { SERVICES_PRESENCE_ROUTES } from '../src/lib/services-controlled-facts';
import { HEATING_COMPOUND_PATH } from '../src/lib/property-energy-heating';
import { parseCommand } from '../src/lib/command-parser';

test('navigation item label renders with square brackets', () => {
  assert.equal(formatSvyrDisplayedLabel('services', 'navigation'), '[services]');
});

test('controlled status choice renders with parentheses', () => {
  assert.equal(formatSvyrDisplayedLabel('Present', 'choice'), '(Present)');
  assert.equal(
    formatSvyrDisplayedLabel('Not inspected', 'choice'),
    '(Not inspected)',
  );
});

test('single-choice suggestions keep canonical values separate from display', () => {
  const field = findFieldDefinition([...SERVICES_PRESENCE_ROUTES.electricity]);
  assert.ok(field);
  const suggestions = buildSingleChoiceSuggestions(field!, 'present');
  const present = suggestions.find(
    (suggestion) => suggestion.canonicalValue === 'present',
  );
  assert.ok(present);
  assert.equal(present.label, 'Present');
  assert.equal(formatSvyrDisplayedLabel(present.label, 'choice'), '(Present)');
  assert.equal(present.selected, true);
});

test('multi-choice option labels use parentheses at render time', () => {
  const field = findFieldDefinition([...HEATING_COMPOUND_PATH, 'heat-emitters']);
  assert.ok(field);
  const suggestions = buildMultiChoiceSuggestions(field!, ['radiators']);
  const radiator = suggestions.find(
    (suggestion) =>
      suggestion.type === 'choice' && suggestion.canonicalValue === 'radiators',
  );
  assert.ok(radiator && radiator.type === 'choice');
  assert.equal(
    formatSvyrDisplayedLabel(radiator.label, 'choice'),
    '(Radiators)',
  );
});

test('selected choice presentation keeps parentheses', () => {
  const selected = formatSvyrDisplayedLabel('Present', 'choice');
  const unselected = formatSvyrDisplayedLabel('Present', 'choice');
  assert.equal(selected, '(Present)');
  assert.equal(unselected, '(Present)');
  assert.notEqual(selected, '[Present]');
});

test('grouped navigation row labels use square brackets', () => {
  assert.equal(formatSvyrDisplayedLabel('Gas', 'navigation'), '[Gas]');
  assert.equal(formatSvyrDisplayedLabel('Electricity', 'navigation'), '[Electricity]');
});

test('selecting a parenthesized label commits the canonical value', () => {
  const field = findFieldDefinition([...SERVICES_PRESENCE_ROUTES.electricity]);
  assert.ok(field);
  assert.equal(normalizeFieldInputValue(field!, 'unknown'), 'unknown');
  assert.notEqual(normalizeFieldInputValue(field!, 'unknown'), '(unknown)');
});

test('navigation route tokens are unchanged by display formatting', () => {
  const parsed = parseCommand('services/electricity/presence present');
  assert.equal(parsed.type, 'operation');
});

test('multi-commit done remains a navigation-style bracket label', () => {
  assert.equal(formatSvyrDisplayedLabel('done', 'navigation'), '[done]');
});

test('accessibility-oriented labels stay plain without punctuation', () => {
  const visible = formatSvyrDisplayedLabel('Present', 'choice');
  assert.equal(visible, '(Present)');
  assert.equal('Present', 'Present');
});
