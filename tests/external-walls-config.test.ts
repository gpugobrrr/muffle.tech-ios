import assert from 'node:assert/strict';
import test from 'node:test';

import { findCommandNode, childNodes } from '../src/lib/command-registry';
import {
  EXTERNAL_WALL_FINDING_LEAVES,
  EXTERNAL_WALL_FINDING_ID,
  EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
} from '../src/lib/level-2-capture';

test('External Walls configuration asserts', () => {
  const expectedTokens = [
    'observe',
    'condition',
    'defect',
    'recommend',
    'limit',
    'further',
    'risk',
    'evidence',
  ];

  // 1. The configuration has exactly the eight tokens above, in order
  const configTokens = EXTERNAL_WALL_FINDING_LEAVES.map((l) => l.token);
  assert.deepEqual(configTokens, expectedTokens);

  // 2. Generated External Walls registry children match the configuration
  const registryNodes = childNodes(['external', 'walls']);
  const registryTokens = registryNodes.map((n) => n.token);
  assert.deepEqual(registryTokens, expectedTokens);

  // 3. Finding targets retain the existing finding ID, element ID, fields and operations
  const findingLeaves = EXTERNAL_WALL_FINDING_LEAVES.filter((l) => l.kind === 'finding');
  for (const leaf of findingLeaves) {
    const node = findCommandNode(['external', 'walls', leaf.token]);
    assert.ok(node, `Node missing for token ${leaf.token}`);
    assert.equal(node.requiresValue, true);
    assert.equal(node.optional, true);

    const target = node.findingTarget;
    assert.ok(target, `Finding target missing for token ${leaf.token}`);
    assert.equal(target.findingId, EXTERNAL_WALL_FINDING_ID);
    assert.equal(target.elementConceptId, EXTERNAL_WALL_ELEMENT_CONCEPT_ID);
    assert.equal(target.field, leaf.field);

    assert.equal(node.coverage?.engineBinding, 'survey.inspection.finding.upsert');
    assert.equal(node.coverage?.status, 'interactive');
  }

  // 4. Workflow-only leaves retain their existing coverage metadata
  const workflowLeaves = EXTERNAL_WALL_FINDING_LEAVES.filter((l) => l.kind === 'workflow');
  for (const leaf of workflowLeaves) {
    const node = findCommandNode(['external', 'walls', leaf.token]);
    assert.ok(node, `Node missing for token ${leaf.token}`);
    assert.equal(node.workflowOnly, true);
    
    // Check coverage matching what's defined in the config leaf
    assert.deepEqual(node.coverage, leaf.coverage);
  }
});
