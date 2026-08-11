import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTROLLED_PRESENCE_STATUS_OPTIONS,
  defineControlledStatusField,
  isControlledScalarField,
  isControlledStatusField,
  normalizeControlledFactScalarInput,
} from '../src/lib/controlled-fact';
import {
  resolveSvyrDataEntryType,
  SVYR_DATA_ENTRY_TYPES,
  usesSingleChoicePresentation,
} from '../src/lib/data-entry-types';
import { findFieldDefinition } from '../src/lib/field-schema';
import { parseCommand } from '../src/lib/command-parser';
import {
  HEATING_COMPOUND_PATH,
} from '../src/lib/property-energy-heating';
import { mainsServiceFieldPath } from '../src/lib/property-energy-mains-services';
import { SURVEY_OPERATIONS } from '../src/lib/survey-operations';

test('controlled status fields resolve to data entry type 4', () => {
  const field = findFieldDefinition(mainsServiceFieldPath('gas'));
  assert.ok(field);
  assert.equal(isControlledStatusField(field), true);
  assert.equal(isControlledScalarField(field), true);
  assert.equal(resolveSvyrDataEntryType(field!), SVYR_DATA_ENTRY_TYPES.controlledFact);
  assert.equal(usesSingleChoicePresentation(field), true);
});

test('controlled status uses schema options rather than field-id hardcoding', () => {
  const customField = defineControlledStatusField({
    path: ['__harness', 'quality'],
    token: 'quality',
    label: 'Quality',
    description: 'Harness controlled vocabulary.',
    fieldId: 'harness.quality',
    options: [
      { value: 'good', label: 'Good' },
      { value: 'fair', label: 'Fair' },
      { value: 'poor', label: 'Poor' },
      { value: 'unknown', label: 'Unknown' },
    ],
  });

  assert.equal(normalizeControlledFactScalarInput(customField, 'Fair'), 'fair');
  assert.equal(normalizeControlledFactScalarInput(customField, 'maybe'), null);
  assert.deepEqual(customField.options, [
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
    { value: 'unknown', label: 'Unknown' },
  ]);
});

test('unset remains distinct from explicit controlled status values', () => {
  const field = findFieldDefinition(mainsServiceFieldPath('water'));
  assert.ok(field);
  assert.equal(normalizeControlledFactScalarInput(field!, ''), null);
  for (const status of CONTROLLED_PRESENCE_STATUS_OPTIONS) {
    assert.equal(
      normalizeControlledFactScalarInput(field!, status.value),
      status.value,
    );
  }
});

test('controlled scalar command parsing includes fieldId for heating singleSelect facts', () => {
  const parsed = parseCommand('property/energy/heating/system-type gas_boiler');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  assert.equal(parsed.operation.operationId, SURVEY_OPERATIONS.setControlledFact);
  assert.equal(
    parsed.operation.arguments.fieldId,
    'property.energy.heating.system_type',
  );
  assert.equal(parsed.operation.arguments.value, 'gas_boiler');
});

test('controlled scalar read parsing includes fieldId for heating text facts', () => {
  const parsed = parseCommand('property/energy/heating/defects');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  assert.equal(parsed.operation.operationId, SURVEY_OPERATIONS.readControlledFact);
  assert.equal(
    parsed.operation.arguments.fieldId,
    'property.energy.heating.defects',
  );
});

test('mains presence vocabulary remains the shared controlled status set', () => {
  const field = findFieldDefinition(mainsServiceFieldPath('electricity'));
  assert.ok(field);
  assert.deepEqual(field?.options, [...CONTROLLED_PRESENCE_STATUS_OPTIONS]);
});
