import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getCommandAssistance, parseCommand } from '../src/lib/command-parser';
import { findCommandNode } from '../src/lib/command-registry';
import {
  findFieldDefinition,
  normalizeFieldInputValue,
} from '../src/lib/field-schema';
import { buildMultiChoiceSuggestions } from '../src/lib/multi-choice';
import { HEATING_COMPOUND_PATH } from '../src/lib/property-energy-heating';
import { SERVICES_PRESENCE_ROUTES } from '../src/lib/services-controlled-facts';
import { buildSingleChoiceSuggestions } from '../src/lib/single-choice';
import {
  formatSvyrDisplayedLabel,
  resolveSvyrNodeLabelPresentation,
  resolveSvyrTokenLabelPresentation,
  SVYR_LABEL_DELIMITERS,
} from '../src/lib/svyr-label-presentation';
import { navigationItemsFromSuggestions } from '../src/lib/svyr-navigation';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function displayedItems(commandSuffix: string) {
  return navigationItemsFromSuggestions(getCommandAssistance(commandSuffix)).map(
    (item) => ({
      label: item.label,
      presentation: item.presentation ?? 'navigation',
      displayed: formatSvyrDisplayedLabel(
        item.label,
        item.presentation ?? 'navigation',
      ),
    }),
  );
}

test('NAVIGATION: services + navigation → [services]', () => {
  assert.equal(formatSvyrDisplayedLabel('services', 'navigation'), '[services]');
});

test('ENTRY: observation + entry → (observation)', () => {
  assert.equal(formatSvyrDisplayedLabel('observation', 'entry'), '(observation)');
});

test('CHOICE: Present + choice → <Present>', () => {
  assert.equal(formatSvyrDisplayedLabel('Present', 'choice'), '<Present>');
});

test('EMPTY/EDGE LABEL: blank labels stay blank', () => {
  assert.equal(formatSvyrDisplayedLabel('', 'navigation'), '');
  assert.equal(formatSvyrDisplayedLabel('   ', 'entry'), '');
  assert.equal(formatSvyrDisplayedLabel(' Present ', 'choice'), '<Present>');
});

test('ROOT CONTAINER: services remains square-bracketed', () => {
  const root = displayedItems('');
  const services = root.find((item) => item.label === 'services');
  assert.ok(services);
  assert.equal(services.presentation, 'navigation');
  assert.equal(services.displayed, '[services]');
});

test('SERVICES CONTAINER: children that open menus remain [label]', () => {
  const services = displayedItems('services');
  const electricity = services.find((item) => item.label === 'electricity');
  const gasOil = services.find((item) => item.label === 'gas-oil');
  assert.ok(electricity);
  assert.ok(gasOil);
  assert.equal(electricity.displayed, '[electricity]');
  assert.equal(gasOil.displayed, '[gas-oil]');
});

test('FINDING LEAF: observation destination uses entry parentheses', () => {
  const node = findCommandNode(['services', 'electricity', 'observe']);
  assert.ok(node);
  assert.equal(node!.label, 'observation');
  assert.equal(resolveSvyrNodeLabelPresentation(node!), 'entry');
  assert.equal(formatSvyrDisplayedLabel(node!.label, 'entry'), '(observation)');
});

test('CONTROLLED-FIELD LEAF: presence uses entry parentheses', () => {
  const node = findCommandNode(['services', 'electricity', 'presence']);
  assert.ok(node);
  assert.equal(resolveSvyrNodeLabelPresentation(node!), 'entry');
  assert.equal(
    formatSvyrDisplayedLabel('Mains electricity presence', 'entry'),
    '(Mains electricity presence)',
  );
});

test('services/electricity screen presents capture leaves with parentheses', () => {
  const items = displayedItems('services/electricity');
  assert.deepEqual(
    items.map((item) => item.displayed),
    [
      '(Mains electricity presence)',
      '(observation)',
      '(defect)',
      '(recommendation)',
      '(Add photo)',
    ],
  );
});

test('CHOICE values remain angle-bracketed', () => {
  assert.equal(formatSvyrDisplayedLabel('Present', 'choice'), '<Present>');
  assert.equal(formatSvyrDisplayedLabel('Unknown', 'choice'), '<Unknown>');
  assert.notEqual(formatSvyrDisplayedLabel('Present', 'choice'), '(Present)');
  assert.notEqual(formatSvyrDisplayedLabel('Present', 'choice'), '[Present]');
});

test('TEXT ENTRY: command uses entry punctuation; entered text stays plain', () => {
  assert.equal(formatSvyrDisplayedLabel('observation', 'entry'), '(observation)');
  const freeText = 'Consumer unit located beneath stairs.';
  assert.equal(freeText.includes('('), false);
  assert.equal(freeText.includes('<'), false);
  const textEntry = readSrc('src/components/text-entry-page.tsx');
  assert.doesNotMatch(textEntry, /formatSvyrDisplayedLabel/);
});

test('COMPOUND CAPTURE: direct capture destinations use entry parentheses', () => {
  const energy = displayedItems('property/energy');
  const heating = energy.find((item) => item.label === 'heating');
  const mains = energy.find((item) => item.label === 'mains-services');
  assert.ok(heating);
  assert.ok(mains);
  assert.equal(heating.displayed, '(heating)');
  assert.equal(mains.displayed, '(mains-services)');
});

test('BLOCKED ROUTE: workflow-only leaves stay navigation brackets', () => {
  const services = displayedItems('services');
  const limitation = services.find((item) => item.label === 'limitation');
  const common = services.find((item) => item.label === 'common');
  assert.ok(limitation);
  assert.ok(common);
  assert.equal(limitation.presentation, 'navigation');
  assert.equal(limitation.displayed, '[limitation]');
  assert.equal(common.displayed, '[common]');

  const oilNode = findCommandNode(['services', 'gas-oil', 'oil']);
  assert.ok(oilNode?.workflowOnly);
  assert.equal(resolveSvyrNodeLabelPresentation(oilNode!), 'navigation');
});

test('token classification matches node classification for electricity leaves', () => {
  const suggestions = getCommandAssistance('services/electricity');
  for (const suggestion of suggestions) {
    if (suggestion.type !== 'token') continue;
    const node = findCommandNode(suggestion.commandPath);
    assert.ok(node);
    assert.equal(
      resolveSvyrTokenLabelPresentation(suggestion),
      resolveSvyrNodeLabelPresentation(node!),
    );
  }
});

test('SELECTED STATE: selected choice remains angle-bracketed', () => {
  assert.equal(formatSvyrDisplayedLabel('Present', 'choice'), '<Present>');
});

test('GROUPED CAPTURE ROWS: field rows use entry parentheses', () => {
  const groupPage = readSrc('src/components/controlled-group-entry-page.tsx');
  assert.match(groupPage, /formatSvyrDisplayedLabel\(row\.field\.label, 'entry'\)/);
  assert.equal(formatSvyrDisplayedLabel('Gas', 'entry'), '(Gas)');
});

test('MULTI-COMMIT ACTION: done uses entry parentheses', () => {
  assert.equal(formatSvyrDisplayedLabel('done', 'entry'), '(done)');
  const autocomplete = readSrc('src/components/autocomplete-area.tsx');
  assert.match(autocomplete, /type === 'multi-commit'/);
  assert.match(autocomplete, /presentation: 'entry'/);
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
});

test('multi-choice option labels still use angle brackets at render time', () => {
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

test('shared formatter owns all three punctuation forms via central delimiters', () => {
  const formatter = readSrc('src/lib/svyr-label-presentation.ts');
  assert.match(formatter, /export const SVYR_LABEL_DELIMITERS/);
  assert.match(formatter, /SVYR_LABEL_DELIMITERS\[presentation\]/);
  assert.doesNotMatch(formatter, /`\[\$\{trimmed\}\]`/);
  assert.doesNotMatch(formatter, /`\(\$\{trimmed\}\)`/);
  assert.doesNotMatch(formatter, /`<\$\{trimmed\}>`/);

  assert.deepEqual(SVYR_LABEL_DELIMITERS.navigation, { open: '[', close: ']' });
  assert.deepEqual(SVYR_LABEL_DELIMITERS.entry, { open: '(', close: ')' });
  assert.deepEqual(SVYR_LABEL_DELIMITERS.choice, { open: '<', close: '>' });

  for (const presentation of ['navigation', 'entry', 'choice'] as const) {
    const { open, close } = SVYR_LABEL_DELIMITERS[presentation];
    assert.equal(
      formatSvyrDisplayedLabel('sample', presentation),
      `${open}sample${close}`,
    );
  }

  const nav = readSrc('src/components/svyr-navigation-item.tsx');
  const choice = readSrc('src/components/svyr-choice-item.tsx');
  assert.match(nav, /formatSvyrDisplayedLabel\(label, presentation\)/);
  assert.match(choice, /formatSvyrDisplayedLabel\(label, 'choice'\)/);
  assert.doesNotMatch(nav, /`\[\$\{label\}\]`/);
  assert.doesNotMatch(choice, /`<\s*\$\{label\}>/);
});

test('delimiter config is the single presentation punctuation source', () => {
  const sources = [
    'src/components/svyr-navigation-item.tsx',
    'src/components/svyr-choice-item.tsx',
    'src/components/autocomplete-area.tsx',
    'src/components/controlled-group-entry-page.tsx',
  ];
  for (const relative of sources) {
    const source = readSrc(relative);
    assert.doesNotMatch(source, /`\[\$\{/);
    assert.doesNotMatch(source, /`\(\$\{/);
    assert.doesNotMatch(source, /`<\$\{/);
  }
});
