import assert from 'node:assert/strict';
import test from 'node:test';

import { childNodes, findCommandNode } from '../src/lib/command-registry';
import { parseCommand } from '../src/lib/command-parser';
import {
  commitInspectionFindingField,
  resolveFindingFieldValue,
} from '../src/lib/level-2-finding-capture';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import {
  INSPECTION_ELEMENT_CONCEPT_IDS,
  isInspectionElementConceptId,
} from '../src/lib/inspection-finding-elements';
import {
  findFieldDefinition,
} from '../src/lib/field-schema';
import {
  MAINS_SERVICE_FIELD_IDS,
} from '../src/lib/property-energy-mains-services';
import {
  SERVICES_PRESENCE_ROUTES,
  servicesPresenceFieldDefinition,
} from '../src/lib/services-controlled-facts';
import {
  SERVICES_FINDING_CONFIGS,
  SERVICES_GAS_FINDING_CONFIG,
  servicesFindingConfig,
} from '../src/lib/services-findings';
import {
  executeInspectionOperation,
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

test('Services findings use the same canonical Finding infrastructure as external walls', () => {
  const electricity = servicesFindingConfig('electricity');
  const target = findCommandNode([
    'services',
    'electricity',
    'observe',
  ])?.findingTarget;
  assert.ok(target);
  assert.equal(target?.findingId, electricity.findingId);
  assert.equal(target?.elementConceptId, electricity.elementConceptId);
  assert.equal(target?.field, 'observation');
});

test('generic Engine finding operations accept Services property elements', () => {
  const electricity = servicesFindingConfig('electricity');
  const created = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        id: electricity.findingId,
        elementConceptId: electricity.elementConceptId,
        observation: 'Consumer unit appears dated.',
      },
    },
  });
  assert.ok(created);
  assert.equal(
    created.finding.elementConceptId,
    'service_system.electrical_installation',
  );
});

test('invalid property elements are rejected by finding normalization', () => {
  const result = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        id: 'finding.invalid.1',
        elementConceptId: 'service_system.unlisted' as any,
        observation: 'Should not persist.',
      },
    },
  });
  assert.equal(result, null);
});

test('stable finding identity survives edit and re-entry resolution', () => {
  const target = findCommandNode([
    'services',
    'electricity',
    'observe',
  ])!.findingTarget!;
  let inspection = createEmptyInspectionRecord();

  const created = commitInspectionFindingField(
    inspection,
    target,
    'Older consumer unit observed.',
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  inspection = created.result.inspection;

  const updated = commitInspectionFindingField(
    inspection,
    target,
    'Consumer unit appears dated and no test documentation was available.',
  );
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.equal(Object.keys(updated.result.inspection.findings).length, 1);
  assert.equal(
    resolveFindingFieldValue(updated.result.inspection, target),
    'Consumer unit appears dated and no test documentation was available.',
  );
});

test('electricity presence alias still works alongside findings', () => {
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

  let brief = createBrief();
  const presence = executeSurveyOperation(brief, parsed.operation);
  assert.ok(presence);
  brief = presence!.brief;

  const electricity = servicesFindingConfig('electricity');
  const finding = executeInspectionOperation(createEmptyInspectionRecord(), {
    operationId: SURVEY_OPERATIONS.upsertInspectionFinding,
    arguments: {
      finding: {
        id: electricity.findingId,
        elementConceptId: electricity.elementConceptId,
        observation: 'No test documentation available.',
      },
    },
  });
  assert.ok(finding);
  assert.equal(
    brief.controlledFacts?.[MAINS_SERVICE_FIELD_IDS.electricity],
    'present',
  );
  assert.equal(
    finding!.finding.observation,
    'No test documentation available.',
  );
});

test('water and drainage findings remain independent from electricity', () => {
  const waterObserve = findCommandNode(['services', 'water', 'observe'])!
    .findingTarget!;
  const electricityTarget = findCommandNode([
    'services',
    'electricity',
    'observe',
  ])!.findingTarget!;

  let inspection = createEmptyInspectionRecord();
  const water = commitInspectionFindingField(
    inspection,
    waterObserve,
    'Stopcock not located.',
  );
  assert.equal(water.ok, true);
  if (!water.ok) return;
  inspection = water.result.inspection;

  const electricity = commitInspectionFindingField(
    inspection,
    electricityTarget,
    'Consumer unit dated.',
  );
  assert.equal(electricity.ok, true);
  if (!electricity.ok) return;

  assert.equal(
    resolveFindingFieldValue(electricity.result.inspection, waterObserve),
    'Stopcock not located.',
  );
  assert.equal(
    resolveFindingFieldValue(electricity.result.inspection, electricityTarget),
    'Consumer unit dated.',
  );
});

test('gas route exposes presence and findings without an ambiguous gas-oil element', () => {
  const gasNode = findCommandNode(['services', 'gas-oil', 'gas']);
  assert.ok(gasNode);
  assert.equal(gasNode?.workflowOnly, undefined);
  assert.equal(
    findCommandNode(['services', 'gas-oil', 'gas', 'presence'])?.fieldId,
    MAINS_SERVICE_FIELD_IDS.gas,
  );
  assert.equal(
    findCommandNode(['services', 'gas-oil', 'oil'])?.workflowOnly,
    true,
  );
  assert.equal(
    findCommandNode(['services', 'gas-oil', 'observe']),
    null,
  );
  assert.equal(
    SERVICES_GAS_FINDING_CONFIG.elementConceptId,
    'service_system.gas_installation',
  );
});

test('heating findings do not create a second structured heating source of truth', () => {
  const heating = servicesFindingConfig('heating');
  assert.equal(heating.elementConceptId, 'service_system.heating');
  assert.equal(findFieldDefinition(['services', 'heating', 'presence']), null);
  assert.equal(
    findCommandNode(['property', 'energy', 'heating'])?.compoundCapture,
    true,
  );
});

test('no ServiceFinding second model exists in workspace types', () => {
  assert.equal(
    INSPECTION_ELEMENT_CONCEPT_IDS.some((id) => id.startsWith('service_system.')),
    true,
  );
  for (const config of SERVICES_FINDING_CONFIGS) {
    assert.equal(isInspectionElementConceptId(config.elementConceptId), true);
    assert.match(config.findingId, /^finding\.service\./);
  }
});

test('oil and common services routes remain blocked', () => {
  const servicesChildren = childNodes(['services']);
  assert.equal(
    servicesChildren.find((child) => child.token === 'gas-oil')?.workflowOnly,
    undefined,
  );
  assert.equal(
    findCommandNode(['services', 'gas-oil', 'oil'])?.workflowOnly,
    true,
  );
  assert.equal(findCommandNode(['services', 'common'])?.workflowOnly, true);
});

test('presence routes remain canonical aliases without duplicate field IDs', () => {
  for (const serviceId of ['electricity', 'water', 'drainage', 'gas'] as const) {
    const field = servicesPresenceFieldDefinition(serviceId);
    assert.deepEqual(field.path, [...SERVICES_PRESENCE_ROUTES[serviceId]]);
    assert.equal(field.fieldId, MAINS_SERVICE_FIELD_IDS[serviceId]);
  }
});
