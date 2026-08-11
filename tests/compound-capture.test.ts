import assert from 'node:assert/strict';
import test from 'node:test';

import { findCommandNode } from '../src/lib/command-registry';
import {
  compoundCaptureChildren,
  isCompoundCaptureNode,
  resolveCompoundCaptureGroup,
} from '../src/lib/compound-capture';
import { applyFieldValue } from '../src/lib/field-schema';
import {
  resolveSvyrDataEntryType,
  resolveSvyrNodeDataEntryType,
  SVYR_DATA_ENTRY_TYPES,
} from '../src/lib/data-entry-types';
import {
  HEATING_COMPOUND_PATH,
  HEATING_FIELD_DEFINITIONS,
} from '../src/lib/property-energy-heating';
import {
  MAINS_SERVICES_COMPOUND_PATH,
  mainsServiceFieldPath,
} from '../src/lib/property-energy-mains-services';
import type { InspectionBrief } from '../src/types/workspace';

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

test('compound capture nodes resolve to data entry type 5', () => {
  const mains = findCommandNode([...MAINS_SERVICES_COMPOUND_PATH]);
  const heating = findCommandNode([...HEATING_COMPOUND_PATH]);
  assert.ok(mains);
  assert.ok(heating);
  assert.equal(isCompoundCaptureNode(mains), true);
  assert.equal(isCompoundCaptureNode(heating), true);
  assert.equal(
    resolveSvyrNodeDataEntryType(mains!),
    SVYR_DATA_ENTRY_TYPES.compoundGroup,
  );
  assert.equal(
    resolveSvyrNodeDataEntryType(heating!),
    SVYR_DATA_ENTRY_TYPES.compoundGroup,
  );
});

test('compound capture group exposes typed children from schema definitions', () => {
  const group = resolveCompoundCaptureGroup(
    [...MAINS_SERVICES_COMPOUND_PATH],
    createBrief(),
  );
  assert.ok(group);
  assert.equal(group?.path.join('/'), 'property/energy/mains-services');
  assert.equal(group?.children.length, 4);
  assert.deepEqual(
    group?.children.map((child) => child.id),
    [
      'property.energy.mains_services.gas',
      'property.energy.mains_services.electricity',
      'property.energy.mains_services.water',
      'property.energy.mains_services.drainage',
    ],
  );
  for (const child of group!.children) {
    assert.equal(child.fieldId, child.id);
    assert.equal(child.dataEntryType, SVYR_DATA_ENTRY_TYPES.controlledFact);
    assert.equal(child.currentLabel, 'Not recorded');
    assert.equal(child.completed, false);
    assert.equal(child.required, true);
  }
});

test('compound capture aggregate completion is derived from child fields', () => {
  const gas = compoundCaptureChildren(
    [...MAINS_SERVICES_COMPOUND_PATH],
    createBrief(),
  ).find((child) => child.path.at(-1) === 'gas');
  assert.ok(gas);

  let brief = createBrief();
  brief = applyFieldValue(brief, gas!.fieldId, 'present');

  const group = resolveCompoundCaptureGroup(
    [...MAINS_SERVICES_COMPOUND_PATH],
    brief,
  );
  assert.ok(group);
  assert.equal(group?.completed, 1);
  assert.equal(group?.total, 4);
  const gasRow = group?.children.find((child) => child.id === gas!.fieldId);
  assert.equal(gasRow?.currentLabel, 'Present');
  assert.equal(gasRow?.completed, true);
});

test('heating compound capture composes mixed child data-entry types', () => {
  const children = compoundCaptureChildren([...HEATING_COMPOUND_PATH], createBrief());
  assert.equal(children.length, HEATING_FIELD_DEFINITIONS.length);

  const byToken = Object.fromEntries(
    children.map((child) => [child.path.at(-1), child]),
  );

  assert.equal(
    byToken['system-type']?.dataEntryType,
    SVYR_DATA_ENTRY_TYPES.controlledFact,
  );
  assert.equal(
    byToken['boiler-make-model']?.dataEntryType,
    SVYR_DATA_ENTRY_TYPES.controlledFact,
  );
  assert.equal(
    byToken['heat-emitters']?.dataEntryType,
    SVYR_DATA_ENTRY_TYPES.multiChoice,
  );
  assert.equal(
    resolveSvyrDataEntryType(byToken['defects']!.field),
    SVYR_DATA_ENTRY_TYPES.controlledFact,
  );
});

test('compound capture group does not introduce grouped canonical storage', () => {
  const brief = createBrief();
  const group = resolveCompoundCaptureGroup(
    [...MAINS_SERVICES_COMPOUND_PATH],
    brief,
  );
  assert.ok(group);
  assert.equal(brief.controlledFacts?.['property/energy/mains-services'], undefined);
  assert.equal(
    (brief as { compoundCaptureValues?: unknown }).compoundCaptureValues,
    undefined,
  );
  assert.equal((brief as { groupedFacts?: unknown }).groupedFacts, undefined);
});

test('mains-services child rows use field paths and canonical field IDs', () => {
  const gasPath = mainsServiceFieldPath('gas');
  const child = compoundCaptureChildren(
    [...MAINS_SERVICES_COMPOUND_PATH],
    createBrief(),
  ).find((row) => row.path.join('/') === gasPath.join('/'));
  assert.ok(child);
  assert.equal(child.fieldId, 'property.energy.mains_services.gas');
  assert.deepEqual(child.path, gasPath);
});
