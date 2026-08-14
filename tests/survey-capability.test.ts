import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCommand } from '../src/lib/command-parser';
import { findCommandNode } from '../src/lib/command-registry';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import { SVYR_DATA_ENTRY_TYPES } from '../src/lib/data-entry-types';
import { EXTERNAL_FINDING_CONFIGS } from '../src/lib/external-findings';
import { findFieldDefinition } from '../src/lib/field-schema';
import { INTERNAL_FINDING_CONFIGS } from '../src/lib/internal-findings';
import { MAINS_SERVICE_FIELD_IDS } from '../src/lib/property-energy-mains-services';
import {
  SERVICES_FINDING_CONFIGS,
  SERVICES_GAS_FINDING_CONFIG,
} from '../src/lib/services-findings';
import {
  BLOCKED_ROUTE_REASONS,
  allFindingCaptureConfigs,
  capabilityForCommand,
  capabilityForRoute,
  ontologyConceptIsTypeOnly,
  surveyCapabilityCensus,
  SURVEY_BLOCKED_REASONS,
  SURVEY_CAPABILITY_KINDS,
  validateSurveyCapabilities,
} from '../src/lib/survey-capability';
import type { InspectionBrief } from '../src/types/workspace';

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

test('every governed route has exactly one capability kind and unclassified is 0', () => {
  const census = surveyCapabilityCensus();
  assert.equal(census.unclassified, 0);
  assert.equal(census.total, 190);
  assert.equal(census.capture, 134);
  assert.equal(census.navigation, 29);
  assert.equal(census.derived, 2);
  assert.equal(census.blocked, 25);
  assert.equal(
    census.total,
    census.capture + census.navigation + census.derived + census.blocked,
  );
  const kinds = new Map<string, string>();
  for (const capability of census.capabilities) {
    const existing = kinds.get(capability.route);
    assert.equal(existing, undefined, capability.route);
    kinds.set(capability.route, capability.kind);
    assert.notEqual(capability.kind, 'unclassified');
  }
});

test('capability validation reports no configuration drift', () => {
  const issues = validateSurveyCapabilities();
  assert.deepEqual(issues, []);
});

test('PREP brief fields are canonical Type 1 capture', () => {
  for (const route of [
    'prep/brief/instr/client',
    'prep/brief/instr/ref',
    'prep/brief/purp',
    'prep/brief/deliv',
    'prep/brief/limit',
  ]) {
    const capability = capabilityForRoute(route);
    assert.equal(capability?.kind, SURVEY_CAPABILITY_KINDS.capture, route);
    assert.equal(capability?.captureType, SVYR_DATA_ENTRY_TYPES.freeText, route);
    assert.ok(capability?.fieldId, route);
    assert.ok(capability?.operationId, route);
    assert.ok(findFieldDefinition(route.split('/')), route);
  }
});

test('Property energy fields remain canonical Types 3–5 capture', () => {
  const heating = capabilityForRoute('property/energy/heating');
  assert.equal(heating?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(heating?.captureType, SVYR_DATA_ENTRY_TYPES.compoundGroup);
  const mains = capabilityForRoute('property/energy/mains-services');
  assert.equal(mains?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(mains?.captureType, SVYR_DATA_ENTRY_TYPES.compoundGroup);
  const gas = capabilityForRoute('property/energy/mains-services/gas');
  assert.equal(gas?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(gas?.captureType, SVYR_DATA_ENTRY_TYPES.controlledFact);
  assert.equal(gas?.fieldId, MAINS_SERVICE_FIELD_IDS.gas);
});

test('Property description Type 2/4 routes are capture and remaining description routes stay blocked', () => {
  assert.equal(capabilityForRoute('property/type')?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(capabilityForRoute('property/age')?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(capabilityForRoute('property/extension')?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(capabilityForRoute('property/conversion')?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(capabilityForRoute('property/construction')?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(capabilityForRoute('property/construction')?.captureType, SVYR_DATA_ENTRY_TYPES.singleChoice);
  assert.equal(capabilityForRoute('property/construction')?.fieldId, 'property.construction_form');
  assert.equal(capabilityForRoute('property/address')?.kind, SURVEY_CAPABILITY_KINDS.navigation);
  const blocked = {
    'property/flat': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
    'property/accommodation': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
    'property/roof-spaces': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
    'property/location': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
    'property/location/facilities': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
    'property/location/environment': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
  } as const;
  for (const [route, reason] of Object.entries(blocked)) {
    const capability = capabilityForRoute(route);
    assert.equal(capability?.kind, SURVEY_CAPABILITY_KINDS.blocked, route);
    assert.equal(capability?.blockedReason, reason, route);
  }
});

test('External finding configs are Type 6/7 capture', () => {
  for (const config of EXTERNAL_FINDING_CONFIGS) {
    const parent = capabilityForRoute(config.route);
    assert.equal(parent?.kind, SURVEY_CAPABILITY_KINDS.navigation, config.label);
    const observe = capabilityForRoute([...config.route, 'observe']);
    assert.equal(observe?.kind, SURVEY_CAPABILITY_KINDS.capture, config.label);
    assert.equal(observe?.captureType, SVYR_DATA_ENTRY_TYPES.findingCapture);
    assert.equal(observe?.findingId, config.findingId);
    assert.equal(observe?.elementConceptId, config.elementConceptId);
    const photo = capabilityForRoute([...config.route, 'photo']);
    assert.equal(photo?.kind, SURVEY_CAPABILITY_KINDS.capture, config.label);
    assert.equal(photo?.captureType, SVYR_DATA_ENTRY_TYPES.evidenceCapture);
    assert.equal(photo?.findingId, config.findingId);
    assert.equal(photo?.elementConceptId, config.elementConceptId);
  }
});

test('Services findings remain canonical Type 6/7 and oil stays blocked', () => {
  for (const config of [...SERVICES_FINDING_CONFIGS, SERVICES_GAS_FINDING_CONFIG]) {
    const observe = capabilityForRoute([...config.route, 'observe']);
    assert.equal(observe?.findingId, config.findingId, config.label);
    assert.equal(observe?.elementConceptId, config.elementConceptId, config.label);
    assert.equal(observe?.captureType, SVYR_DATA_ENTRY_TYPES.findingCapture);
    const photo = capabilityForRoute([...config.route, 'photo']);
    assert.equal(photo?.captureType, SVYR_DATA_ENTRY_TYPES.evidenceCapture);
    assert.equal(photo?.findingId, config.findingId);
  }
  const oil = capabilityForRoute('services/gas-oil/oil');
  assert.equal(oil?.kind, SURVEY_CAPABILITY_KINDS.blocked);
  assert.equal(oil?.blockedReason, SURVEY_BLOCKED_REASONS.intentionallyUnsupported);
  assert.equal(parseCommand('services/gas-oil/oil').type, 'placeholder');
  assert.equal(findCommandNode(['services', 'gas-oil', 'oil', 'observe']), null);
});

test('remaining External unresolved routes stay blocked with reasons', () => {
  const expected = {
    'external/joinery': SURVEY_BLOCKED_REASONS.publicationGrouping,
    'external/other': SURVEY_BLOCKED_REASONS.publicationGrouping,
  } as const;
  for (const [route, reason] of Object.entries(expected)) {
    const capability = capabilityForRoute(route);
    assert.equal(capability?.kind, SURVEY_CAPABILITY_KINDS.blocked, route);
    assert.equal(capability?.blockedReason, reason, route);
    assert.equal(BLOCKED_ROUTE_REASONS[route], reason);
    const parsed = parseCommand(route);
    assert.notEqual(parsed.type, 'operation', route);
    const node = findCommandNode(route.split('/'));
    assert.equal(node?.operationId, undefined, route);
    assert.equal(node?.findingTarget, undefined, route);
    assert.equal(node?.fieldId, undefined, route);
  }
  assert.equal(ontologyConceptIsTypeOnly('building_element.porch'), false);
  assert.equal(ontologyConceptIsTypeOnly('building_element.chimney'), false);
});

test('External walls finding-level limit, further, and risk are Type 6 capture', () => {
  const walls = EXTERNAL_FINDING_CONFIGS.find((config) => config.routeId === 'walls');
  assert.ok(walls);
  const expected = {
    'external/walls/limit': 'limitation',
    'external/walls/further': 'furtherInvestigation',
    'external/walls/risk': 'risk',
  } as const;
  for (const [route, field] of Object.entries(expected)) {
    const capability = capabilityForRoute(route);
    assert.equal(capability?.kind, SURVEY_CAPABILITY_KINDS.capture, route);
    assert.equal(capability?.captureType, SVYR_DATA_ENTRY_TYPES.findingCapture, route);
    assert.equal(capability?.findingId, walls.findingId, route);
    assert.equal(capability?.elementConceptId, walls.elementConceptId, route);
    assert.equal(capability?.operationId, 'survey.inspection.finding.upsert', route);
    assert.equal(capability?.optional, true, route);
    const node = findCommandNode(route.split('/'));
    assert.equal(node?.findingTarget?.field, field, route);
    assert.equal(node?.findingTarget?.findingId, 'finding.external-wall.1', route);
    assert.equal(
      node?.findingTarget?.elementConceptId,
      'building_element.external_wall',
      route,
    );
  }
  const sectionLimitation = capabilityForRoute('external/limitation');
  assert.equal(sectionLimitation?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(sectionLimitation?.captureType, SVYR_DATA_ENTRY_TYPES.controlledFact);
  assert.equal(sectionLimitation?.fieldId, 'inspection.section.external.limitation');
});

test('aliases resolve to the canonical capability without duplicating it', () => {
  const prepAlias = capabilityForCommand('prep/brief/limitation');
  const prepCanonical = capabilityForRoute('prep/brief/limit');
  assert.equal(prepAlias?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(prepAlias?.route, 'prep/brief/limit');
  assert.equal(prepAlias?.fieldId, prepCanonical?.fieldId);
  const externalLimitation = capabilityForCommand('external/limitation');
  assert.equal(externalLimitation?.kind, SURVEY_CAPABILITY_KINDS.capture);
  assert.equal(externalLimitation?.route, 'external/limitation');
  assert.equal(externalLimitation?.fieldId, 'inspection.section.external.limitation');
});

test('Property and Services mains presence share one canonical field ID', () => {
  const propertyGas = capabilityForRoute('property/energy/mains-services/gas');
  const servicesGas = capabilityForRoute('services/gas-oil/gas/presence');
  assert.equal(propertyGas?.fieldId, MAINS_SERVICE_FIELD_IDS.gas);
  assert.equal(servicesGas?.fieldId, MAINS_SERVICE_FIELD_IDS.gas);
  assert.equal(propertyGas?.fieldId, servicesGas?.fieldId);
  const propertyWater = capabilityForRoute('property/energy/mains-services/water');
  const servicesWater = capabilityForRoute('services/water/presence');
  assert.equal(propertyWater?.fieldId, servicesWater?.fieldId);
});

test('Internal finding configs are Type 6/7 capture', () => {
  for (const config of INTERNAL_FINDING_CONFIGS) {
    const parent = capabilityForRoute(config.route);
    assert.equal(parent?.kind, SURVEY_CAPABILITY_KINDS.navigation, config.label);
    const observe = capabilityForRoute([...config.route, 'observe']);
    assert.equal(observe?.kind, SURVEY_CAPABILITY_KINDS.capture, config.label);
    assert.equal(observe?.captureType, SVYR_DATA_ENTRY_TYPES.findingCapture);
    assert.equal(observe?.findingId, config.findingId);
    assert.equal(observe?.elementConceptId, config.elementConceptId);
    const photo = capabilityForRoute([...config.route, 'photo']);
    assert.equal(photo?.kind, SURVEY_CAPABILITY_KINDS.capture, config.label);
    assert.equal(photo?.captureType, SVYR_DATA_ENTRY_TYPES.evidenceCapture);
    assert.equal(photo?.findingId, config.findingId);
  }
});

test('remaining Internal unresolved routes stay blocked with reasons', () => {
  const expected = {
    'internal/fireplaces-flues': SURVEY_BLOCKED_REASONS.ontologyTypeOnly,
    'internal/built-ins': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
    'internal/woodwork': SURVEY_BLOCKED_REASONS.ontologyTypeOnly,
    'internal/other': SURVEY_BLOCKED_REASONS.publicationGrouping,
  } as const;
  for (const [route, reason] of Object.entries(expected)) {
    const capability = capabilityForRoute(route);
    assert.equal(capability?.kind, SURVEY_CAPABILITY_KINDS.blocked, route);
    assert.equal(capability?.blockedReason, reason, route);
    const node = findCommandNode(route.split('/'));
    assert.equal(node?.operationId, undefined, route);
    assert.equal(node?.findingTarget, undefined, route);
  }
  assert.equal(ontologyConceptIsTypeOnly('building_element.fireplace'), true);
  assert.equal(ontologyConceptIsTypeOnly('building_element.staircase'), true);
  assert.equal(ontologyConceptIsTypeOnly('building_element.ceiling'), false);
});

test('remaining Grounds unresolved routes stay blocked with reasons', () => {
  const expected = {
    'grounds/limitation': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
    'grounds/garage': SURVEY_BLOCKED_REASONS.unresolvedSubjectScope,
    'grounds/outbuildings': SURVEY_BLOCKED_REASONS.unresolvedSubjectScope,
    'grounds/other': SURVEY_BLOCKED_REASONS.publicationGrouping,
    'property/location/grounds': SURVEY_BLOCKED_REASONS.unresolvedSubjectScope,
  } as const;
  for (const [route, reason] of Object.entries(expected)) {
    const capability = capabilityForRoute(route);
    assert.equal(capability?.kind, SURVEY_CAPABILITY_KINDS.blocked, route);
    assert.equal(capability?.blockedReason, reason, route);
    const node = findCommandNode(route.split('/'));
    assert.equal(node?.operationId, undefined, route);
    assert.equal(node?.findingTarget, undefined, route);
  }
  assert.equal(capabilityForRoute('grounds')?.kind, SURVEY_CAPABILITY_KINDS.navigation);
});

test('finding configs remain the single finding identity source', () => {
  const configs = allFindingCaptureConfigs();
  const ids = configs.map((config) => config.findingId);
  assert.equal(new Set(ids).size, ids.length);
  for (const config of [...EXTERNAL_FINDING_CONFIGS, ...INTERNAL_FINDING_CONFIGS]) {
    assert.equal(
      configs.some((item) => item === config),
      true,
      config.label,
    );
  }
});

test('derived summary and report do not capture', () => {
  assert.equal(capabilityForRoute('summary')?.kind, SURVEY_CAPABILITY_KINDS.derived);
  assert.equal(capabilityForRoute('report')?.kind, SURVEY_CAPABILITY_KINDS.derived);
  assert.equal(parseCommand('summary').type, 'placeholder');
});

test('capability classification does not change External or Internal completion', () => {
  const external = resolveDirectoryCompletion(['external'], emptyBrief());
  assert.equal(external?.completed, 0);
  assert.equal(external?.total, 0);
  const internal = resolveDirectoryCompletion(['internal'], emptyBrief());
  assert.equal(internal?.completed, 0);
  assert.equal(internal?.total, 0);
});
