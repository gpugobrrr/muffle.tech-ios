import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  allFieldDefinitions,
  normalizeFieldInputValue,
  type FieldDefinition,
} from '../src/lib/field-schema';
import {
  normalizeNumericFieldInput,
  prepareNumericCommit,
} from '../src/lib/numeric-field';
import {
  clearEntryDraft,
  readEntryDraft,
  stashEntryDraft,
} from '../src/lib/svyr-entry-drafts';
import {
  resolveSvyrBarRootTarget,
  resolveSvyrBarSegmentTarget,
} from '../src/lib/svyr-bar-navigation';
import { resolveDirectoryCompletion } from '../src/lib/completion';
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

/** Synthetic schema field — no production binding. */
function harnessIntegerYearField(): FieldDefinition {
  return {
    kind: 'field',
    path: ['__harness', 'year-built'],
    pathKey: '__harness/year-built',
    token: 'year-built',
    label: 'Year built',
    description: 'Harness-only integer year.',
    fieldId: 'harness.yearBuilt',
    valueType: 'number',
    numeric: {
      integer: true,
      min: 1600,
      max: 2100,
    },
  };
}

function harnessDecimalMoistureField(): FieldDefinition {
  return {
    kind: 'field',
    path: ['__harness', 'moisture'],
    pathKey: '__harness/moisture',
    token: 'moisture',
    label: 'Moisture',
    description: 'Harness-only fixed-unit decimal.',
    fieldId: 'harness.moisture',
    valueType: 'number',
    numeric: {
      min: 0,
      max: 100,
      maxFractionDigits: 1,
      displayUnit: '%',
    },
  };
}

test('numeric fields normalize to deterministic scalar strings', () => {
  const year = harnessIntegerYearField();
  assert.equal(normalizeNumericFieldInput(year, '1935'), '1935');
  assert.equal(normalizeNumericFieldInput(year, '001935'), '1935');
  assert.equal(normalizeFieldInputValue(year, '1935'), '1935');
});

test('invalid numeric drafts are rejected without silent coercion', () => {
  const year = harnessIntegerYearField();
  const moisture = harnessDecimalMoistureField();
  assert.equal(normalizeNumericFieldInput(year, '12..5'), null);
  assert.equal(normalizeNumericFieldInput(year, 'abc12'), null);
  assert.equal(normalizeNumericFieldInput(year, '1935.5'), null);
  assert.equal(normalizeNumericFieldInput(year, '-10'), null);
  assert.equal(normalizeNumericFieldInput(year, '1500'), null);
  assert.equal(normalizeNumericFieldInput(moisture, '12.45'), null);
  assert.equal(normalizeNumericFieldInput(moisture, '18%'), null);
  assert.equal(normalizeNumericFieldInput(moisture, '18 %'), null);
});

test('decimal fields preserve fractional digits without locale commas', () => {
  const moisture = harnessDecimalMoistureField();
  assert.equal(normalizeNumericFieldInput(moisture, '18'), '18');
  assert.equal(normalizeNumericFieldInput(moisture, '18.0'), '18.0');
  assert.equal(normalizeNumericFieldInput(moisture, '4.2'), '4.2');
  assert.equal(normalizeNumericFieldInput(moisture, '18,5'), null);
});

test('min/max and integer constraints are enforced before commit preparation', () => {
  const year = harnessIntegerYearField();
  assert.equal(prepareNumericCommit(year, '1935').ok, true);
  assert.equal(prepareNumericCommit(year, '1935.0').ok, false);
  assert.equal(prepareNumericCommit(year, '2200').ok, false);
  const prepared = prepareNumericCommit(year, '1935');
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.value, '1935');
  assert.equal(prepared.engineWritable, false);
});

test('fixed displayUnit is not part of the raw draft or canonical scalar', () => {
  const moisture = harnessDecimalMoistureField();
  assert.equal(moisture.numeric?.displayUnit, '%');
  assert.equal(normalizeNumericFieldInput(moisture, '18'), '18');
  assert.notEqual(normalizeNumericFieldInput(moisture, '18'), '18%');
  assert.notEqual(normalizeNumericFieldInput(moisture, '18'), '18 %');
  const page = readFileSync(
    path.join(repoRoot, 'src/components/numeric-entry-page.tsx'),
    'utf8',
  );
  assert.match(page, /displayUnit=\{fieldDefinition\.numeric\?\.displayUnit/);
  assert.doesNotMatch(page, /\$\{.*displayUnit|displayUnit \+/);
});

test('raw numeric drafts are field-scoped text drafts and survive SVYR navigation', () => {
  const yearPath = ['__harness', 'year-built'];
  const partyPath = ['prep', 'brief', 'instr', 'party'];
  let drafts = stashEntryDraft({}, yearPath, '19');
  drafts = stashEntryDraft(drafts, partyPath, 'Smith & Co');
  assert.equal(readEntryDraft(drafts, yearPath), '19');
  assert.equal(readEntryDraft(drafts, partyPath), 'Smith & Co');

  // Intermediate typing state with a trailing decimal remains raw text.
  drafts = stashEntryDraft(drafts, ['__harness', 'moisture'], '1.');
  assert.equal(readEntryDraft(drafts, ['__harness', 'moisture']), '1.');

  const finalBack = resolveSvyrBarSegmentTarget(yearPath, 1);
  assert.deepEqual(finalBack, ['__harness']);
  assert.equal(readEntryDraft(drafts, yearPath), '19');

  const earlier = resolveSvyrBarSegmentTarget(
    ['prep', 'brief', 'instr', 'party'],
    1,
  );
  assert.deepEqual(earlier, ['prep', 'brief']);
  assert.equal(readEntryDraft(drafts, partyPath), 'Smith & Co');

  const root = resolveSvyrBarRootTarget(yearPath);
  assert.deepEqual(root, []);
  assert.equal(readEntryDraft(drafts, yearPath), '19');

  drafts = clearEntryDraft(drafts, yearPath);
  assert.equal(readEntryDraft(drafts, yearPath), undefined);
  assert.equal(readEntryDraft(drafts, partyPath), 'Smith & Co');
});

test('opening or typing a numeric draft does not alter completion', () => {
  const brief = createBrief();
  const before = resolveDirectoryCompletion(['prep', 'brief', 'instr'], brief);
  const drafts = stashEntryDraft({}, ['__harness', 'year-built'], '1935');
  assert.equal(readEntryDraft(drafts, ['__harness', 'year-built']), '1935');
  const after = resolveDirectoryCompletion(['prep', 'brief', 'instr'], brief);
  assert.deepEqual(after, before);
});

test('no production field is bound to number; multiSelect remains unbound', () => {
  assert.equal(
    allFieldDefinitions().some((field) => field.valueType === 'number'),
    false,
  );
  assert.equal(
    allFieldDefinitions().some((field) => field.valueType === 'multiSelect'),
    false,
  );
});

test('UI routes number through NumericEntryPage with split keyboard numeric layer', () => {
  const panel = readFileSync(
    path.join(repoRoot, 'src/components/svyr-data-entry-panel.tsx'),
    'utf8',
  );
  const page = readFileSync(
    path.join(repoRoot, 'src/components/numeric-entry-page.tsx'),
    'utf8',
  );
  const textPage = readFileSync(
    path.join(repoRoot, 'src/components/text-entry-page.tsx'),
    'utf8',
  );
  const keyboard = readFileSync(
    path.join(repoRoot, 'src/components/split-text-keyboard.tsx'),
    'utf8',
  );
  const dock = readFileSync(
    path.join(repoRoot, 'src/components/command-dock.tsx'),
    'utf8',
  );

  assert.match(panel, /valueType === 'number'/);
  assert.match(panel, /NumericEntryPage/);
  assert.match(page, /initialKeyboardMode="numeric"/);
  assert.match(page, /TextEntryPage/);
  assert.match(textPage, /SplitTextKeyboard/);
  assert.match(textPage, /showSoftInputOnFocus=\{isLaptopPresentation\}/);
  assert.match(textPage, /initialMode=\{initialKeyboardMode\}/);
  assert.match(keyboard, /initialMode/);
  assert.match(keyboard, /NUMERIC_LEFT_ROWS/);
  assert.doesNotMatch(page, /keyboardType|Spinner|Slider/);
  assert.doesNotMatch(page, /from '@\/components\/(?:svyr-bar|workspace-terminal)'/);
  assert.match(dock, /<SvyrBar/);
  assert.equal((dock.match(/<SvyrBar/g) ?? []).length, 1);
});

test('no structured measurement encoding or number\+unit string hacks', () => {
  const numericLib = readFileSync(
    path.join(repoRoot, 'src/lib/numeric-field.ts'),
    'utf8',
  );
  const schema = readFileSync(
    path.join(repoRoot, 'src/lib/field-schema.ts'),
    'utf8',
  );
  assert.doesNotMatch(numericLib, /JSON\.stringify|value, unit|value:\s*unit/);
  assert.match(schema, /Structured measurements/);
  assert.doesNotMatch(schema, /"\$\{.*\} m"|`\$\{.*\}%`/);
});

test('text and single-choice production fields remain unchanged', () => {
  const party = allFieldDefinitions().find(
    (field) => field.pathKey === 'prep/brief/instr/party',
  );
  const source = allFieldDefinitions().find(
    (field) => field.pathKey === 'prep/brief/instr/source',
  );
  assert.equal(party?.valueType === 'number', false);
  assert.equal(source?.valueType, 'singleSelect');
});

test('multi-choice production guard source remains engineWritable false', () => {
  const multi = readFileSync(
    path.join(repoRoot, 'src/lib/multi-choice.ts'),
    'utf8',
  );
  assert.match(multi, /engineWritable:\s*false/);
});
