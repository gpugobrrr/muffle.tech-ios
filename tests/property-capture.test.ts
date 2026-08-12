import assert from 'node:assert/strict';
import test from 'node:test';

import { getConceptByCanonicalField } from '../src/domain/ontology/muffle-ontology.v1';
import { parseCommand } from '../src/lib/command-parser';
import { findCommandNode } from '../src/lib/command-registry';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import {
  resolveSvyrDataEntryType,
  resolveSvyrNodeDataEntryType,
  SVYR_DATA_ENTRY_TYPES,
} from '../src/lib/data-entry-types';
import {
  findFieldDefinition,
  resolveFieldSetValue,
  resolveFieldValue,
} from '../src/lib/field-schema';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import {
  deserializeActiveJob,
  serializeActiveJob,
} from '../src/lib/job-persistence';
import {
  toggleMultiChoiceValue,
} from '../src/lib/multi-choice';
import {
  HEATING_COMPOUND_PATH,
} from '../src/lib/property-energy-heating';
import {
  MAINS_SERVICE_FIELD_IDS,
  MAINS_SERVICES_COMPOUND_PATH,
  mainsServiceFieldPath,
} from '../src/lib/property-energy-mains-services';
import { SERVICES_PRESENCE_ROUTES } from '../src/lib/services-controlled-facts';
import {
  executeSurveyOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
import {
  formatSvyrDisplayedLabel,
  SVYR_LABEL_DELIMITERS,
} from '../src/lib/svyr-label-presentation';
import {
  readEntryDraft,
  stashEntryDraft,
} from '../src/lib/svyr-entry-drafts';
import type { ActiveJob } from '../src/types/workspace';
import type { InspectionBrief } from '../src/types/workspace';

const UNRESOLVED_PROPERTY_LEAVES = [
  {
    path: ['property', 'address'],
    missing:
      'Address is job-state StructuredAddress from property selection, not a survey field.',
  },
  {
    path: ['property', 'type'],
    missing: 'No canonical property-type field, vocabulary, or Engine operation.',
  },
  {
    path: ['property', 'age'],
    missing: 'No canonical construction-date field or Engine operation.',
  },
  {
    path: ['property', 'extension'],
    missing: 'No canonical extension model.',
  },
  {
    path: ['property', 'conversion'],
    missing: 'No canonical conversion model.',
  },
  {
    path: ['property', 'flat'],
    missing: 'No canonical tenure/building-context field.',
  },
  {
    path: ['property', 'construction'],
    missing: 'Construction remains unresolved in ontology review.',
  },
  {
    path: ['property', 'accommodation'],
    missing: 'No canonical room/accommodation model.',
  },
  {
    path: ['property', 'roof-spaces'],
    missing: 'No canonical roof-space model.',
  },
  {
    path: ['property', 'location', 'grounds'],
    missing: 'No canonical site/grounds taxonomy.',
  },
  {
    path: ['property', 'location', 'facilities'],
    missing: 'No canonical facilities model.',
  },
  {
    path: ['property', 'location', 'environment'],
    missing: 'No canonical local-environment assessment model.',
  },
] as const;

function emptyBrief(): InspectionBrief {
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

function emptyJob(): ActiveJob {
  return {
    id: 'job.property.capture',
    property: { displayAddress: '18 Market Street' },
    inspection: createEmptyInspectionRecord(),
  };
}

test('Property energy heating children use established Types 3–4 with ontology', () => {
  const heating = findCommandNode([...HEATING_COMPOUND_PATH]);
  assert.equal(resolveSvyrNodeDataEntryType(heating!), SVYR_DATA_ENTRY_TYPES.compoundGroup);
  assert.equal(heating?.compoundCapture, true);

  const systemType = findFieldDefinition([...HEATING_COMPOUND_PATH, 'system-type']);
  const emitters = findFieldDefinition([...HEATING_COMPOUND_PATH, 'heat-emitters']);
  const defects = findFieldDefinition([...HEATING_COMPOUND_PATH, 'defects']);
  assert.equal(resolveSvyrDataEntryType(systemType!), SVYR_DATA_ENTRY_TYPES.controlledFact);
  assert.equal(resolveSvyrDataEntryType(emitters!), SVYR_DATA_ENTRY_TYPES.multiChoice);
  assert.equal(resolveSvyrDataEntryType(defects!), SVYR_DATA_ENTRY_TYPES.controlledFact);
  assert.equal(systemType?.fieldId, 'property.energy.heating.system_type');
  assert.equal(
    getConceptByCanonicalField('property.energy.heating.system_type')?.id,
    'property.energy.heating.system_type',
  );
  assert.equal(
    getConceptByCanonicalField('property.energy.heating.heat_emitters')?.id,
    'property.energy.heating.heat_emitters',
  );
});

test('Property mains-service presence is Type 4 and aliases Services presence', () => {
  for (const serviceId of ['gas', 'electricity', 'water', 'drainage'] as const) {
    const propertyField = findFieldDefinition(mainsServiceFieldPath(serviceId));
    const servicesField = findFieldDefinition([...SERVICES_PRESENCE_ROUTES[serviceId]]);
    assert.ok(propertyField);
    assert.ok(servicesField);
    assert.equal(propertyField?.fieldId, MAINS_SERVICE_FIELD_IDS[serviceId]);
    assert.equal(servicesField?.fieldId, MAINS_SERVICE_FIELD_IDS[serviceId]);
    assert.equal(resolveSvyrDataEntryType(propertyField!), SVYR_DATA_ENTRY_TYPES.controlledFact);
    assert.equal(
      getConceptByCanonicalField(propertyField!.fieldId)?.id,
      propertyField!.fieldId,
    );
  }
});

test('Property and Services presence writes share one canonical value', () => {
  const propertyWrite = parseCommand(
    'property/energy/mains-services/electricity present',
  );
  assert.equal(propertyWrite.type, 'operation');
  if (propertyWrite.type !== 'operation') return;
  assert.equal(propertyWrite.operation.arguments.fieldId, MAINS_SERVICE_FIELD_IDS.electricity);
  assert.equal(propertyWrite.operation.arguments.value, 'present');
  assert.equal(
    propertyWrite.operation.arguments.value?.includes(SVYR_LABEL_DELIMITERS.choice.open),
    false,
  );

  let brief = executeSurveyOperation(emptyBrief(), propertyWrite.operation)!.brief;
  assert.equal(
    resolveFieldValue(brief, MAINS_SERVICE_FIELD_IDS.electricity),
    'present',
  );

  const servicesWrite = parseCommand('services/electricity/presence not_inspected');
  assert.equal(servicesWrite.type, 'operation');
  if (servicesWrite.type !== 'operation') return;
  brief = executeSurveyOperation(brief, servicesWrite.operation)!.brief;
  assert.equal(
    resolveFieldValue(brief, findFieldDefinition(mainsServiceFieldPath('electricity'))!.fieldId),
    'not_inspected',
  );
  assert.equal(
    resolveFieldValue(
      brief,
      findFieldDefinition([...SERVICES_PRESENCE_ROUTES.electricity])!.fieldId,
    ),
    'not_inspected',
  );
});

test('Type 4 unset remains distinct from controlled presence statuses', () => {
  const field = findFieldDefinition(mainsServiceFieldPath('gas'))!;
  assert.equal(resolveFieldValue(emptyBrief(), field.fieldId), null);
  for (const status of ['present', 'not_present', 'unknown', 'not_inspected'] as const) {
    const parsed = parseCommand(`property/energy/mains-services/gas ${status}`);
    assert.equal(parsed.type, 'operation');
    if (parsed.type !== 'operation') continue;
    const committed = executeSurveyOperation(emptyBrief(), parsed.operation);
    assert.equal(resolveFieldValue(committed!.brief, field.fieldId), status);
    assert.notEqual(status, null);
  }
  assert.equal(parseCommand('property/energy/mains-services/gas').type, 'operation');
  const emptyWrite = executeSurveyOperation(emptyBrief(), {
    operationId: SURVEY_OPERATIONS.setControlledFact,
    arguments: { fieldId: field.fieldId, value: '' },
  });
  assert.equal(emptyWrite, null);
});

test('Type 2/4 heating options store canonical values not presentation labels', () => {
  const displayed = formatSvyrDisplayedLabel('Gas boiler', 'choice');
  assert.equal(displayed, '<Gas boiler>');
  const parsed = parseCommand('property/energy/heating/system-type gas_boiler');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  assert.equal(parsed.operation.arguments.value, 'gas_boiler');
  assert.notEqual(parsed.operation.arguments.value, displayed);
  const committed = executeSurveyOperation(emptyBrief(), parsed.operation);
  assert.equal(
    resolveFieldValue(committed!.brief, 'property.energy.heating.system_type'),
    'gas_boiler',
  );
});

test('Type 3 heat emitters store canonical arrays and support toggle/remove', () => {
  const field = findFieldDefinition([...HEATING_COMPOUND_PATH, 'heat-emitters'])!;
  const selected = toggleMultiChoiceValue(
    toggleMultiChoiceValue([], 'radiators'),
    'underfloor',
  );
  assert.deepEqual(selected.sort(), ['radiators', 'underfloor'].sort());
  const removed = toggleMultiChoiceValue(selected, 'radiators');
  assert.deepEqual(removed, ['underfloor']);

  const committed = executeSurveyOperation(emptyBrief(), {
    operationId: SURVEY_OPERATIONS.setControlledFactSet,
    arguments: { fieldId: field.fieldId, values: ['underfloor', 'radiators'] },
  });
  assert.deepEqual(resolveFieldSetValue(committed!.brief, field.fieldId), [
    'radiators',
    'underfloor',
  ]);
});

test('Type 5 heating compound does not persist an aggregate compound value', () => {
  const system = parseCommand('property/energy/heating/system-type gas_boiler');
  assert.equal(system.type, 'operation');
  if (system.type !== 'operation') return;
  const committed = executeSurveyOperation(emptyBrief(), system.operation)!;
  assert.equal(
    committed.brief.controlledFacts?.['property.energy.heating.system_type'],
    'gas_boiler',
  );
  assert.equal(committed.brief.controlledFacts?.['property.energy.heating'], undefined);
  assert.equal((committed.brief as { heating?: unknown }).heating, undefined);
});

test('Property energy drafts do not mutate canonical brief before commit', () => {
  const path = [...HEATING_COMPOUND_PATH, 'defects'];
  const drafts = stashEntryDraft({}, path, 'Corroded flue terminal');
  assert.equal(readEntryDraft(drafts, path), 'Corroded flue terminal');
  assert.equal(
    resolveFieldValue(emptyBrief(), 'property.energy.heating.defects'),
    null,
  );
});

test('Property energy completion derives from canonical controlled facts', () => {
  const before = resolveDirectoryCompletion([...MAINS_SERVICES_COMPOUND_PATH], emptyBrief());
  const gasBefore = before?.children.find((child) => child.token === 'gas');
  assert.equal(gasBefore?.completed, 0);

  const parsed = parseCommand('property/energy/mains-services/gas present');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  const committed = executeSurveyOperation(emptyBrief(), parsed.operation)!;
  const after = resolveDirectoryCompletion(
    [...MAINS_SERVICES_COMPOUND_PATH],
    committed.brief,
  );
  const gasAfter = after?.children.find((child) => child.token === 'gas');
  assert.equal(gasAfter?.completed, 1);
});

test('Property energy facts stay on the brief and do not create findings', () => {
  const parsed = parseCommand('property/energy/mains-services/water unknown');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  const committed = executeSurveyOperation(emptyBrief(), parsed.operation)!;
  const job = emptyJob();
  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.deepEqual(restored?.inspection.findings, {});
  assert.equal(
    resolveFieldValue(committed.brief, MAINS_SERVICE_FIELD_IDS.water),
    'unknown',
  );
});

test('unresolved Property description leaves stay placeholders without invented fields', () => {
  for (const leaf of UNRESOLVED_PROPERTY_LEAVES) {
    const node = findCommandNode([...leaf.path]);
    assert.ok(node, leaf.path.join('/'));
    assert.equal(node?.workflowOnly, true, leaf.path.join('/'));
    assert.equal(node?.requiresValue, undefined, leaf.path.join('/'));
    assert.equal(findFieldDefinition([...leaf.path]), null, leaf.path.join('/'));
    assert.equal(parseCommand(leaf.path.join('/')).type, 'placeholder', leaf.path.join('/'));
    assert.ok(node?.coverage?.blocker || node?.coverage?.status === 'pre-populated');
  }
  assert.equal(findCommandNode(['property', 'location'])?.workflowOnly, undefined);
  assert.equal(parseCommand('property/location').type, 'incomplete');
});
