import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findOntologyAliases,
  getOntologyConcept,
  serializeMuffleOntologyV1,
} from '../src/domain/ontology/muffle-ontology.v1';
import { getCommandAssistance, suggestionTokens } from '../src/lib/command-parser';
import { childNodes, findCommandNode } from '../src/lib/command-registry';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import {
  LEVEL_2_COVERAGE_MANIFEST,
  level2CoverageForRoute,
} from '../src/lib/level-2-capture';
import { commitInspectionFindingField } from '../src/lib/level-2-finding-capture';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import { notesPathKey } from '../src/lib/svyr-notes';
import type { InspectionBrief } from '../src/types/workspace';

const PREP_ROUTES = [
  'prep',
  'prep/brief',
  'prep/brief/instr',
  'prep/brief/instr/party',
  'prep/brief/instr/client',
  'prep/brief/instr/ref',
  'prep/brief/instr/source',
  'prep/brief/purp',
  'prep/brief/deliv',
  'prep/brief/limit',
];

function tokens(path: string[]): string[] {
  return childNodes(path).map(({ token }) => token);
}

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

test('PREP remains reachable and its established route tree is unchanged', () => {
  const rootSuggestions = getCommandAssistance('');
  assert.deepEqual(suggestionTokens(rootSuggestions), [
    'prep',
    'property',
    'external',
    'internal',
    'services',
    'grounds',
    'evidence',
    'summary',
    'report',
  ]);
  assert.ok(
    rootSuggestions.every(
      (suggestion) => suggestion.type !== 'token' || suggestion.available,
    ),
  );
  for (const route of PREP_ROUTES) {
    assert.ok(findCommandNode(route.split('/')), route);
  }
  assert.deepEqual(tokens(['prep']), [
    'brief',
    'scope',
    'access',
    'equipment',
    'plan',
    'ready',
  ]);
  assert.deepEqual(tokens(['prep', 'brief']), ['instr', 'purp', 'deliv', 'limit']);
  assert.deepEqual(tokens(['prep', 'brief', 'instr']), [
    'party',
    'client',
    'ref',
    'source',
  ]);
});

test('Level 2 section routes expose the complete inspection coverage shell', () => {
  assert.deepEqual(tokens(['property']), [
    'energy',
    'address',
    'type',
    'age',
    'extension',
    'conversion',
    'flat',
    'construction',
    'accommodation',
    'roof-spaces',
    'location',
  ]);
  assert.deepEqual(tokens(['property', 'energy']), ['heating', 'mains-services']);
  assert.deepEqual(tokens(['property', 'location']), [
    'grounds',
    'facilities',
    'environment',
  ]);
  assert.deepEqual(tokens(['external']), [
    'limitation',
    'chimney',
    'roof',
    'rainwater',
    'walls',
    'windows',
    'doors',
    'porch',
    'joinery',
    'other',
  ]);
  assert.deepEqual(tokens(['internal']), [
    'limitation',
    'roof-structure',
    'ceilings',
    'walls-partitions',
    'floors',
    'fireplaces-flues',
    'built-ins',
    'woodwork',
    'bathroom',
    'other',
  ]);
  assert.deepEqual(tokens(['services']), [
    'limitation',
    'electricity',
    'gas-oil',
    'water',
    'heating',
    'water-heating',
    'drainage',
    'common',
  ]);
  assert.deepEqual(tokens(['grounds']), [
    'limitation',
    'garage',
    'outbuildings',
    'other',
  ]);
});

test('coverage manifest is deterministic and distinguishes capture boundaries', () => {
  assert.equal(
    JSON.stringify(LEVEL_2_COVERAGE_MANIFEST),
    JSON.stringify([...LEVEL_2_COVERAGE_MANIFEST]),
  );
  assert.equal(level2CoverageForRoute('property/address')?.status, 'pre-populated');
  assert.equal(level2CoverageForRoute('external/walls')?.status, 'interactive');
  assert.equal(level2CoverageForRoute('external/windows')?.status, 'navigation-only');
  assert.equal(
    level2CoverageForRoute('services/electricity')?.status,
    'interactive',
  );
  assert.equal(level2CoverageForRoute('summary')?.status, 'derived-publication');
  assert.equal(level2CoverageForRoute('report')?.status, 'derived-publication');
  assert.equal(
    new Set(LEVEL_2_COVERAGE_MANIFEST.map(({ route }) => route)).size,
    LEVEL_2_COVERAGE_MANIFEST.length,
  );
});

test('interactive Level 2 routes remain explicitly bounded', () => {
  const interactive = LEVEL_2_COVERAGE_MANIFEST.filter(
    ({ status }) => status === 'interactive',
  ).map(({ route }) => route);
  assert.deepEqual(interactive, [
    'prep',
    'property/energy/heating',
    'property/energy/heating/system-type',
    'property/energy/heating/fuel-source',
    'property/energy/heating/boiler-make-model',
    'property/energy/heating/installation-year',
    'property/energy/heating/controls',
    'property/energy/heating/heat-emitters',
    'property/energy/heating/hot-water',
    'property/energy/heating/secondary-heating',
    'property/energy/heating/condition',
    'property/energy/heating/defects',
    'property/energy/mains-services',
    'property/energy/mains-services/gas',
    'property/energy/mains-services/electricity',
    'property/energy/mains-services/water',
    'property/energy/mains-services/drainage',
    'external/walls',
    'external/walls/observe',
    'external/walls/condition',
    'external/walls/defect',
    'external/walls/recommend',
    'external/walls/evidence',
    'services/electricity',
    'services/electricity/presence',
    'services/electricity/observe',
    'services/electricity/defect',
    'services/electricity/recommend',
    'services/gas-oil/gas',
    'services/gas-oil/gas/presence',
    'services/gas-oil/gas/observe',
    'services/gas-oil/gas/defect',
    'services/gas-oil/gas/recommend',
    'services/water',
    'services/water/presence',
    'services/water/observe',
    'services/water/defect',
    'services/water/recommend',
    'services/heating',
    'services/heating/observe',
    'services/heating/defect',
    'services/heating/recommend',
    'services/water-heating',
    'services/water-heating/observe',
    'services/water-heating/defect',
    'services/water-heating/recommend',
    'services/drainage',
    'services/drainage/presence',
    'services/drainage/observe',
    'services/drainage/defect',
    'services/drainage/recommend',
  ]);

  for (const token of ['observe', 'condition', 'defect', 'recommend', 'evidence']) {
    const node = findCommandNode(['external', 'walls', token]);
    assert.equal(node?.requiresValue, true, token);
    assert.ok(node?.findingTarget, token);
  }
  for (const route of [
    ['property', 'construction'],
    ['external', 'windows'],
    ['internal', 'ceilings'],
    ['services', 'common'],
    ['grounds', 'garage'],
  ]) {
    const node = findCommandNode(route);
    assert.equal(node?.workflowOnly, true, route.join('/'));
    assert.equal(node?.operationId, undefined, route.join('/'));
    assert.equal(node?.findingTarget, undefined, route.join('/'));
  }
  assert.deepEqual(getCommandAssistance('external/windows'), []);
});

test('supported finding leaves commit through the existing finding operation', () => {
  const observe = findCommandNode(['external', 'walls', 'observe'])?.findingTarget;
  const condition = findCommandNode(['external', 'walls', 'condition'])?.findingTarget;
  const evidence = findCommandNode(['external', 'walls', 'evidence'])?.findingTarget;
  assert.ok(observe);
  assert.ok(condition);
  assert.ok(evidence);

  const premature = commitInspectionFindingField(
    createEmptyInspectionRecord(),
    condition,
    'Weathered masonry',
  );
  assert.deepEqual(premature, {
    ok: false,
    message: 'Record observation first',
  });

  const created = commitInspectionFindingField(
    createEmptyInspectionRecord(),
    observe,
    'Stepped cracking above the opening.',
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.result.operationId, 'survey.inspection.finding.upsert');

  const conditioned = commitInspectionFindingField(
    created.result.inspection,
    condition,
    'Localised visible movement.',
  );
  assert.equal(conditioned.ok, true);
  if (!conditioned.ok) return;

  const evidenced = commitInspectionFindingField(
    conditioned.result.inspection,
    evidence,
    'photo-001',
  );
  assert.equal(evidenced.ok, true);
  if (!evidenced.ok) return;
  assert.deepEqual(evidenced.result.finding.evidence, [{ id: 'photo-001' }]);
});

test('workflow coverage does not change completion, notes, or ontology semantics', () => {
  const ontologyBefore = serializeMuffleOntologyV1();
  const completion = resolveDirectoryCompletion(['prep', 'brief'], emptyBrief());
  assert.deepEqual(
    completion?.children.map(({ token, completed, total }) => ({
      token,
      completed,
      total,
    })),
    [
      { token: 'instr', completed: 0, total: 2 },
      { token: 'purp', completed: 0, total: 1 },
      { token: 'deliv', completed: 0, total: 1 },
      { token: 'limit', completed: 0, total: 1 },
    ],
  );
  assert.equal(notesPathKey(['external', 'walls', 'observe']), 'external/walls/observe');
  assert.equal(serializeMuffleOntologyV1(), ontologyBefore);

  for (const code of ['D1', 'D4', 'E2', 'F1', 'G1']) {
    assert.equal(getOntologyConcept(code), undefined, code);
  }
  assert.equal(findOntologyAliases('Main Walls').length, 0);
  assert.equal(getOntologyConcept('building_element.floor'), undefined);
  assert.equal(getOntologyConcept('building_element.garage'), undefined);
});
