import assert from 'node:assert/strict';
import test from 'node:test';

import { getConceptByCanonicalField } from '../src/domain/ontology/muffle-ontology.v1';
import { parseCommand } from '../src/lib/command-parser';
import { findCommandNode } from '../src/lib/command-registry';
import { resolveDirectoryCompletion } from '../src/lib/completion';
import {
  resolveSvyrDataEntryType,
  SVYR_DATA_ENTRY_TYPES,
} from '../src/lib/data-entry-types';
import {
  findFieldDefinition,
  resolveFieldValue,
} from '../src/lib/field-schema';
import {
  executeSurveyOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
import {
  clearEntryDraft,
  readEntryDraft,
  stashEntryDraft,
} from '../src/lib/svyr-entry-drafts';
import type { InspectionBrief } from '../src/types/workspace';

const PREP_CAPTURE_ROUTES = [
  {
    path: ['prep', 'brief', 'instr', 'client'],
    fieldId: 'instruction.client',
    ontologyId: 'inspection_brief.instruction.client',
    setOperationId: SURVEY_OPERATIONS.setInstructionClient,
    value: 'Acme Ltd',
    briefKey: 'client' as const,
  },
  {
    path: ['prep', 'brief', 'instr', 'ref'],
    fieldId: 'instruction.reference',
    ontologyId: 'inspection_brief.instruction.reference',
    setOperationId: SURVEY_OPERATIONS.setInstructionReference,
    value: 'JOB-1042',
    briefKey: 'reference' as const,
  },
  {
    path: ['prep', 'brief', 'purp'],
    fieldId: 'purpose',
    ontologyId: 'inspection_brief.purpose',
    setOperationId: SURVEY_OPERATIONS.setPurpose,
    value: 'Level 2 Building Survey',
    briefKey: 'purpose' as const,
  },
  {
    path: ['prep', 'brief', 'deliv'],
    fieldId: 'deliverable',
    ontologyId: 'inspection_brief.deliverable',
    setOperationId: SURVEY_OPERATIONS.setDeliverable,
    value: 'RICS Home Survey',
    briefKey: 'deliverable' as const,
  },
  {
    path: ['prep', 'brief', 'limit'],
    fieldId: 'limitation',
    ontologyId: 'inspection_brief.limitation',
    setOperationId: SURVEY_OPERATIONS.setLimitation,
    value: 'No loft access.',
    briefKey: 'limitation' as const,
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

function recordedValue(
  brief: InspectionBrief,
  briefKey: (typeof PREP_CAPTURE_ROUTES)[number]['briefKey'],
): string | null {
  if (briefKey === 'client' || briefKey === 'reference') {
    return brief.instruction[briefKey];
  }
  return brief[briefKey];
}

test('activated PREP brief routes resolve as type 1 free-text capture', () => {
  for (const route of PREP_CAPTURE_ROUTES) {
    const node = findCommandNode([...route.path]);
    const field = findFieldDefinition([...route.path]);
    assert.ok(node, route.path.join('/'));
    assert.ok(field, route.path.join('/'));
    assert.equal(node?.requiresValue, true);
    assert.equal(field?.fieldId, route.fieldId);
    assert.equal(node?.fieldId, route.fieldId);
    assert.equal(node?.operationId, route.setOperationId);
    assert.equal(field?.operationId, route.setOperationId);
    assert.equal(resolveSvyrDataEntryType(field!), SVYR_DATA_ENTRY_TYPES.freeText);
  }
});

test('activated PREP brief routes parse to Engine operations not placeholders', () => {
  for (const route of PREP_CAPTURE_ROUTES) {
    const parsed = parseCommand(`${route.path.join('/')} ${route.value}`);
    assert.equal(parsed.type, 'operation', route.path.join('/'));
    if (parsed.type !== 'operation') continue;
    assert.equal(parsed.operation.operationId, route.setOperationId);
    assert.equal(parsed.operation.arguments.value, route.value);
  }
});

test('activated PREP brief commits write canonical brief values', () => {
  for (const route of PREP_CAPTURE_ROUTES) {
    const parsed = parseCommand(`${route.path.join('/')} ${route.value}`);
    assert.equal(parsed.type, 'operation');
    if (parsed.type !== 'operation') continue;
    const committed = executeSurveyOperation(emptyBrief(), parsed.operation);
    assert.ok(committed, route.path.join('/'));
    assert.equal(recordedValue(committed!.brief, route.briefKey), route.value);
    assert.equal(
      resolveFieldValue(committed!.brief, route.fieldId),
      route.value,
    );
  }
});

test('PREP brief drafts do not mutate the brief before commit', () => {
  const brief = emptyBrief();
  let drafts = {};
  for (const route of PREP_CAPTURE_ROUTES) {
    drafts = stashEntryDraft(drafts, [...route.path], route.value);
    assert.equal(readEntryDraft(drafts, [...route.path]), route.value);
    assert.equal(recordedValue(brief, route.briefKey), null);
  }
});

test('PREP brief cancel/back keeps a draft and does not commit', () => {
  const route = PREP_CAPTURE_ROUTES[0];
  const drafts = stashEntryDraft({}, [...route.path], route.value);
  assert.equal(readEntryDraft(drafts, [...route.path]), route.value);
  assert.equal(recordedValue(emptyBrief(), route.briefKey), null);
  assert.equal(
    executeSurveyOperation(emptyBrief(), {
      operationId: route.setOperationId,
      arguments: { value: '' },
    }),
    null,
  );
});

test('successful PREP brief commit clears that field draft', () => {
  const route = PREP_CAPTURE_ROUTES[2];
  let drafts = stashEntryDraft({}, [...route.path], route.value);
  const parsed = parseCommand(`${route.path.join('/')} ${route.value}`);
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  const committed = executeSurveyOperation(emptyBrief(), parsed.operation);
  assert.ok(committed);
  drafts = clearEntryDraft(drafts, [...route.path]);
  assert.equal(readEntryDraft(drafts, [...route.path]), undefined);
  assert.equal(committed!.brief.purpose, route.value);
});

test('PREP purpose completion updates from canonical brief state', () => {
  const before = resolveDirectoryCompletion(['prep', 'brief'], emptyBrief());
  const purposeBefore = before?.children.find((child) => child.token === 'purp');
  assert.equal(purposeBefore?.completed, 0);
  assert.equal(purposeBefore?.total, 1);

  const parsed = parseCommand('prep/brief/purp Level 2 Building Survey');
  assert.equal(parsed.type, 'operation');
  if (parsed.type !== 'operation') return;
  const committed = executeSurveyOperation(emptyBrief(), parsed.operation);
  const after = resolveDirectoryCompletion(['prep', 'brief'], committed!.brief);
  const purposeAfter = after?.children.find((child) => child.token === 'purp');
  assert.equal(purposeAfter?.completed, 1);
  assert.equal(purposeAfter?.total, 1);
});

test('activated PREP brief field IDs keep existing ontology semantics', () => {
  for (const route of PREP_CAPTURE_ROUTES) {
    const concept = getConceptByCanonicalField(route.fieldId);
    assert.ok(concept, route.fieldId);
    assert.equal(concept?.id, route.ontologyId);
    assert.equal(concept?.bindings?.canonicalFieldId, route.fieldId);
    assert.equal(concept?.maturity, 'engine-backed');
  }
});

test('independent PREP brief fields remain isolated after commit', () => {
  let brief = emptyBrief();
  for (const route of PREP_CAPTURE_ROUTES) {
    const parsed = parseCommand(`${route.path.join('/')} ${route.value}`);
    assert.equal(parsed.type, 'operation');
    if (parsed.type !== 'operation') return;
    const committed = executeSurveyOperation(brief, parsed.operation);
    assert.ok(committed);
    brief = committed!.brief;
  }
  assert.equal(brief.instruction.client, 'Acme Ltd');
  assert.equal(brief.instruction.reference, 'JOB-1042');
  assert.equal(brief.purpose, 'Level 2 Building Survey');
  assert.equal(brief.deliverable, 'RICS Home Survey');
  assert.equal(brief.limitation, 'No loft access.');
  assert.equal(brief.instruction.instructingParty, null);
  assert.equal(brief.instruction.source, null);
});

test('unavailable PREP workflows and blocked oil remain placeholders', () => {
  for (const command of [
    'prep/scope',
    'prep/access',
    'prep/equipment',
    'prep/plan',
    'prep/ready',
    'services/gas-oil/oil',
    'property/type',
    'external/porch',
  ]) {
    const parsed = parseCommand(command);
    assert.equal(parsed.type, 'placeholder', command);
  }
});
