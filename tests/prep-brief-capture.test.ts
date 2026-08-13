import assert from 'node:assert/strict';
import test from 'node:test';

import { getConceptByCanonicalField } from '../src/domain/ontology/muffle-ontology.v1';
import { parseEditableCommand } from '../src/lib/command-edit';
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
  applyActiveJobTransition,
  resolveHydratedActiveJob,
  shouldPersistActiveJob,
} from '../src/lib/active-job-state';
import {
  createInitialActiveJob,
  deserializeActiveJob,
  readActiveJobBrief,
  serializeActiveJob,
  withInspectionBrief,
} from '../src/lib/job-persistence';
import { suffixForPath } from '../src/lib/pin-context';
import {
  executeSurveyOperation,
  SURVEY_OPERATIONS,
} from '../src/lib/survey-operations';
import {
  clearEntryDraft,
  readEntryDraft,
  resolveDataEntryReentryDraft,
  stashEntryDraft,
  suffixForDataEntryReentry,
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
    'property/flat',
    'external/porch',
  ]) {
    const parsed = parseCommand(command);
    assert.equal(    parsed.type, 'placeholder', command);
  }
});

const PREP_PERSISTENCE_ROUTES = [
  {
    path: ['prep', 'brief', 'instr', 'client'],
    fieldId: 'instruction.client',
    setOperationId: SURVEY_OPERATIONS.setInstructionClient,
    value: 'CLIENT PERSISTENCE SMOKE',
    briefKey: 'client' as const,
  },
  {
    path: ['prep', 'brief', 'instr', 'ref'],
    fieldId: 'instruction.reference',
    setOperationId: SURVEY_OPERATIONS.setInstructionReference,
    value: 'REF PERSISTENCE SMOKE',
    briefKey: 'reference' as const,
  },
  {
    path: ['prep', 'brief', 'purp'],
    fieldId: 'purpose',
    setOperationId: SURVEY_OPERATIONS.setPurpose,
    value: 'PURPOSE PERSISTENCE SMOKE',
    briefKey: 'purpose' as const,
  },
  {
    path: ['prep', 'brief', 'deliv'],
    fieldId: 'deliverable',
    setOperationId: SURVEY_OPERATIONS.setDeliverable,
    value: 'DELIVERABLE PERSISTENCE SMOKE',
    briefKey: 'deliverable' as const,
  },
  {
    path: ['prep', 'brief', 'limit'],
    fieldId: 'limitation',
    setOperationId: SURVEY_OPERATIONS.setLimitation,
    value: 'LIMITATION PERSISTENCE SMOKE',
    briefKey: 'limitation' as const,
  },
] as const;

function commitPrepRoute(
  brief: InspectionBrief,
  route: (typeof PREP_PERSISTENCE_ROUTES)[number],
) {
  const parsed = parseCommand(`${route.path.join('/')} ${route.value}`);
  assert.equal(parsed.type, 'operation', route.fieldId);
  if (parsed.type !== 'operation') {
    throw new Error(`expected operation for ${route.fieldId}`);
  }
  const committed = executeSurveyOperation(brief, parsed.operation);
  assert.ok(committed, route.fieldId);
  return committed!;
}

function reopenPrepEntryValue(
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

test('PREP Type 1 fields survive Engine write, reopen, serialize, and hydration', () => {
  let brief = emptyBrief();
  let job = createInitialActiveJob();
  let drafts = {};

  for (const route of PREP_PERSISTENCE_ROUTES) {
    drafts = stashEntryDraft(drafts, [...route.path], route.value);
    assert.equal(readEntryDraft(drafts, [...route.path]), route.value);
    assert.equal(resolveFieldValue(brief, route.fieldId), null, route.fieldId);

    const committed = commitPrepRoute(brief, route);
    assert.equal(committed.brief === brief, false, `${route.fieldId} next brief`);
    brief = committed.brief;
    job = withInspectionBrief(job, brief);
    drafts = clearEntryDraft(drafts, [...route.path]);

    assert.equal(resolveFieldValue(brief, route.fieldId), route.value);
    assert.equal(recordedValue(brief, route.briefKey), route.value);
    assert.equal(readEntryDraft(drafts, [...route.path]), undefined);
    assert.equal(
      reopenPrepEntryValue(brief, route.path),
      route.value,
      `${route.fieldId} reopen`,
    );
  }

  assert.equal(brief.instruction.client, 'CLIENT PERSISTENCE SMOKE');
  assert.equal(brief.instruction.reference, 'REF PERSISTENCE SMOKE');
  assert.equal(brief.purpose, 'PURPOSE PERSISTENCE SMOKE');
  assert.equal(brief.deliverable, 'DELIVERABLE PERSISTENCE SMOKE');
  assert.equal(brief.limitation, 'LIMITATION PERSISTENCE SMOKE');

  const serialized = serializeActiveJob(job);
  assert.match(serialized, /CLIENT PERSISTENCE SMOKE/);
  assert.match(serialized, /"brief"/);
  const restored = deserializeActiveJob(serialized);
  assert.ok(restored);
  const restoredBrief = readActiveJobBrief(restored!);
  for (const route of PREP_PERSISTENCE_ROUTES) {
    assert.equal(resolveFieldValue(restoredBrief, route.fieldId), route.value);
    assert.equal(reopenPrepEntryValue(restoredBrief, route.path), route.value);
  }

  const hydrated = resolveHydratedActiveJob({
    restored,
    mutatedBeforeHydration: false,
  });
  assert.ok(hydrated);
  assert.equal(
    readActiveJobBrief(hydrated!).instruction.client,
    'CLIENT PERSISTENCE SMOKE',
  );
  assert.equal(shouldPersistActiveJob(true), true);
});

test('cancelled PREP Client draft does not become canonical or survive hydration', () => {
  const route = PREP_PERSISTENCE_ROUTES[0];
  const brief = emptyBrief();
  const drafts = stashEntryDraft({}, [...route.path], route.value);
  assert.equal(readEntryDraft(drafts, [...route.path]), route.value);
  assert.equal(resolveFieldValue(brief, route.fieldId), null);

  const job = createInitialActiveJob();
  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.equal(
    resolveFieldValue(readActiveJobBrief(restored!), route.fieldId),
    null,
  );
  assert.equal(
    reopenPrepEntryValue(readActiveJobBrief(restored!), route.path),
    undefined,
  );
});

test('ActiveJob brief commit uses the same next object for ref and state', () => {
  const route = PREP_PERSISTENCE_ROUTES[0];
  let refJob = createInitialActiveJob();
  let stateJob = refJob;
  const committed = commitPrepRoute(readActiveJobBrief(refJob), route);
  const next = applyActiveJobTransition(
    refJob,
    (current) => withInspectionBrief(current, committed.brief),
    (value) => {
      refJob = value;
      stateJob = value;
    },
  );
  assert.equal(refJob, next);
  assert.equal(stateJob, next);
  assert.equal(next.brief?.instruction.client, 'CLIENT PERSISTENCE SMOKE');
});

test('legacy ActiveJob payloads without brief still hydrate', () => {
  const raw = serializeActiveJob({
    id: 'job.legacy',
    property: { displayAddress: '18 Market Street' },
    inspection: { findings: {}, evidence: {} },
  });
  const restored = deserializeActiveJob(raw);
  assert.ok(restored);
  assert.equal(restored!.brief, undefined);
  assert.equal(readActiveJobBrief(restored!).instruction.client, null);
});
