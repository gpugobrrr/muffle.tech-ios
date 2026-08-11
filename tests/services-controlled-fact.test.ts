import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDirectoryCompletion } from '../src/lib/completion';
import { childNodes, findCommandNode } from '../src/lib/command-registry';
import { parseCommand } from '../src/lib/command-parser';
import {
  allFieldDefinitions,
  findFieldDefinition,
  resolveFieldValue,
} from '../src/lib/field-schema';
import {
  HEATING_COMPOUND_PATH,
  HEATING_FIELD_DEFINITIONS,
} from '../src/lib/property-energy-heating';
import {
  MAINS_SERVICE_FIELD_IDS,
  mainsServiceFieldPath,
} from '../src/lib/property-energy-mains-services';
import {
  SERVICES_PRESENCE_FIELD_DEFINITIONS,
  SERVICES_PRESENCE_ROUTES,
  servicesPresenceFieldDefinition,
  type ServicesPresenceRouteId,
} from '../src/lib/services-controlled-facts';
import {
  executeSurveyOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
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

const PRESENCE_SERVICE_IDS = [
  'electricity',
  'water',
  'drainage',
  'gas',
] as const satisfies readonly ServicesPresenceRouteId[];

test('Services presence routes alias the existing mains canonical field IDs', () => {
  for (const serviceId of PRESENCE_SERVICE_IDS) {
    const mains = findFieldDefinition(mainsServiceFieldPath(serviceId));
    const services = findFieldDefinition([
      ...SERVICES_PRESENCE_ROUTES[serviceId],
    ]);
    assert.ok(mains, serviceId);
    assert.ok(services, serviceId);
    assert.equal(services?.fieldId, mains?.fieldId, serviceId);
    assert.equal(services?.fieldId, MAINS_SERVICE_FIELD_IDS[serviceId], serviceId);
    assert.equal(services?.valueType, 'controlledStatus', serviceId);
    assert.deepEqual(services?.options, mains?.options, serviceId);
  }
});

test('no duplicate canonical service-presence IDs are introduced', () => {
  const canonicalIds = new Set(
    SERVICES_PRESENCE_FIELD_DEFINITIONS.map(({ fieldId }) => fieldId),
  );
  assert.deepEqual(
    canonicalIds,
    new Set([
      MAINS_SERVICE_FIELD_IDS.electricity,
      MAINS_SERVICE_FIELD_IDS.water,
      MAINS_SERVICE_FIELD_IDS.drainage,
      MAINS_SERVICE_FIELD_IDS.gas,
    ]),
  );

  for (const fieldId of canonicalIds) {
    const registrations = allFieldDefinitions().filter(
      (field) => field.fieldId === fieldId,
    );
    assert.equal(registrations.length, 2, fieldId);
    assert.equal(
      new Set(registrations.map(({ fieldId: registeredId }) => registeredId))
        .size,
      1,
      fieldId,
    );
  }
});

test('safe Services presence routes are writable controlled fields', () => {
  for (const serviceId of PRESENCE_SERVICE_IDS) {
    const field = servicesPresenceFieldDefinition(serviceId);
    const node = findCommandNode(field.path);
    assert.ok(node, serviceId);
    assert.equal(node?.requiresValue, true, serviceId);
    assert.equal(node?.workflowOnly, undefined, serviceId);
    assert.equal(node?.operationId, SURVEY_OPERATIONS.setControlledFact);
    assert.equal(node?.readOperationId, SURVEY_OPERATIONS.readControlledFact);
    assert.equal(node?.fieldId, MAINS_SERVICE_FIELD_IDS[serviceId]);
    assert.equal(node?.coverage?.status, 'interactive');
  }
});

test('ambiguous Services routes remain blocked', () => {
  const servicesChildren = childNodes(['services']);
  for (const token of ['limitation', 'common']) {
    const node = servicesChildren.find((child) => child.token === token);
    assert.ok(node, token);
    assert.equal(node?.workflowOnly, true, token);
    assert.equal(node?.coverage?.status, 'blocked', token);
    assert.equal(node?.operationId, undefined, token);
  }

  assert.equal(
    findCommandNode(['services', 'gas-oil', 'oil'])?.workflowOnly,
    true,
  );
  assert.equal(
    findCommandNode(['services', 'gas-oil', 'oil'])?.coverage?.status,
    'blocked',
  );
});

test('valid Services presence selection writes through the generic Engine operation', () => {
  const parsed = parseCommand('services/electricity/presence present');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  assert.deepEqual(parsed.operation, {
    operationId: SURVEY_OPERATIONS.setControlledFact,
    arguments: {
      fieldId: MAINS_SERVICE_FIELD_IDS.electricity,
      value: 'present',
    },
  });

  const result = executeSurveyOperation(createBrief(), parsed.operation);
  assert.ok(result);
  assert.equal(result?.operationId, SURVEY_OPERATIONS.setControlledFact);
  assert.equal(
    resolveFieldValue(result!.brief, MAINS_SERVICE_FIELD_IDS.electricity),
    'present',
  );
});

test('invalid Services option is rejected before canonical write', () => {
  const parsed = parseCommand('services/water/presence compliant');
  assert.equal(parsed.type, 'incomplete');

  const result = executeSurveyOperation(createBrief(), {
    operationId: SURVEY_OPERATIONS.setControlledFact,
    arguments: {
      fieldId: MAINS_SERVICE_FIELD_IDS.water,
      value: 'compliant',
    },
  });
  assert.equal(result, null);
});

test('persisted aliases resolve on both route families and remain independent', () => {
  let brief = createBrief();
  for (const [serviceId, value] of [
    ['electricity', 'not_inspected'],
    ['water', 'unknown'],
  ] as const) {
    const result = executeSurveyOperation(brief, {
      operationId: SURVEY_OPERATIONS.setControlledFact,
      arguments: {
        fieldId: MAINS_SERVICE_FIELD_IDS[serviceId],
        value,
      },
    });
    assert.ok(result);
    brief = result!.brief;
  }

  assert.equal(
    resolveFieldValue(
      brief,
      findFieldDefinition([...SERVICES_PRESENCE_ROUTES.electricity])!.fieldId,
    ),
    'not_inspected',
  );
  assert.equal(
    resolveFieldValue(
      brief,
      findFieldDefinition(mainsServiceFieldPath('electricity'))!.fieldId,
    ),
    'not_inspected',
  );
  assert.equal(
    resolveFieldValue(brief, MAINS_SERVICE_FIELD_IDS.water),
    'unknown',
  );
  assert.equal(resolveFieldValue(brief, MAINS_SERVICE_FIELD_IDS.gas), null);
  assert.equal(resolveFieldValue(brief, MAINS_SERVICE_FIELD_IDS.drainage), null);
});

test('central completion counts every explicit accepted answer, not route visits', () => {
  let brief = createBrief();
  const before = resolveDirectoryCompletion(['services'], brief);
  assert.equal(before?.completed, 0);
  assert.equal(before?.total, 4);

  const result = executeSurveyOperation(brief, {
    operationId: SURVEY_OPERATIONS.setControlledFact,
    arguments: {
      fieldId: MAINS_SERVICE_FIELD_IDS.drainage,
      value: 'not_present',
    },
  });
  assert.ok(result);
  brief = result!.brief;

  const after = resolveDirectoryCompletion(['services'], brief);
  assert.equal(after?.completed, 1);
  assert.equal(after?.total, 4);
  assert.deepEqual(
    after?.children.find(({ token }) => token === 'drainage'),
    {
      token: 'drainage',
      label: 'Drainage',
      path: ['services', 'drainage'],
      completed: 1,
      total: 1,
    },
  );
});

test('Services aliases do not create a second heating source of truth', () => {
  assert.equal(findFieldDefinition(['services', 'heating']), null);
  assert.equal(findFieldDefinition(['services', 'heating', 'presence']), null);
  assert.equal(findCommandNode(['services', 'heating'])?.workflowOnly, undefined);
  assert.ok(findCommandNode(['services', 'heating', 'observe'])?.findingTarget);
  assert.ok(findCommandNode([...HEATING_COMPOUND_PATH])?.compoundCapture);
  assert.ok(HEATING_FIELD_DEFINITIONS.length > 0);
  assert.equal(
    allFieldDefinitions().some(
      ({ pathKey, fieldId }) =>
        pathKey.startsWith('services/heating') ||
        fieldId.startsWith('services.heating'),
    ),
    false,
  );
});

test('controlled service fields keep notes and findings out of canonical values', () => {
  for (const field of SERVICES_PRESENCE_FIELD_DEFINITIONS) {
    assert.equal(field.notesEnabled, false);
    assert.equal(field.valueType, 'controlledStatus');
  }

  const externalObservation = findCommandNode([
    'external',
    'walls',
    'observe',
  ]);
  assert.ok(externalObservation?.findingTarget);
  assert.equal(
    findCommandNode(['services', 'electricity', 'presence'])?.findingTarget,
    undefined,
  );
  assert.ok(findCommandNode(['services', 'electricity', 'observe'])?.findingTarget);
});
