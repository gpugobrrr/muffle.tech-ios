import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseCommand } from '../src/lib/command-parser';
import {
  findFieldDefinition,
  normalizeFieldInputValue,
} from '../src/lib/field-schema';
import { buildMultiChoiceSuggestions } from '../src/lib/multi-choice';
import { HEATING_COMPOUND_PATH } from '../src/lib/property-energy-heating';
import { SERVICES_PRESENCE_ROUTES } from '../src/lib/services-controlled-facts';
import { buildSingleChoiceSuggestions } from '../src/lib/single-choice';
import { formatSvyrDisplayedLabel } from '../src/lib/svyr-label-presentation';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('NAVIGATION: services renders with square brackets', () => {
  assert.equal(formatSvyrDisplayedLabel('services', 'navigation'), '[services]');
});

test('SINGLE CHOICE: Present renders with angle brackets', () => {
  assert.equal(formatSvyrDisplayedLabel('Present', 'choice'), '<Present>');
});

test('CONTROLLED STATUS: Not inspected renders with angle brackets', () => {
  assert.equal(
    formatSvyrDisplayedLabel('Not inspected', 'choice'),
    '<Not inspected>',
  );
});

test('MULTI-CHOICE: selectable values use angle brackets at render time', () => {
  const field = findFieldDefinition([...HEATING_COMPOUND_PATH, 'heat-emitters']);
  assert.ok(field);
  const suggestions = buildMultiChoiceSuggestions(field!, ['radiators']);
  const radiator = suggestions.find(
    (suggestion) =>
      suggestion.type === 'choice' && suggestion.canonicalValue === 'radiators',
  );
  assert.ok(radiator && radiator.type === 'choice');
  assert.equal(formatSvyrDisplayedLabel(radiator.label, 'choice'), '<Radiators>');
});

test('SELECTED STATE: selected choice remains angle-bracketed', () => {
  const selected = formatSvyrDisplayedLabel('Present', 'choice');
  const unselected = formatSvyrDisplayedLabel('Present', 'choice');
  assert.equal(selected, '<Present>');
  assert.equal(unselected, '<Present>');
  assert.notEqual(selected, '[Present]');
  assert.notEqual(selected, '(Present)');
});

test('GROUPED NAVIGATION: deeper rows remain square-bracketed', () => {
  assert.equal(formatSvyrDisplayedLabel('Gas', 'navigation'), '[Gas]');
  assert.equal(
    formatSvyrDisplayedLabel('Electricity', 'navigation'),
    '[Electricity]',
  );
  const groupPage = readSrc('src/components/controlled-group-entry-page.tsx');
  assert.match(groupPage, /formatSvyrDisplayedLabel\(row\.field\.label, 'navigation'\)/);
});

test('MULTI-COMMIT ACTION: done remains navigation brackets', () => {
  assert.equal(formatSvyrDisplayedLabel('done', 'navigation'), '[done]');
  const autocomplete = readSrc('src/components/autocomplete-area.tsx');
  assert.match(autocomplete, /type === 'multi-commit'/);
  assert.match(autocomplete, /kind: 'navigation'/);
  assert.match(autocomplete, /kind: 'choice'/);
  assert.match(autocomplete, /SvyrChoiceItem/);
});

test('CANONICAL PAYLOAD: selecting Unknown still commits unknown', () => {
  const field = findFieldDefinition([...SERVICES_PRESENCE_ROUTES.electricity]);
  assert.ok(field);
  const suggestions = buildSingleChoiceSuggestions(field!, null);
  const unknown = suggestions.find(
    (suggestion) => suggestion.canonicalValue === 'unknown',
  );
  assert.ok(unknown);
  assert.equal(unknown.label, 'Unknown');
  assert.equal(formatSvyrDisplayedLabel(unknown.label, 'choice'), '<Unknown>');
  assert.equal(normalizeFieldInputValue(field!, 'unknown'), 'unknown');
  assert.notEqual(normalizeFieldInputValue(field!, 'unknown'), '<unknown>');
});

test('ROUTE PAYLOAD: navigation formatting does not alter route tokens', () => {
  assert.equal(formatSvyrDisplayedLabel('services', 'navigation'), '[services]');
  const parsed = parseCommand('services/electricity/presence present');
  assert.equal(parsed.type, 'operation');
});

test('ACCESSIBILITY: shared items keep undecorated accessibility labels', () => {
  const nav = readSrc('src/components/svyr-navigation-item.tsx');
  const choice = readSrc('src/components/svyr-choice-item.tsx');
  assert.match(nav, /accessibilityLabel=\{label\}/);
  assert.doesNotMatch(nav, /accessibilityLabel=\{`Suggestion/);
  assert.match(choice, /accessibilityLabel=\{label\}/);
  assert.equal(formatSvyrDisplayedLabel('Present', 'choice'), '<Present>');
});

test('FREE TEXT: finding/text entry pages do not wrap values in angle brackets', () => {
  const textEntry = readSrc('src/components/text-entry-page.tsx');
  const numeric = readSrc('src/components/numeric-entry-page.tsx');
  assert.doesNotMatch(textEntry, /formatSvyrDisplayedLabel/);
  assert.doesNotMatch(numeric, /formatSvyrDisplayedLabel/);
  assert.doesNotMatch(textEntry, /SvyrChoiceItem/);
});

test('shared formatter is the only choice punctuation source', () => {
  const formatter = readSrc('src/lib/svyr-label-presentation.ts');
  assert.match(formatter, /`<\$\{trimmed\}>`/);
  assert.doesNotMatch(formatter, /\(\$\{trimmed\}\)/);
  const choiceItem = readSrc('src/components/svyr-choice-item.tsx');
  assert.match(choiceItem, /formatSvyrDisplayedLabel\(label, 'choice'\)/);
  assert.doesNotMatch(choiceItem, /`<\s*\$\{label\}>/);
});
