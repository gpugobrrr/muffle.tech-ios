import assert from 'node:assert/strict';
import test from 'node:test';

import { findCommandNode } from '../src/lib/command-registry';
import {
  commitInspectionFindingField,
  FINDING_CAPTURE_FIELDS,
  isFindingCaptureNode,
  isFindingCaptureTarget,
  resolveFindingFieldValue,
  SURVEY_FINDING_UPSERT,
} from '../src/lib/finding-capture';
import {
  isFindingCaptureEntry,
  resolveSvyrNodeDataEntryType,
  SVYR_DATA_ENTRY_TYPES,
} from '../src/lib/data-entry-types';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import { DEMO_EXTERNAL_WALL_FINDING } from '../src/lib/fixtures/demo-external-wall-finding';
import {
  SERVICES_FINDING_CONFIGS,
  SERVICES_GAS_FINDING_CONFIG,
  servicesFindingConfig,
} from '../src/lib/services-findings';

test('finding capture leaves resolve to data entry type 6', () => {
  const externalObserve = findCommandNode(['external', 'walls', 'observe']);
  const servicesObserve = findCommandNode(['services', 'electricity', 'observe']);
  assert.ok(externalObserve);
  assert.ok(servicesObserve);
  assert.equal(isFindingCaptureNode(externalObserve), true);
  assert.equal(isFindingCaptureNode(servicesObserve), true);
  assert.equal(isFindingCaptureEntry(externalObserve), true);
  assert.equal(
    resolveSvyrNodeDataEntryType(externalObserve!),
    SVYR_DATA_ENTRY_TYPES.findingCapture,
  );
  assert.equal(
    resolveSvyrNodeDataEntryType(servicesObserve!),
    SVYR_DATA_ENTRY_TYPES.findingCapture,
  );
});

test('finding capture uses the generic upsert operation for every field', () => {
  const defect = findCommandNode(['services', 'water', 'defect']);
  assert.ok(defect?.findingTarget);
  assert.equal(defect?.coverage?.engineBinding, SURVEY_FINDING_UPSERT);
  assert.equal(isFindingCaptureTarget(defect?.findingTarget), true);
  assert.equal(defect?.findingTarget?.field, 'defect');
});

test('supported finding fields match the canonical InspectionFinding shape', () => {
  assert.deepEqual([...FINDING_CAPTURE_FIELDS], [
    'observation',
    'condition',
    'defect',
    'recommendation',
    'evidence',
  ]);
});

test('observation is required before optional finding fields can be committed', () => {
  const defectTarget = findCommandNode(['external', 'walls', 'defect'])!
    .findingTarget!;
  const inspection = createEmptyInspectionRecord();
  const rejected = commitInspectionFindingField(
    inspection,
    defectTarget,
    'Cracking noted.',
  );
  assert.equal(rejected.ok, false);
  if (rejected.ok) return;
  assert.equal(rejected.message, 'Record observation first');
});

test('one stable finding ID is reused across field edits on the same element', () => {
  const observeTarget = findCommandNode(['services', 'electricity', 'observe'])!
    .findingTarget!;
  const defectTarget = findCommandNode(['services', 'electricity', 'defect'])!
    .findingTarget!;

  let inspection = createEmptyInspectionRecord();
  const observed = commitInspectionFindingField(
    inspection,
    observeTarget,
    'Consumer unit appears dated.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  inspection = observed.result.inspection;

  const defect = commitInspectionFindingField(
    inspection,
    defectTarget,
    'No test documentation available.',
  );
  assert.equal(defect.ok, true);
  if (!defect.ok) return;
  assert.equal(Object.keys(defect.result.inspection.findings).length, 1);
  assert.equal(
    defect.result.inspection.findings[servicesFindingConfig('electricity').findingId]
      ?.id,
    'finding.service.electrical_installation.1',
  );
});

test('finding field values resolve from InspectionRecord.findings on re-entry', () => {
  const target = findCommandNode(['external', 'walls', 'observe'])!.findingTarget!;
  const inspection = {
    findings: {
      [DEMO_EXTERNAL_WALL_FINDING.id]: DEMO_EXTERNAL_WALL_FINDING,
    },
  };
  assert.equal(
    resolveFindingFieldValue(inspection, target),
    DEMO_EXTERNAL_WALL_FINDING.observation,
  );
});

test('services finding configs declare stable route identity without UI hardcoding', () => {
  const configs = [...SERVICES_FINDING_CONFIGS, SERVICES_GAS_FINDING_CONFIG];
  const findingIds = new Set(configs.map((config) => config.findingId));
  assert.equal(findingIds.size, configs.length);
  for (const config of configs) {
    assert.match(config.findingId, /^finding\.service\./);
    assert.ok(config.route.length >= 2);
    assert.ok(config.label.trim());
  }
});

test('finding capture does not introduce a second canonical finding store', () => {
  const inspection = createEmptyInspectionRecord();
  assert.equal(
    (inspection as { serviceFindings?: unknown }).serviceFindings,
    undefined,
  );
  assert.equal(
    (inspection as { findingFields?: unknown }).findingFields,
    undefined,
  );
});
