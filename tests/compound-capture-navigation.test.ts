import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { HEATING_FIELD_DEFINITIONS } from '../src/lib/property-energy-heating';
import {
  resolveCompoundChildMultiDraft,
  resolveCompoundChildTextDraft,
  stashCompoundChildMultiDraft,
  stashCompoundChildTextDraft,
} from '../src/lib/compound-child-navigation';
import { executeSurveyOperation } from '../src/lib/survey-operations';
import {
  readEntryDraft,
  readMultiChoiceEntryDraft,
  type SvyrEntryDraftsByPath,
} from '../src/lib/svyr-entry-drafts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFECTS_PATH = ['property', 'energy', 'heating', 'defects'] as const;
const EMITTERS_PATH = ['property', 'energy', 'heating', 'heat-emitters'] as const;

function emptyBrief() {
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
    controlledFacts: {} as Record<string, string>,
    controlledFactSets: {} as Record<string, readonly string[]>,
  };
}

type CompoundUiState = {
  activeFieldPath: string[] | null;
  textDraft: string;
  multiDraft: readonly string[];
  draftsByPath: SvyrEntryDraftsByPath;
  brief: ReturnType<typeof emptyBrief>;
};

function navigateBackFromCompoundChild(state: CompoundUiState): CompoundUiState {
  if (!state.activeFieldPath) return state;
  const path = state.activeFieldPath;
  const field = HEATING_FIELD_DEFINITIONS.find(
    (definition) => definition.path.join('/') === path.join('/'),
  );
  if (!field) return state;

  let draftsByPath = state.draftsByPath;
  if (field.valueType === 'text' || field.valueType === 'number') {
    draftsByPath = stashCompoundChildTextDraft(
      draftsByPath,
      path,
      state.textDraft,
    );
  } else if (field.valueType === 'multiSelect') {
    draftsByPath = stashCompoundChildMultiDraft(
      draftsByPath,
      path,
      state.multiDraft,
    );
  }

  return {
    ...state,
    activeFieldPath: null,
    textDraft: '',
    multiDraft: [],
    draftsByPath,
  };
}

function openCompoundChild(
  state: CompoundUiState,
  path: readonly string[],
): CompoundUiState {
  const field = HEATING_FIELD_DEFINITIONS.find(
    (definition) => definition.path.join('/') === path.join('/'),
  );
  assert.ok(field);

  if (field.valueType === 'text' || field.valueType === 'number') {
    return {
      ...state,
      activeFieldPath: [...path],
      textDraft: resolveCompoundChildTextDraft(
        state.draftsByPath,
        [...path],
        state.brief.controlledFacts?.[field.fieldId] ?? null,
      ),
    };
  }

  if (field.valueType === 'multiSelect') {
    return {
      ...state,
      activeFieldPath: [...path],
      multiDraft: resolveCompoundChildMultiDraft(
        state.draftsByPath,
        [...path],
        state.brief.controlledFactSets?.[field.fieldId] ?? [],
      ),
    };
  }

  return { ...state, activeFieldPath: [...path] };
}

test('compound child swipe-back stashes text draft and returns to group list', () => {
  let state: CompoundUiState = {
    activeFieldPath: null,
    textDraft: '',
    multiDraft: [],
    draftsByPath: {},
    brief: emptyBrief(),
  };

  state = openCompoundChild(state, DEFECTS_PATH);
  state = { ...state, textDraft: 'Uncommitted heating defect note' };
  assert.deepEqual(state.activeFieldPath, [...DEFECTS_PATH]);

  state = navigateBackFromCompoundChild(state);

  assert.equal(state.activeFieldPath, null);
  assert.equal(state.textDraft, '');
  assert.equal(
    readEntryDraft(state.draftsByPath, [...DEFECTS_PATH]),
    'Uncommitted heating defect note',
  );
  assert.equal(state.brief.controlledFacts?.['property.energy.heating.defects'], undefined);
});

test('reopening compound child restores stashed draft without canonical write', () => {
  let state: CompoundUiState = {
    activeFieldPath: null,
    textDraft: '',
    multiDraft: [],
    draftsByPath: {},
    brief: emptyBrief(),
  };

  state = openCompoundChild(state, DEFECTS_PATH);
  state = { ...state, textDraft: 'Draft only' };
  state = navigateBackFromCompoundChild(state);
  state = openCompoundChild(state, DEFECTS_PATH);

  assert.equal(state.textDraft, 'Draft only');
  assert.equal(state.brief.controlledFacts?.['property.energy.heating.defects'], undefined);
});

test('compound child commit still persists through canonical Engine path', () => {
  const defectsField = HEATING_FIELD_DEFINITIONS.find(
    (field) => field.fieldId === 'property.energy.heating.defects',
  );
  assert.ok(defectsField?.operationId);

  const committed = executeSurveyOperation(emptyBrief(), {
    operationId: defectsField.operationId,
    arguments: {
      fieldId: defectsField.fieldId,
      value: 'Corroded flue',
    },
  });
  assert.ok(committed);
  assert.equal(
    committed.brief.controlledFacts?.['property.energy.heating.defects'],
    'Corroded flue',
  );
});

test('compound child multi-select draft survives child-level back', () => {
  let state: CompoundUiState = {
    activeFieldPath: null,
    textDraft: '',
    multiDraft: [],
    draftsByPath: {},
    brief: emptyBrief(),
  };

  state = openCompoundChild(state, EMITTERS_PATH);
  state = { ...state, multiDraft: ['radiators'] };
  state = navigateBackFromCompoundChild(state);
  state = openCompoundChild(state, EMITTERS_PATH);

  assert.deepEqual(state.multiDraft, ['radiators']);
  assert.equal(
    state.brief.controlledFactSets?.['property.energy.heating.heat_emitters'],
    undefined,
  );
});

test('group-level compound exit wiring remains cancelCurrentInteraction', () => {
  const workspace = readFileSync(
    path.join(repoRoot, 'src/components/svyr-interface.tsx'),
    'utf8',
  );
  assert.match(workspace, /onNavigateUpDirectory=\{controller\.cancelCurrentInteraction\}/);
});

test('compound child swipe routes through compound navigation before cancelCurrentInteraction', () => {
  const workspace = readFileSync(
    path.join(repoRoot, 'src/components/svyr-interface.tsx'),
    'utf8',
  );
  assert.match(workspace, /compoundChildNavigation\?\.isChildActive/);
  assert.match(workspace, /navigateBackFromChild\(\)/);
  assert.match(workspace, /onNavigationChange=\{setCompoundChildNavigation\}/);
});

test('ordinary entry swipe-back still uses cancelCurrentInteraction when no compound child is active', () => {
  const workspace = readFileSync(
    path.join(repoRoot, 'src/components/svyr-interface.tsx'),
    'utf8',
  );
  assert.match(workspace, /return controller\.cancelCurrentInteraction\(\)/);
  assert.doesNotMatch(
    workspace,
    /onNavigateBack: controller\.cancelCurrentInteraction/,
  );
});
