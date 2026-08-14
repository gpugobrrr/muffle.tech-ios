import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { FieldDefinition } from '../src/lib/field-schema';
import { allFieldDefinitions } from '../src/lib/field-schema';
import {
  buildMultiChoiceSuggestions,
  normalizeMultiChoiceValues,
  orderMultiChoiceValues,
  prepareMultiChoiceCommit,
  toggleMultiChoiceValue,
} from '../src/lib/multi-choice';
import { buildSingleChoiceSuggestions } from '../src/lib/single-choice';
import {
  clearEntryDraft,
  readEntryDraft,
  readMultiChoiceEntryDraft,
  stashEntryDraft,
  stashMultiChoiceEntryDraft,
} from '../src/lib/svyr-entry-drafts';
import { resolveSvyrBarSegmentTarget } from '../src/lib/svyr-bar-navigation';
import type { InspectionBrief } from '../src/types/workspace';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createBrief(): InspectionBrief {
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

/** Synthetic schema field for harness-only multi-choice coverage. */
function harnessMultiChoiceField(): FieldDefinition {
  return {
    kind: 'field',
    path: ['__harness', 'materials'],
    pathKey: '__harness/materials',
    token: 'materials',
    label: 'Materials',
    description: 'Harness-only multi-choice field.',
    fieldId: 'harness.materials',
    valueType: 'multiSelect',
    options: [
      { value: 'brick', label: 'brick' },
      { value: 'stone', label: 'stone' },
      { value: 'render', label: 'render' },
      { value: 'timber', label: 'timber' },
      { value: 'cladding', label: 'cladding' },
      { value: 'other', label: 'other' },
    ],
  };
}

test('multi-choice suggestions derive only from the field schema', () => {
  const field = harnessMultiChoiceField();
  const suggestions = buildMultiChoiceSuggestions(field, ['render']);
  const options = suggestions.filter((item) => item.type === 'choice');
  assert.deepEqual(
    options.map((item) => item.canonicalValue),
    field.options?.map((option) => option.value),
  );
  assert.equal(
    options.find((item) => item.canonicalValue === 'render')?.selected,
    true,
  );
  assert.equal(
    suggestions.some((item) => item.type === 'multi-commit' && item.label === 'done'),
    true,
  );
});

test('toggling selects, accumulates, and deselects without mutating the brief', () => {
  const brief = createBrief();
  const before = structuredClone(brief);
  let selected: string[] = [];
  selected = toggleMultiChoiceValue(selected, 'brick');
  selected = toggleMultiChoiceValue(selected, 'render');
  assert.deepEqual(selected, ['brick', 'render']);
  selected = toggleMultiChoiceValue(selected, 'brick');
  assert.deepEqual(selected, ['render']);
  assert.deepEqual(brief, before);
});

test('canonical ordering follows schema option order, not tap order', () => {
  const field = harnessMultiChoiceField();
  assert.deepEqual(
    orderMultiChoiceValues(field, ['timber', 'brick', 'render']),
    ['brick', 'render', 'timber'],
  );
});

test('invalid values cannot be prepared for commit', () => {
  const field = harnessMultiChoiceField();
  assert.equal(normalizeMultiChoiceValues(field, ['brick', 'unlisted']), null);
  const prepared = prepareMultiChoiceCommit(field, ['brick', 'unlisted']);
  assert.equal(prepared.ok, false);
});

test('prepare commit validates the whole set and remains non-writable without Engine arrays', () => {
  const field = harnessMultiChoiceField();
  const prepared = prepareMultiChoiceCommit(field, ['render', 'brick']);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.deepEqual(prepared.values, ['brick', 'render']);
  assert.equal(prepared.engineWritable, false);
});

test('multi-choice drafts are field-scoped and separate from text drafts', () => {
  const materials = ['__harness', 'materials'];
  const party = ['prep', 'brief', 'instr', 'party'];
  let drafts = stashMultiChoiceEntryDraft({}, materials, ['brick', 'render']);
  drafts = stashEntryDraft(drafts, party, 'Smith & Co');
  assert.deepEqual(readMultiChoiceEntryDraft(drafts, materials), [
    'brick',
    'render',
  ]);
  assert.equal(readEntryDraft(drafts, party), 'Smith & Co');
  assert.equal(readMultiChoiceEntryDraft(drafts, party), undefined);
  assert.equal(readEntryDraft(drafts, materials), undefined);

  const target = resolveSvyrBarSegmentTarget(
    ['__harness', 'materials'],
    1,
  );
  assert.deepEqual(target, ['__harness']);
  // Leaving via bar preserves the multi draft map entry.
  assert.deepEqual(readMultiChoiceEntryDraft(drafts, materials), [
    'brick',
    'render',
  ]);

  drafts = clearEntryDraft(drafts, materials);
  assert.equal(readMultiChoiceEntryDraft(drafts, materials), undefined);
  assert.equal(readEntryDraft(drafts, party), 'Smith & Co');
});

test('registered production multiSelect fields use controlled fact sets', () => {
  const multiFields = allFieldDefinitions().filter(
    (field) => field.valueType === 'multiSelect',
  );
  assert.equal(multiFields.length, 1);
  assert.equal(multiFields[0]?.fieldId, 'property.energy.heating.heat_emitters');
  assert.equal(multiFields[0]?.operationId, 'survey.controlled_fact_set.set');
});

test('UI shell routes multiSelect through MultiChoiceEntryPage and shared SvyrBar', () => {
  const panel = readFileSync(
    path.join(repoRoot, 'src/components/svyr-data-entry-panel.tsx'),
    'utf8',
  );
  const page = readFileSync(
    path.join(repoRoot, 'src/components/multi-choice-entry-page.tsx'),
    'utf8',
  );
  const dock = readFileSync(
    path.join(repoRoot, 'src/components/command-dock.tsx'),
    'utf8',
  );
  const compound = readFileSync(
    path.join(repoRoot, 'src/components/controlled-group-entry-page.tsx'),
    'utf8',
  );
  assert.match(panel, /valueType === 'multiSelect'/);
  assert.match(panel, /MultiChoiceEntryPage/);
  assert.match(compound, /MultiChoiceEntryPage/);
  assert.doesNotMatch(page, /SplitTextKeyboard|TextInput/);
  assert.doesNotMatch(page, /from '@\/components\/(?:svyr-bar|workspace-terminal)'/);
  assert.match(dock, /<SvyrBar/);
});

test('single-choice remains independent of multi-choice capture', () => {
  const sourceField = allFieldDefinitions().find(
    (field) => field.pathKey === 'prep/brief/instr/source',
  );
  assert.ok(sourceField);
  assert.equal(sourceField?.valueType, 'singleSelect');

  const suggestions = buildSingleChoiceSuggestions(sourceField!, 'email');
  assert.ok(suggestions.some((item) => item.canonicalValue === 'email'));

  const single = readFileSync(
    path.join(repoRoot, 'src/lib/single-choice.ts'),
    'utf8',
  );
  assert.match(single, /usesSingleChoicePresentation/);
  assert.doesNotMatch(
    single,
    /multiSelect|toggleMultiChoiceValue|prepareMultiChoiceCommit/,
  );
});
