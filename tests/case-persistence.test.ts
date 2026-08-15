import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CASE_PERSISTENCE_SCHEMA_VERSION,
  createEmptyInspectionCase,
  createMemoryCaseStorageAdapter,
  DEFAULT_CASE_STORAGE_KEY,
  deserializeCase,
  loadCase,
  removeCase,
  saveCase,
  serializeCase,
  type InspectionCase,
} from '../src/lib/case-persistence';
import { DEMO_EXTERNAL_WALL_FINDING } from '../src/lib/fixtures/demo-external-wall-finding';
import { DEMO_OX3_8SE_ADDRESSES } from '../src/lib/fixtures/demo-ox3-8se';

function createSampleCase(): InspectionCase {
  const address = DEMO_OX3_8SE_ADDRESSES[1].address;
  return {
    job: {
      property: {
        displayAddress: address.formattedAddress,
        address,
        instructionType: 'Level 2 Building Survey',
      },
      inspection: {
        findings: {
          [DEMO_EXTERNAL_WALL_FINDING.id]: { ...DEMO_EXTERNAL_WALL_FINDING },
        },
      },
    },
    brief: {
      instruction: {
        instructingParty: 'North & Co',
        client: 'Jane Doe',
        reference: 'REF-2026-001',
        source: 'email',
      },
      purpose: 'Pre-purchase level 2 survey',
      deliverable: 'Standard digital condition report',
      limitation: 'No access to locked loft space',
      fieldMeta: {
        'prep/brief/instr/party': { invalid: true },
      },
      controlledFacts: {
        'property.energy.mains-services.gas': 'present',
      },
      controlledFactSets: {
        'property.energy.heating.heat-emitters': ['radiators', 'underfloor'],
      },
    },
    notesByPath: {
      'prep/brief/instr/party': 'Client prefers morning contact.',
      'external/walls/observe': 'Checked from the rear garden.',
    },
  };
}

test('serializeCase and deserializeCase round-trip job and brief data', () => {
  const inspectionCase = createSampleCase();
  const restored = deserializeCase(serializeCase(inspectionCase));
  assert.ok(restored);
  assert.deepEqual(restored.job, inspectionCase.job);
  assert.deepEqual(restored.brief, inspectionCase.brief);
  assert.deepEqual(restored.notesByPath, inspectionCase.notesByPath);
});

test('serialized envelope carries the current schema version', () => {
  const payload = serializeCase(createSampleCase());
  const envelope = JSON.parse(payload) as {
    schemaVersion: number;
    job: unknown;
    brief: unknown;
    notesByPath: unknown;
  };
  assert.equal(envelope.schemaVersion, CASE_PERSISTENCE_SCHEMA_VERSION);
  assert.ok(envelope.job);
  assert.ok(envelope.brief);
  assert.ok(envelope.notesByPath);
});

test('loadCase returns null when storage is missing', async () => {
  const adapter = createMemoryCaseStorageAdapter();
  const loaded = await loadCase(adapter, DEFAULT_CASE_STORAGE_KEY);
  assert.equal(loaded, null);
});

test('corrupted JSON deserializes to null', () => {
  assert.equal(deserializeCase('{not-json'), null);
  assert.equal(deserializeCase('[]'), null);
  assert.equal(deserializeCase('"text"'), null);
});

test('unsupported schema version deserializes to null', () => {
  const payload = JSON.stringify({
    schemaVersion: CASE_PERSISTENCE_SCHEMA_VERSION + 1,
    job: createEmptyInspectionCase().job,
    brief: createEmptyInspectionCase().brief,
    notesByPath: createEmptyInspectionCase().notesByPath,
  });
  assert.equal(deserializeCase(payload), null);
});

test('saveCase and loadCase persist findings and brief fields', async () => {
  const adapter = createMemoryCaseStorageAdapter();
  const inspectionCase = createSampleCase();
  await saveCase(adapter, 'case-1', inspectionCase);
  const loaded = await loadCase(adapter, 'case-1');
  assert.ok(loaded);
  assert.deepEqual(
    loaded.job.inspection.findings[DEMO_EXTERNAL_WALL_FINDING.id],
    DEMO_EXTERNAL_WALL_FINDING,
  );
  assert.equal(loaded.brief.instruction.instructingParty, 'North & Co');
  assert.equal(loaded.brief.instruction.source, 'email');
  assert.deepEqual(loaded.brief.controlledFactSets, {
    'property.energy.heating.heat-emitters': ['radiators', 'underfloor'],
  });
  assert.deepEqual(loaded.notesByPath, inspectionCase.notesByPath);
});

test('removeCase clears stored payload', async () => {
  const adapter = createMemoryCaseStorageAdapter();
  await saveCase(adapter, 'case-1', createSampleCase());
  await removeCase(adapter, 'case-1');
  assert.equal(await loadCase(adapter, 'case-1'), null);
});

test('serializeCase does not mutate the input case', () => {
  const inspectionCase = createSampleCase();
  const snapshot = JSON.parse(JSON.stringify(inspectionCase)) as InspectionCase;
  serializeCase(inspectionCase);
  assert.deepEqual(inspectionCase, snapshot);
});

test('deserializeCase preserves unknown future-compatible envelope fields', () => {
  const inspectionCase = createSampleCase();
  const envelope = JSON.parse(serializeCase(inspectionCase)) as Record<
    string,
    unknown
  >;
  envelope.futureFeatureFlag = true;
  envelope.notes = { workspaceTheme: 'compact' };

  const restored = deserializeCase(JSON.stringify(envelope));
  assert.ok(restored);
  assert.deepEqual(restored.job, inspectionCase.job);
  assert.deepEqual(restored.brief, inspectionCase.brief);
  assert.deepEqual(restored.notesByPath, inspectionCase.notesByPath);
  assert.equal(restored.envelopeExtensions?.futureFeatureFlag, true);
  assert.deepEqual(restored.envelopeExtensions?.notes, {
    workspaceTheme: 'compact',
  });

  const roundTrip = JSON.parse(serializeCase(restored)) as Record<string, unknown>;
  assert.equal(roundTrip.futureFeatureFlag, true);
  assert.deepEqual(roundTrip.notes, { workspaceTheme: 'compact' });
});

test('deserializeCase preserves unknown future-compatible job fields', () => {
  const inspectionCase = createSampleCase();
  const envelope = JSON.parse(serializeCase(inspectionCase)) as {
    job: Record<string, unknown>;
    brief: unknown;
    schemaVersion: number;
  };
  envelope.job.workspaceRevision = 3;

  const restored = deserializeCase(JSON.stringify(envelope));
  assert.ok(restored);
  assert.equal(
    (restored.job as ActiveJobWithRevision).workspaceRevision,
    3,
  );
});

type ActiveJobWithRevision = InspectionCase['job'] & {
  workspaceRevision?: number;
};

test('notesByPath round-trips through serializeCase and saveCase', async () => {
  const inspectionCase = createSampleCase();
  const restored = deserializeCase(serializeCase(inspectionCase));
  assert.ok(restored);
  assert.deepEqual(restored.notesByPath, {
    'prep/brief/instr/party': 'Client prefers morning contact.',
    'external/walls/observe': 'Checked from the rear garden.',
  });

  const adapter = createMemoryCaseStorageAdapter();
  await saveCase(adapter, 'case-notes', inspectionCase);
  const loaded = await loadCase(adapter, 'case-notes');
  assert.ok(loaded);
  assert.deepEqual(loaded.notesByPath, inspectionCase.notesByPath);
});

test('invalid finding payload deserializes to null instead of partial findings', () => {
  const inspectionCase = createSampleCase();
  const envelope = JSON.parse(serializeCase(inspectionCase)) as {
    job: {
      inspection: {
        findings: Record<string, unknown>;
      };
    };
  };
  envelope.job.inspection.findings['finding.external-wall.2'] = {
    id: 'finding.external-wall.2',
    elementConceptId: 'building_element.external_wall',
  };

  assert.equal(deserializeCase(JSON.stringify(envelope)), null);
});

test('valid finding persistence remains unchanged', () => {
  const inspectionCase = createSampleCase();
  const restored = deserializeCase(serializeCase(inspectionCase));
  assert.ok(restored);
  assert.deepEqual(
    restored.job.inspection.findings[DEMO_EXTERNAL_WALL_FINDING.id],
    DEMO_EXTERNAL_WALL_FINDING,
  );
});
