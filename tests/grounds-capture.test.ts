import assert from 'node:assert/strict';
import test from 'node:test';

import { getOntologyConcept } from '../src/domain/ontology/muffle-ontology.v1';
import { parseCommand } from '../src/lib/command-parser';
import { childNodes, findCommandNode } from '../src/lib/command-registry';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import { allFindingCaptureConfigs } from '../src/lib/survey-capability';
import { isInspectionElementConceptId } from '../src/lib/inspection-finding-elements';
import type { InspectionBrief } from '../src/types/workspace';

const GROUNDS_LEAVES = [
  ['grounds', 'limitation'],
  ['grounds', 'garage'],
  ['grounds', 'outbuildings'],
  ['grounds', 'other'],
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

test('Grounds parent remains navigation and has no capture leaves', () => {
  const parent = findCommandNode(['grounds']);
  assert.ok(parent);
  assert.equal(parent?.coverage?.status, 'navigation-only');
  assert.equal(parent?.findingTarget, undefined);
  assert.deepEqual(
    childNodes(['grounds']).map((child) => child.token),
    ['limitation', 'garage', 'outbuildings', 'other'],
  );
});

test('Grounds leaves stay workflow placeholders without Type 6/7 capture', () => {
  for (const path of GROUNDS_LEAVES) {
    const node = findCommandNode([...path]);
    assert.ok(node, path.join('/'));
    assert.equal(node?.workflowOnly, true, path.join('/'));
    assert.equal(node?.findingTarget, undefined, path.join('/'));
    assert.equal(node?.evidenceCaptureTarget, undefined, path.join('/'));
    assert.equal(node?.operationId, undefined, path.join('/'));
    assert.equal(node?.fieldId, undefined, path.join('/'));
    assert.equal(findCommandNode([...path, 'observe']), null, path.join('/'));
    assert.equal(findCommandNode([...path, 'photo']), null, path.join('/'));
    assert.notEqual(parseCommand(path.join('/')).type, 'operation', path.join('/'));
  }
});

test('no canonical Grounds inspection concepts exist in ontology or runtime', () => {
  for (const id of [
    'building_element.garage',
    'building_element.outbuilding',
    'building_element.boundary',
    'building_element.driveway',
    'building_element.path',
    'building_element.patio',
    'building_element.retaining_wall',
  ]) {
    assert.equal(getOntologyConcept(id), undefined, id);
    assert.equal(isInspectionElementConceptId(id), false, id);
  }
});

test('Grounds garage is not External wall and outbuildings are not a second garage subject', () => {
  const garage = findCommandNode(['grounds', 'garage']);
  const outbuildings = findCommandNode(['grounds', 'outbuildings']);
  const walls = findCommandNode(['external', 'walls']);
  assert.notEqual(
    garage?.coverage?.canonicalConceptId,
    walls?.coverage?.canonicalConceptId,
  );
  assert.equal(garage?.coverage?.canonicalConceptId, undefined);
  assert.equal(outbuildings?.coverage?.canonicalConceptId, undefined);
  assert.notEqual(garage?.token, outbuildings?.token);
});

test('Property location/grounds remains a blocked description leaf, not Grounds capture', () => {
  const locationGrounds = findCommandNode(['property', 'location', 'grounds']);
  const inspectionGrounds = findCommandNode(['grounds']);
  assert.equal(locationGrounds?.workflowOnly, true);
  assert.equal(locationGrounds?.findingTarget, undefined);
  assert.notEqual(locationGrounds, inspectionGrounds);
  assert.equal(findCommandNode(['property', 'location', 'grounds', 'observe']), null);
});

test('finding configuration does not invent Grounds finding IDs', () => {
  for (const config of allFindingCaptureConfigs()) {
    assert.equal(config.route[0] === 'grounds', false, config.findingId);
    assert.match(config.findingId, /^(finding\.(external-wall|chimney|rainwater-goods|window|ceiling|service)\.)/);
  }
});

test('Grounds directory completion stays 0/0', () => {
  const completion = resolveDirectoryCompletion(['grounds'], emptyBrief());
  assert.equal(completion?.completed, 0);
  assert.equal(completion?.total, 0);
});
