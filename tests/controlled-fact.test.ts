import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CONTROLLED_PRESENCE_STATUSES,
  normalizeControlledStatusInput,
} from '../src/lib/controlled-fact';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import { findCommandNode } from '../src/lib/command-registry';
import { parseCommand } from '../src/lib/command-parser';
import {
  applyFieldValue,
  findFieldDefinition,
  findFieldDefinitionByFieldId,
  resolveFieldSetValue,
  resolveFieldValue,
} from '../src/lib/field-schema';
import { prepareMultiChoiceCommit } from '../src/lib/multi-choice';
import {
  HEATING_COMPOUND_PATH,
  HEATING_FIELD_DEFINITIONS,
} from '../src/lib/property-energy-heating';
import {
  MAINS_SERVICE_FIELD_IDS,
  MAINS_SERVICES_COMPOUND_PATH,
  mainsServiceFieldPath,
} from '../src/lib/property-energy-mains-services';
import {
  executeSurveyOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
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

test('registered controlled status field accepts allowed canonical options', () => {
  const field = findFieldDefinition(mainsServiceFieldPath('gas'));
  assert.ok(field);
  assert.equal(field?.valueType, 'controlledStatus');
  assert.equal(normalizeControlledStatusInput(field!, 'present'), 'present');
  assert.equal(normalizeControlledStatusInput(field!, 'Not inspected'), 'not_inspected');
});

test('invalid controlled values are rejected by validation', () => {
  const field = findFieldDefinition(mainsServiceFieldPath('gas'));
  assert.ok(field);
  assert.equal(normalizeControlledStatusInput(field!, 'maybe'), null);
  assert.equal(normalizeControlledStatusInput(field!, ''), null);
});

test('controlled fact write produces the generic Engine operation', () => {
  const field = findFieldDefinition(mainsServiceFieldPath('electricity'));
  assert.ok(field);
  const parsed = parseCommand('property/energy/mains-services/electricity present');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  assert.equal(parsed.operation.operationId, SURVEY_OPERATIONS.setControlledFact);
  assert.equal(parsed.operation.arguments.fieldId, field!.fieldId);
  assert.equal(parsed.operation.arguments.value, 'present');
});

test('Engine apply and resolve update canonical controlledFacts storage', () => {
  const field = findFieldDefinition(mainsServiceFieldPath('water'));
  assert.ok(field);
  const result = executeSurveyOperation(createBrief(), {
    operationId: SURVEY_OPERATIONS.setControlledFact,
    arguments: {
      fieldId: field!.fieldId,
      value: 'unknown',
    },
  });
  assert.ok(result);
  assert.equal(result?.brief.controlledFacts?.[field!.fieldId], 'unknown');
  assert.equal(resolveFieldValue(result!.brief, field!.fieldId), 'unknown');
});

test('independent service updates do not overwrite each other', () => {
  let brief = createBrief();
  for (const service of ['gas', 'drainage'] as const) {
    const field = findFieldDefinition(mainsServiceFieldPath(service));
    assert.ok(field);
    const result = executeSurveyOperation(brief, {
      operationId: SURVEY_OPERATIONS.setControlledFact,
      arguments: {
        fieldId: field!.fieldId,
        value: service === 'gas' ? 'present' : 'not_present',
      },
    });
    assert.ok(result);
    brief = result!.brief;
  }
  assert.equal(
    resolveFieldValue(brief, MAINS_SERVICE_FIELD_IDS.gas),
    'present',
  );
  assert.equal(
    resolveFieldValue(brief, MAINS_SERVICE_FIELD_IDS.drainage),
    'not_present',
  );
  assert.equal(resolveFieldValue(brief, MAINS_SERVICE_FIELD_IDS.electricity), null);
});

test('unknown field IDs cannot be written through the generic operation', () => {
  const result = executeSurveyOperation(createBrief(), {
    operationId: SURVEY_OPERATIONS.setControlledFact,
    arguments: {
      fieldId: 'property.energy.mains_services.unlisted',
      value: 'present',
    },
  });
  assert.equal(result, null);
});

test('registered controlled set fields prepare deterministic Engine writes', () => {
  const field: NonNullable<ReturnType<typeof findFieldDefinition>> = {
    kind: 'field',
    path: ['__harness', 'materials'],
    pathKey: '__harness/materials',
    token: 'materials',
    label: 'Materials',
    description: 'Harness set field.',
    fieldId: 'harness.materials',
    valueType: 'multiSelect',
    options: [
      { value: 'brick', label: 'brick' },
      { value: 'stone', label: 'stone' },
      { value: 'render', label: 'render' },
    ],
    operationId: SURVEY_OPERATIONS.setControlledFactSet,
    readOperationId: SURVEY_OPERATIONS.readControlledFactSet,
  };

  const prepared = prepareMultiChoiceCommit(field, ['render', 'brick']);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.engineWritable, true);
  assert.deepEqual(prepared.values, ['brick', 'render']);
});

test('unregistered controlled set field IDs cannot be written', () => {
  const result = executeSurveyOperation(createBrief(), {
    operationId: SURVEY_OPERATIONS.setControlledFactSet,
    arguments: {
      fieldId: 'harness.materials',
      values: ['brick'],
    },
  });
  assert.equal(result, null);
});

test('populated controlled status contributes to central completion', () => {
  let brief = createBrief();
  const gas = findFieldDefinition(mainsServiceFieldPath('gas'));
  assert.ok(gas);
  brief = applyFieldValue(brief, gas!.fieldId, 'present');
  const completion = resolveDirectoryCompletion(
    [...MAINS_SERVICES_COMPOUND_PATH],
    brief,
  );
  const gasRow = completion?.children.find((child) => child.token === 'gas');
  assert.ok(gasRow);
  assert.equal(gasRow?.completed, 1);
  assert.equal(gasRow?.total, 1);
});

test('mains-services route is compound capture rather than workflow-only fallback', () => {
  const node = findCommandNode([...MAINS_SERVICES_COMPOUND_PATH]);
  assert.ok(node);
  assert.equal(node?.compoundCapture, true);
  assert.equal(node?.workflowOnly, undefined);
  assert.deepEqual(
    node?.children?.map((child) => child.token),
    ['gas', 'electricity', 'water', 'drainage'],
  );
  assert.equal(
    findFieldDefinitionByFieldId(MAINS_SERVICE_FIELD_IDS.gas)?.valueType,
    'controlledStatus',
  );
});

test('heating route is compound capture with mixed field types', () => {
  const node = findCommandNode([...HEATING_COMPOUND_PATH]);
  assert.ok(node);
  assert.equal(node?.compoundCapture, true);
  assert.equal(node?.workflowOnly, undefined);
  assert.deepEqual(
    node?.children?.map((child) => child.token),
    HEATING_FIELD_DEFINITIONS.map((field) => field.token),
  );

  const systemType = findFieldDefinition([
    ...HEATING_COMPOUND_PATH,
    'system-type',
  ]);
  assert.equal(systemType?.required, true);
  assert.equal(systemType?.valueType, 'singleSelect');

  const makeModel = findFieldDefinition([
    ...HEATING_COMPOUND_PATH,
    'boiler-make-model',
  ]);
  assert.equal(makeModel?.optional, true);
  assert.equal(makeModel?.valueType, 'text');

  const emitters = findFieldDefinition([
    ...HEATING_COMPOUND_PATH,
    'heat-emitters',
  ]);
  assert.equal(emitters?.valueType, 'multiSelect');
});

test('heating scalar and set writes persist through controlledFacts storage', () => {
  const systemType = findFieldDefinition([
    ...HEATING_COMPOUND_PATH,
    'system-type',
  ]);
  assert.ok(systemType);
  const scalar = executeSurveyOperation(createBrief(), {
    operationId: SURVEY_OPERATIONS.setControlledFact,
    arguments: {
      fieldId: systemType!.fieldId,
      value: 'gas_boiler',
    },
  });
  assert.ok(scalar);
  assert.equal(
    resolveFieldValue(scalar!.brief, systemType!.fieldId),
    'gas_boiler',
  );

  const emitters = findFieldDefinition([
    ...HEATING_COMPOUND_PATH,
    'heat-emitters',
  ]);
  assert.ok(emitters);
  const setWrite = executeSurveyOperation(scalar!.brief, {
    operationId: SURVEY_OPERATIONS.setControlledFactSet,
    arguments: {
      fieldId: emitters!.fieldId,
      values: ['radiators', 'underfloor'],
    },
  });
  assert.ok(setWrite);
  assert.deepEqual(
    resolveFieldSetValue(setWrite!.brief, emitters!.fieldId),
    ['radiators', 'underfloor'],
  );
});

test('heating text fields persist as controlledFacts scalars', () => {
  const defects = findFieldDefinition([...HEATING_COMPOUND_PATH, 'defects']);
  assert.ok(defects);
  let brief = createBrief();
  brief = applyFieldValue(brief, defects!.fieldId, 'Corroded flue terminal');
  assert.equal(
    resolveFieldValue(brief, defects!.fieldId),
    'Corroded flue terminal',
  );
});

test('workspace compound capture uses grouped entry page instead of unsupported fallback', () => {
  const workspace = readFileSync(
    path.join(repoRoot, 'src/hooks/use-workspace.ts'),
    'utf8',
  );
  const page = readFileSync(
    path.join(repoRoot, 'src/components/controlled-group-entry-page.tsx'),
    'utf8',
  );
  assert.match(workspace, /compoundCapture/);
  assert.match(workspace, /beginCompoundCapture/);
  assert.match(page, /CompoundCaptureEntryPage/);
  assert.doesNotMatch(page, /CAPTURE NOT YET SUPPORTED/);
});

test('all controlled presence statuses are explicit canonical values', () => {
  assert.deepEqual([...CONTROLLED_PRESENCE_STATUSES], [
    'present',
    'not_present',
    'unknown',
    'not_inspected',
  ]);
});
