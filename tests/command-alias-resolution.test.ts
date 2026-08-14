import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCommand } from '../src/lib/command-parser';
import {
  findCommandNode,
  parseSvyrInput,
  resolveCommandToken,
  walkCommandPath,
} from '../src/lib/command-registry';
import { parseEditableCommand } from '../src/lib/command-edit';

test('exact canonical tokens win over global aliases', () => {
  const siblings = ['limitation', 'chimney', 'walls'];
  assert.equal(resolveCommandToken('limitation', siblings), 'limitation');
  assert.equal(resolveCommandToken('limitations', siblings), undefined);
  assert.equal(resolveCommandToken('limitation', ['limit']), 'limit');
  assert.equal(resolveCommandToken('limitations', ['limit']), 'limit');
});

test('external/limitation resolves to the controlled text capture node', () => {
  const node = findCommandNode(['external', 'limitation']);
  assert.ok(node);
  assert.equal(node?.token, 'limitation');
  assert.equal(node?.workflowOnly, undefined);
  assert.equal(node?.operationId, 'survey.controlled_fact.set');
  assert.equal(node?.fieldId, 'inspection.section.external.limitation');
  assert.equal(node?.findingTarget, undefined);
  assert.equal(node?.evidenceCaptureTarget, undefined);

  const parsed = parseCommand('external/limitation Rear elevation obscured.');
  assert.equal(parsed.type, 'operation');
  if (parsed.type === 'operation') {
    assert.deepEqual(parsed.path, ['external', 'limitation']);
    assert.equal(parsed.operation.arguments.fieldId, 'inspection.section.external.limitation');
  }

  const walk = walkCommandPath(['external', 'limitation']);
  assert.deepEqual(walk.path, ['external', 'limitation']);
  assert.equal(walk.node?.token, 'limitation');

  assert.deepEqual(parseSvyrInput('external/limitation').path, [
    'external',
    'limitation',
  ]);
});

test('PREP limitation aliases still resolve to the brief limit field', () => {
  const aliased = parseCommand('prep/brief/limitation');
  assert.equal(aliased.type, 'operation');
  if (aliased.type === 'operation') {
    assert.deepEqual(aliased.path, ['prep', 'brief', 'limit']);
    assert.equal(aliased.operation.operationId, 'survey.brief.limitation.read');
  }

  const plural = parseCommand('prep/brief/limitations');
  assert.equal(plural.type, 'operation');
  if (plural.type === 'operation') {
    assert.deepEqual(plural.path, ['prep', 'brief', 'limit']);
  }

  const canonical = parseCommand('prep/brief/limit');
  assert.equal(canonical.type, 'operation');
  if (canonical.type === 'operation') {
    assert.deepEqual(canonical.path, ['prep', 'brief', 'limit']);
  }
});

test('editable command keeps exact limitation token on External', () => {
  const parsed = parseEditableCommand('external/limitation');
  assert.deepEqual(parsed.structuredTokens, ['external', 'limitation']);
  assert.equal(parsed.trailingPartial, '');
});
