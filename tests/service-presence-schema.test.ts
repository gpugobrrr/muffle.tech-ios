import assert from 'node:assert/strict';
import test from 'node:test';

import { SERVICE_PRESENCE_CATALOG } from '../src/lib/service-presence-schema';
import {
  MAINS_SERVICE_IDS,
  MAINS_SERVICE_FIELD_IDS,
  MAINS_SERVICE_FIELD_DEFINITIONS,
  mainsServiceFieldPath,
} from '../src/lib/property-energy-mains-services';
import {
  SERVICES_PRESENCE_CONFIGS,
  SERVICES_PRESENCE_FIELD_DEFINITIONS,
  SERVICES_PRESENCE_ROUTES,
  servicesPresenceFieldDefinition,
} from '../src/lib/services-controlled-facts';

test('exactly four unique services in the catalog', () => {
  assert.equal(SERVICE_PRESENCE_CATALOG.length, 4);
  const serviceIds = SERVICE_PRESENCE_CATALOG.map((row) => row.serviceId);
  assert.deepEqual(
    new Set(serviceIds),
    new Set(['gas', 'electricity', 'water', 'drainage']),
  );
});

test('unique routes and canonical field IDs in the catalog', () => {
  const routes = SERVICE_PRESENCE_CATALOG.map((row) => row.route.join('/'));
  const fieldIds = SERVICE_PRESENCE_CATALOG.map((row) => row.fieldId);

  assert.equal(new Set(routes).size, 4);
  assert.equal(new Set(fieldIds).size, 4);
});

test('both route families use the same canonical IDs', () => {
  for (const row of SERVICE_PRESENCE_CATALOG) {
    const mainsField = MAINS_SERVICE_FIELD_DEFINITIONS.find(
      (f) => f.token === row.serviceId,
    );
    const servicesField = SERVICES_PRESENCE_FIELD_DEFINITIONS.find(
      (f) => f.fieldId === row.fieldId,
    );

    assert.ok(mainsField, `mains field not found for ${row.serviceId}`);
    assert.ok(servicesField, `services field not found for ${row.serviceId}`);

    assert.equal(mainsField.fieldId, row.fieldId);
    assert.equal(servicesField.fieldId, row.fieldId);
  }
});

test('options, write operations and read operations retain parity', () => {
  for (const row of SERVICE_PRESENCE_CATALOG) {
    const mainsField = MAINS_SERVICE_FIELD_DEFINITIONS.find(
      (f) => f.token === row.serviceId,
    )!;
    const servicesField = SERVICES_PRESENCE_FIELD_DEFINITIONS.find(
      (f) => f.fieldId === row.fieldId,
    )!;

    assert.deepEqual(mainsField.options, servicesField.options);
    assert.equal(mainsField.operationId, servicesField.operationId);
    assert.equal(mainsField.readOperationId, servicesField.readOperationId);
    assert.equal(mainsField.valueType, servicesField.valueType);
    assert.equal(mainsField.required, servicesField.required);
  }
});

test('MAINS_SERVICE_IDS matches catalog order', () => {
  const catalogIds = SERVICE_PRESENCE_CATALOG.map((row) => row.serviceId);
  assert.deepEqual(MAINS_SERVICE_IDS, catalogIds);
});

test('MAINS_SERVICE_FIELD_IDS matches catalog field IDs', () => {
  for (const row of SERVICE_PRESENCE_CATALOG) {
    assert.equal(MAINS_SERVICE_FIELD_IDS[row.serviceId], row.fieldId);
  }
});

test('mainsServiceFieldPath remains unchanged', () => {
  for (const row of SERVICE_PRESENCE_CATALOG) {
    assert.deepEqual(mainsServiceFieldPath(row.serviceId), [
      'property',
      'energy',
      'mains-services',
      row.serviceId,
    ]);
  }
});

test('SERVICES_PRESENCE_CONFIGS and SERVICES_PRESENCE_ROUTES match each catalog alias route, label and description', () => {
  for (const row of SERVICE_PRESENCE_CATALOG) {
    const config = SERVICES_PRESENCE_CONFIGS.find(
      (c) => c.serviceId === row.serviceId,
    );
    assert.ok(config, `config not found for ${row.serviceId}`);
    assert.deepEqual(config.route, row.route);
    assert.equal(config.label, row.aliasLabel);
    assert.equal(config.description, row.aliasDescription);

    assert.deepEqual(SERVICES_PRESENCE_ROUTES[row.serviceId], row.route);
  }
});

test('servicesPresenceFieldDefinition resolves the expected canonical field', () => {
  for (const row of SERVICE_PRESENCE_CATALOG) {
    const def = servicesPresenceFieldDefinition(row.serviceId);
    assert.equal(def.fieldId, row.fieldId);
  }
});
