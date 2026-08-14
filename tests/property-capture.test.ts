import assert from 'node:assert/strict';
import test from 'node:test';

import { getConceptByCanonicalField } from '../src/domain/ontology/muffle-ontology.v1';
import {
  applyActiveJobTransition,
  resolveHydratedActiveJob,
} from '../src/lib/active-job-state';
import { parseEditableCommand } from '../src/lib/command-edit';
import { CONTROLLED_PRESENCE_STATUSES } from '../src/lib/controlled-fact';
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
  normalizeFieldInputValue,
  resolveFieldSetValue,
  resolveFieldValue,
} from '../src/lib/field-schema';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import {
  deserializeActiveJob,
  serializeActiveJob,
  createInitialActiveJob,
  readActiveJobBrief,
  withInspectionBrief,
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
import {
  PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID,
  PROPERTY_CONSTRUCTION_FORM_FIELD_ID,
  PROPERTY_CONSTRUCTION_FORM_OPTIONS,
  PROPERTY_CONSTRUCTION_FORM_VALUES,
  PROPERTY_CONVERSION_FIELD_ID,
  PROPERTY_EXTENSION_FIELD_ID,
  PROPERTY_TYPE_FIELD_ID,
  PROPERTY_TYPE_OPTIONS,
} from '../src/lib/property-description';
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
  capabilityForRoute,
  SURVEY_CAPABILITY_KINDS,
} from '../src/lib/survey-capability';
import {
  clearEntryDraft,
  readEntryDraft,
  resolveDataEntryReentryDraft,
  stashEntryDraft,
  suffixForDataEntryReentry,
} from '../src/lib/svyr-entry-drafts';
import { suffixForPath } from '../src/lib/pin-context';
import type { ActiveJob } from '../src/types/workspace';
import type { InspectionBrief } from '../src/types/workspace';

const UNRESOLVED_PROPERTY_LEAVES = [
  {
    path: ['property', 'address'],
    missing:
      'Address is job-state StructuredAddress from property selection, not a survey field.',
  },
  {
    path: ['property', 'flat'],
    missing:
      'Dwelling type already records flat/maisonette; other flat context is undefined.',
  },
  {
    path: ['property', 'accommodation'],
    missing: 'No canonical room/accommodation model.',
  },
  {
    path: ['property', 'roof-spaces'],
    missing:
      'Roof-space meaning mixes presence, access, and inspection-subject semantics.',
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

const PROPERTY_DESCRIPTION_CAPTURES = [
  {
    path: ['property', 'type'],
    fieldId: PROPERTY_TYPE_FIELD_ID,
    captureType: SVYR_DATA_ENTRY_TYPES.singleChoice,
    operationId: SURVEY_OPERATIONS.setSingleChoice,
    value: 'detached',
    label: 'Detached',
  },
  {
    path: ['property', 'age'],
    fieldId: PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID,
    captureType: SVYR_DATA_ENTRY_TYPES.singleChoice,
    operationId: SURVEY_OPERATIONS.setSingleChoice,
    value: '1900_1918',
    label: '1900–1918',
  },
  {
    path: ['property', 'extension'],
    fieldId: PROPERTY_EXTENSION_FIELD_ID,
    captureType: SVYR_DATA_ENTRY_TYPES.controlledFact,
    operationId: SURVEY_OPERATIONS.setControlledFact,
    value: 'present',
    label: 'Present',
  },
  {
    path: ['property', 'conversion'],
    fieldId: PROPERTY_CONVERSION_FIELD_ID,
    captureType: SVYR_DATA_ENTRY_TYPES.controlledFact,
    operationId: SURVEY_OPERATIONS.setControlledFact,
    value: 'not_present',
    label: 'Not present',
  },
  {
    path: ['property', 'construction'],
    fieldId: PROPERTY_CONSTRUCTION_FORM_FIELD_ID,
    captureType: SVYR_DATA_ENTRY_TYPES.singleChoice,
    operationId: SURVEY_OPERATIONS.setSingleChoice,
    value: 'timber_frame',
    label: 'Timber frame',
  },
] as const;

function reopenPropertyEntryValue(
  brief: InspectionBrief,
  path: readonly string[],
  stashedDraft?: string,
): string | undefined {
  const field = findFieldDefinition([...path]);
  assert.ok(field, path.join('/'));
  const suffix = suffixForDataEntryReentry({
    path: [...path],
    draft: resolveDataEntryReentryDraft({
      canonicalValue: resolveFieldValue(brief, field.fieldId),
      stashedDraft,
    }),
    defaultInsertion: suffixForPath([...path]),
    suffixForPath,
  });
  return parseEditableCommand(suffix).valueText || undefined;
}

test('activated Property description routes are Types 2 and 4 with ontology', () => {
  for (const route of PROPERTY_DESCRIPTION_CAPTURES) {
    const node = findCommandNode([...route.path]);
    const field = findFieldDefinition([...route.path]);
    const capability = capabilityForRoute(route.path);
    assert.ok(node, route.path.join('/'));
    assert.ok(field, route.path.join('/'));
    assert.equal(node?.workflowOnly, undefined, route.path.join('/'));
    assert.equal(node?.fieldId, route.fieldId);
    assert.equal(field?.fieldId, route.fieldId);
    assert.equal(node?.operationId, route.operationId);
    assert.equal(field?.operationId, route.operationId);
    assert.equal(field?.optional, true);
    assert.equal(resolveSvyrDataEntryType(field!), route.captureType);
    assert.equal(capability?.kind, SURVEY_CAPABILITY_KINDS.capture);
    assert.equal(capability?.captureType, route.captureType);
    assert.equal(capability?.fieldId, route.fieldId);
    assert.equal(capability?.operationId, route.operationId);
    const concept = getConceptByCanonicalField(route.fieldId);
    assert.ok(concept, route.fieldId);
    assert.equal(concept?.bindings?.canonicalFieldId, route.fieldId);
    assert.equal(concept?.maturity, 'engine-backed');
    assert.deepEqual(concept?.valueType?.options, field?.options?.map((option) => option.value));
  }
});

test('Property Type stores canonical machine values not display labels', () => {
  const displayed = formatSvyrDisplayedLabel('Semi-detached', 'choice');
  assert.equal(displayed, '<Semi-detached>');
  assert.equal(normalizeFieldInputValue(findFieldDefinition(['property', 'type']), 'Semi-detached'), 'semi_detached');
  const parsed = parseCommand('property/type Semi-detached');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  assert.equal(parsed.operation.operationId, SURVEY_OPERATIONS.setSingleChoice);
  assert.equal(parsed.operation.arguments.fieldId, PROPERTY_TYPE_FIELD_ID);
  assert.equal(parsed.operation.arguments.value, 'semi_detached');
  assert.notEqual(parsed.operation.arguments.value, displayed);
  const committed = executeSurveyOperation(emptyBrief(), parsed.operation);
  assert.equal(resolveFieldValue(committed!.brief, PROPERTY_TYPE_FIELD_ID), 'semi_detached');
  const replacement = parseCommand('property/type flat');
  assert.equal(replacement.type, 'operation');
  if (replacement.type !== 'operation') return;
  const replaced = executeSurveyOperation(committed!.brief, replacement.operation);
  assert.equal(resolveFieldValue(replaced!.brief, PROPERTY_TYPE_FIELD_ID), 'flat');
  assert.equal(replaced!.brief.controlledFacts?.['property.flat'], undefined);
  assert.equal(findFieldDefinition(['property', 'flat']), null);
});

test('Property Age stores construction-period IDs not display ranges', () => {
  const parsed = parseCommand('property/age 1900–1918');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  assert.equal(parsed.operation.arguments.value, '1900_1918');
  const committed = executeSurveyOperation(emptyBrief(), parsed.operation);
  assert.equal(
    resolveFieldValue(committed!.brief, PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID),
    '1900_1918',
  );
});

test('Extension and conversion Type 4 statuses remain distinct', () => {
  let brief = emptyBrief();
  assert.equal(resolveFieldValue(brief, PROPERTY_EXTENSION_FIELD_ID), null);
  assert.equal(resolveFieldValue(brief, PROPERTY_CONVERSION_FIELD_ID), null);
  for (const status of CONTROLLED_PRESENCE_STATUSES) {
    const parsed = parseCommand(`property/extension ${status}`);
    assert.equal(parsed.type, 'operation');
    if (parsed.type !== 'operation') continue;
    const committed = executeSurveyOperation(emptyBrief(), parsed.operation);
    assert.equal(resolveFieldValue(committed!.brief, PROPERTY_EXTENSION_FIELD_ID), status);
    assert.equal(resolveFieldValue(committed!.brief, PROPERTY_CONVERSION_FIELD_ID), null);
  }
  const conversion = parseCommand('property/conversion unknown');
  assert.equal(conversion.type, 'operation');
  if (conversion.type !== 'operation') return;
  brief = executeSurveyOperation(emptyBrief(), conversion.operation)!.brief;
  const extension = parseCommand('property/extension present');
  assert.equal(extension.type, 'operation');
  if (extension.type !== 'operation') return;
  brief = executeSurveyOperation(brief, extension.operation)!.brief;
  assert.equal(resolveFieldValue(brief, PROPERTY_EXTENSION_FIELD_ID), 'present');
  assert.equal(resolveFieldValue(brief, PROPERTY_CONVERSION_FIELD_ID), 'unknown');
});

test('Property description drafts do not mutate ActiveJob before commit', () => {
  const path = ['property', 'type'];
  const drafts = stashEntryDraft({}, path, 'detached');
  const job = createInitialActiveJob();
  assert.equal(readEntryDraft(drafts, path), 'detached');
  assert.equal(resolveFieldValue(readActiveJobBrief(job), PROPERTY_TYPE_FIELD_ID), null);
});

test('Property Type and Extension survive Engine write, reopen, serialize, and hydration', () => {
  let brief = emptyBrief();
  let job = createInitialActiveJob();
  let drafts = {};

  for (const route of [
    PROPERTY_DESCRIPTION_CAPTURES[0],
    PROPERTY_DESCRIPTION_CAPTURES[2],
  ]) {
    drafts = stashEntryDraft(drafts, [...route.path], route.value);
    assert.equal(resolveFieldValue(brief, route.fieldId), null, route.fieldId);
    const parsed = parseCommand(`${route.path.join('/')} ${route.value}`);
    assert.equal(parsed.type, 'operation', route.fieldId);
    if (parsed.type !== 'operation') return;
    const committed = executeSurveyOperation(brief, parsed.operation);
    assert.ok(committed, route.fieldId);
    brief = committed!.brief;
    job = withInspectionBrief(job, brief);
    drafts = clearEntryDraft(drafts, [...route.path]);
    assert.equal(resolveFieldValue(brief, route.fieldId), route.value);
    assert.equal(reopenPropertyEntryValue(brief, route.path), route.value);
    assert.equal(readEntryDraft(drafts, [...route.path]), undefined);
  }

  let refJob = job;
  let stateJob = job;
  const next = applyActiveJobTransition(
    refJob,
    (current) => withInspectionBrief(current, brief),
    (value) => {
      refJob = value;
      stateJob = value;
    },
  );
  assert.equal(refJob, next);
  assert.equal(stateJob, next);

  const serialized = serializeActiveJob(next);
  assert.match(serialized, /"property.type"/);
  assert.match(serialized, /detached/);
  assert.match(serialized, /"property.extension"/);
  assert.equal(serialized.includes('Detached'), false);
  assert.equal(serialized.includes('data:image'), false);
  const restored = deserializeActiveJob(serialized);
  assert.ok(restored);
  const restoredBrief = readActiveJobBrief(restored!);
  assert.equal(resolveFieldValue(restoredBrief, PROPERTY_TYPE_FIELD_ID), 'detached');
  assert.equal(resolveFieldValue(restoredBrief, PROPERTY_EXTENSION_FIELD_ID), 'present');
  assert.equal(reopenPropertyEntryValue(restoredBrief, ['property', 'type']), 'detached');
  assert.equal(reopenPropertyEntryValue(restoredBrief, ['property', 'extension']), 'present');
  const hydrated = resolveHydratedActiveJob({
    restored,
    mutatedBeforeHydration: false,
  });
  assert.ok(hydrated);
  assert.equal(
    resolveFieldValue(readActiveJobBrief(hydrated!), PROPERTY_TYPE_FIELD_ID),
    'detached',
  );
  assert.deepEqual(hydrated!.inspection.findings, {});
});

test('Property description facts do not alter energy, services aliases, address, or findings', () => {
  const energy = parseCommand('property/energy/mains-services/gas present');
  assert.equal(energy.type, 'operation');
  if (energy.type !== 'operation') return;
  let brief = executeSurveyOperation(emptyBrief(), energy.operation)!.brief;
  const type = parseCommand('property/type bungalow');
  assert.equal(type.type, 'operation');
  if (type.type !== 'operation') return;
  brief = executeSurveyOperation(brief, type.operation)!.brief;
  const age = parseCommand('property/age pre_1900');
  assert.equal(age.type, 'operation');
  if (age.type !== 'operation') return;
  brief = executeSurveyOperation(brief, age.operation)!.brief;
  assert.equal(resolveFieldValue(brief, MAINS_SERVICE_FIELD_IDS.gas), 'present');
  assert.equal(resolveFieldValue(brief, PROPERTY_TYPE_FIELD_ID), 'bungalow');
  assert.equal(resolveFieldValue(brief, PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID), 'pre_1900');
  const job = withInspectionBrief(createInitialActiveJob(), brief);
  assert.equal(job.property?.displayAddress, '18 Market Street');
  assert.equal(findFieldDefinition(['property', 'address']), null);
  assert.equal(capabilityForRoute('property/address')?.kind, SURVEY_CAPABILITY_KINDS.navigation);
  assert.deepEqual(job.inspection.findings, {});
  assert.equal(job.property?.instructionType, 'Level 2 Building Survey');
});

test('optional Property description fields do not change directory completion totals', () => {
  const before = resolveDirectoryCompletion(['property'], emptyBrief());
  const typeBefore = before?.children.find((child) => child.token === 'type');
  assert.equal(typeBefore?.total, 0);
  const parsed = parseCommand('property/type detached');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  const after = resolveDirectoryCompletion(
    ['property'],
    executeSurveyOperation(emptyBrief(), parsed.operation)!.brief,
  );
  const typeAfter = after?.children.find((child) => child.token === 'type');
  assert.equal(typeAfter?.total, 0);
  assert.equal(before?.total, after?.total);
});

test('Property Type options remain the approved dwelling-type vocabulary', () => {
  const field = findFieldDefinition(['property', 'type']);
  assert.deepEqual(field?.options, [...PROPERTY_TYPE_OPTIONS]);
});

test('Property Construction Form is Type 2 capture with approved vocabulary', () => {
  const path = ['property', 'construction'] as const;
  const field = findFieldDefinition([...path]);
  const node = findCommandNode([...path]);
  const capability = capabilityForRoute(path);
  assert.equal(field?.fieldId, PROPERTY_CONSTRUCTION_FORM_FIELD_ID);
  assert.notEqual(field?.fieldId, PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID);
  assert.equal(field?.optional, true);
  assert.equal(field?.valueType, 'singleSelect');
  assert.equal(resolveSvyrDataEntryType(field!), SVYR_DATA_ENTRY_TYPES.singleChoice);
  assert.equal(node?.operationId, SURVEY_OPERATIONS.setSingleChoice);
  assert.equal(node?.findingTarget, undefined);
  assert.equal(capability?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(capability?.captureType, SVYR_DATA_ENTRY_TYPES.singleChoice);
  assert.deepEqual(field?.options?.map((option) => option.value), [
    ...PROPERTY_CONSTRUCTION_FORM_VALUES,
  ]);
  assert.deepEqual(field?.options, [...PROPERTY_CONSTRUCTION_FORM_OPTIONS]);
  assert.equal(findFieldDefinition(['property', 'age'])?.fieldId, PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID);
});

test('Construction Form draft and cancel do not write the brief', () => {
  const path = ['property', 'construction'];
  let drafts = stashEntryDraft({}, path, 'masonry');
  const job = createInitialActiveJob();
  assert.equal(readEntryDraft(drafts, path), 'masonry');
  assert.equal(
    resolveFieldValue(readActiveJobBrief(job), PROPERTY_CONSTRUCTION_FORM_FIELD_ID),
    null,
  );
  drafts = clearEntryDraft(drafts, path);
  assert.equal(readEntryDraft(drafts, path), undefined);
  assert.equal(
    resolveFieldValue(readActiveJobBrief(job), PROPERTY_CONSTRUCTION_FORM_FIELD_ID),
    null,
  );
});

test('Construction Form commit writes machine value, replaces, and round-trips', () => {
  const displayed = formatSvyrDisplayedLabel('Timber frame', 'choice');
  assert.equal(
    normalizeFieldInputValue(
      findFieldDefinition(['property', 'construction']),
      'Timber frame',
    ),
    'timber_frame',
  );
  const parsed = parseCommand('property/construction Timber frame');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  assert.equal(parsed.operation.operationId, SURVEY_OPERATIONS.setSingleChoice);
  assert.equal(parsed.operation.arguments.fieldId, PROPERTY_CONSTRUCTION_FORM_FIELD_ID);
  assert.equal(parsed.operation.arguments.value, 'timber_frame');
  assert.notEqual(parsed.operation.arguments.value, displayed);

  const committed = executeSurveyOperation(emptyBrief(), parsed.operation);
  assert.equal(
    resolveFieldValue(committed!.brief, PROPERTY_CONSTRUCTION_FORM_FIELD_ID),
    'timber_frame',
  );
  assert.equal(
    resolveFieldValue(committed!.brief, PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID),
    null,
  );
  assert.equal(reopenPropertyEntryValue(committed!.brief, ['property', 'construction']), 'timber_frame');

  const replacement = parseCommand('property/construction masonry');
  assert.equal(replacement.type, 'operation');
  if (replacement.type !== 'operation') return;
  const replaced = executeSurveyOperation(committed!.brief, replacement.operation);
  assert.equal(
    resolveFieldValue(replaced!.brief, PROPERTY_CONSTRUCTION_FORM_FIELD_ID),
    'masonry',
  );
  assert.equal(
    Object.keys(replaced!.brief.controlledFacts ?? {}).filter((id) =>
      id.startsWith('property.construction'),
    ).length,
    1,
  );

  const period = parseCommand('property/age 1945–1964');
  assert.equal(period.type, 'operation');
  if (period.type !== 'operation') return;
  const both = executeSurveyOperation(replaced!.brief, period.operation);
  assert.equal(
    resolveFieldValue(both!.brief, PROPERTY_CONSTRUCTION_FORM_FIELD_ID),
    'masonry',
  );
  assert.equal(
    resolveFieldValue(both!.brief, PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID),
    '1945_1964',
  );

  let job = withInspectionBrief(createInitialActiveJob(), both!.brief);
  const serialized = serializeActiveJob(job);
  assert.match(serialized, /"property.construction_form"/);
  assert.match(serialized, /masonry/);
  assert.equal(serialized.includes('Masonry'), false);
  const restored = deserializeActiveJob(serialized);
  assert.ok(restored);
  const restoredBrief = readActiveJobBrief(restored!);
  assert.equal(
    resolveFieldValue(restoredBrief, PROPERTY_CONSTRUCTION_FORM_FIELD_ID),
    'masonry',
  );
  assert.equal(
    resolveFieldValue(restoredBrief, PROPERTY_CONSTRUCTION_PERIOD_FIELD_ID),
    '1945_1964',
  );
  assert.equal(
    reopenPropertyEntryValue(restoredBrief, ['property', 'construction']),
    'masonry',
  );
  assert.deepEqual(restored!.inspection.findings, {});
});

