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
  createInitialActiveJob,
  deserializeActiveJob,
  serializeActiveJob,
} from '../src/lib/job-persistence';
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
    'limitation',
    'furtherInvestigation',
    'risk',
    'evidence',
  ]);
});

test('electricity observation on empty inspection creates the stable finding', () => {
  const observeTarget = findCommandNode(['services', 'electricity', 'observe'])!
    .findingTarget!;
  assert.deepEqual(observeTarget, {
    findingId: 'finding.service.electrical_installation.1',
    elementConceptId: 'service_system.electrical_installation',
    field: 'observation',
  });

  const created = commitInspectionFindingField(
    createEmptyInspectionRecord(),
    observeTarget,
    'Consumer unit appears dated.',
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const finding =
    created.result.inspection.findings[
      'finding.service.electrical_installation.1'
    ];
  assert.deepEqual(finding, {
    id: 'finding.service.electrical_installation.1',
    elementConceptId: 'service_system.electrical_installation',
    observation: 'Consumer unit appears dated.',
  });
});

test('electricity defect before observation still returns Record observation first', () => {
  const defectTarget = findCommandNode(['services', 'electricity', 'defect'])!
    .findingTarget!;
  const rejected = commitInspectionFindingField(
    createEmptyInspectionRecord(),
    defectTarget,
    'Signs of thermal discolouration.',
  );
  assert.equal(rejected.ok, false);
  if (rejected.ok) return;
  assert.equal(rejected.message, 'Record observation first');
});

test('electricity defect immediately after observation succeeds on the same finding', () => {
  const observeTarget = findCommandNode(['services', 'electricity', 'observe'])!
    .findingTarget!;
  const defectTarget = findCommandNode(['services', 'electricity', 'defect'])!
    .findingTarget!;

  const observed = commitInspectionFindingField(
    createEmptyInspectionRecord(),
    observeTarget,
    'Consumer unit appears dated.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;

  const defect = commitInspectionFindingField(
    observed.result.inspection,
    defectTarget,
    'Signs of thermal discolouration.',
  );
  assert.equal(defect.ok, true);
  if (!defect.ok) return;
  assert.equal(
    defect.result.inspection.findings[observeTarget.findingId]?.defect,
    'Signs of thermal discolouration.',
  );
  assert.equal(
    defect.result.inspection.findings[observeTarget.findingId]?.observation,
    'Consumer unit appears dated.',
  );
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

const WALLS_EXTENDED_FIELDS = [
  { token: 'limit', field: 'limitation' },
  { token: 'further', field: 'furtherInvestigation' },
  { token: 'risk', field: 'risk' },
] as const;

test('limitation, further investigation, and risk require observation first', () => {
  for (const { token, field } of WALLS_EXTENDED_FIELDS) {
    const target = findCommandNode(['external', 'walls', token])!.findingTarget!;
    assert.equal(target.field, field);
    assert.equal(target.findingId, 'finding.external-wall.1');
    assert.equal(target.elementConceptId, 'building_element.external_wall');
    const rejected = commitInspectionFindingField(
      createEmptyInspectionRecord(),
      target,
      `${field} before observation`,
    );
    assert.equal(rejected.ok, false, field);
    if (!rejected.ok) assert.equal(rejected.message, 'Record observation first');
  }
});

test('limitation, further investigation, and risk update the same finding after observation', () => {
  const observe = findCommandNode(['external', 'walls', 'observe'])!.findingTarget!;
  const created = commitInspectionFindingField(
    createEmptyInspectionRecord(),
    observe,
    'Stepped cracking above the opening.',
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;

  let inspection = created.result.inspection;
  for (const { token, field } of WALLS_EXTENDED_FIELDS) {
    const target = findCommandNode(['external', 'walls', token])!.findingTarget!;
    const committed = commitInspectionFindingField(
      inspection,
      target,
      `${field} text`,
    );
    assert.equal(committed.ok, true, field);
    if (!committed.ok) return;
    inspection = committed.result.inspection;
    const finding = inspection.findings['finding.external-wall.1'];
    assert.equal(finding?.[field], `${field} text`);
    assert.equal(finding?.observation, 'Stepped cracking above the opening.');
  }
});

test('updating one extended finding field preserves siblings', () => {
  const observe = findCommandNode(['external', 'walls', 'observe'])!.findingTarget!;
  const defect = findCommandNode(['external', 'walls', 'defect'])!.findingTarget!;
  const recommend = findCommandNode(['external', 'walls', 'recommend'])!.findingTarget!;
  const limit = findCommandNode(['external', 'walls', 'limit'])!.findingTarget!;
  const further = findCommandNode(['external', 'walls', 'further'])!.findingTarget!;
  const risk = findCommandNode(['external', 'walls', 'risk'])!.findingTarget!;

  let inspection = createEmptyInspectionRecord();
  const observed = commitInspectionFindingField(
    inspection,
    observe,
    'Visible cracking.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  inspection = observed.result.inspection;

  const defected = commitInspectionFindingField(inspection, defect, 'Masonry crack.');
  assert.equal(defected.ok, true);
  if (!defected.ok) return;
  inspection = defected.result.inspection;

  const recommended = commitInspectionFindingField(
    inspection,
    recommend,
    'Obtain structural advice.',
  );
  assert.equal(recommended.ok, true);
  if (!recommended.ok) return;
  inspection = recommended.result.inspection;

  const limited = commitInspectionFindingField(
    inspection,
    limit,
    'Rear elevation not fully visible.',
  );
  assert.equal(limited.ok, true);
  if (!limited.ok) return;
  const afterLimit = limited.result.inspection.findings['finding.external-wall.1'];
  assert.equal(afterLimit?.observation, 'Visible cracking.');
  assert.equal(afterLimit?.defect, 'Masonry crack.');
  assert.equal(afterLimit?.recommendation, 'Obtain structural advice.');
  assert.equal(afterLimit?.limitation, 'Rear elevation not fully visible.');

  const investigated = commitInspectionFindingField(
    limited.result.inspection,
    further,
    'Open up the lintel bearing.',
  );
  assert.equal(investigated.ok, true);
  if (!investigated.ok) return;
  const afterFurther =
    investigated.result.inspection.findings['finding.external-wall.1'];
  assert.equal(afterFurther?.limitation, 'Rear elevation not fully visible.');
  assert.equal(afterFurther?.furtherInvestigation, 'Open up the lintel bearing.');
  assert.equal(afterFurther?.defect, 'Masonry crack.');

  const risked = commitInspectionFindingField(
    investigated.result.inspection,
    risk,
    'Progressive movement may continue.',
  );
  assert.equal(risked.ok, true);
  if (!risked.ok) return;
  const afterRisk = risked.result.inspection.findings['finding.external-wall.1'];
  assert.equal(afterRisk?.observation, 'Visible cracking.');
  assert.equal(afterRisk?.defect, 'Masonry crack.');
  assert.equal(afterRisk?.recommendation, 'Obtain structural advice.');
  assert.equal(afterRisk?.limitation, 'Rear elevation not fully visible.');
  assert.equal(afterRisk?.furtherInvestigation, 'Open up the lintel bearing.');
  assert.equal(afterRisk?.risk, 'Progressive movement may continue.');
});

test('older findings without extended fields remain valid and hydrate', () => {
  const base = createInitialActiveJob();
  const job = {
    ...base,
    inspection: {
      ...base.inspection,
      findings: {
        'finding.external-wall.1': {
          id: 'finding.external-wall.1',
          elementConceptId: 'building_element.external_wall' as const,
          observation: 'Historic finding without extended fields.',
        },
      },
    },
  };
  const restored = deserializeActiveJob(serializeActiveJob(job));
  const finding = restored?.inspection.findings['finding.external-wall.1'];
  assert.equal(finding?.observation, 'Historic finding without extended fields.');
  assert.equal(finding?.limitation, undefined);
  assert.equal(finding?.furtherInvestigation, undefined);
  assert.equal(finding?.risk, undefined);
});

test('serialization preserves extended finding fields with evidence refs', () => {
  const base = createInitialActiveJob();
  const job = {
    ...base,
    inspection: {
      ...base.inspection,
      findings: {
        'finding.external-wall.1': {
          id: 'finding.external-wall.1',
          elementConceptId: 'building_element.external_wall' as const,
          observation: 'Stepped cracking.',
          condition: 'Localised movement.',
          defect: 'Masonry cracking.',
          recommendation: 'Obtain advice.',
          limitation: 'Rear elevation obscured.',
          furtherInvestigation: 'Open up lintel.',
          risk: 'Movement may continue.',
          evidence: [{ id: 'evidence.photo.wall' }],
        },
      },
      evidence: {
        'evidence.photo.wall': {
          id: 'evidence.photo.wall',
          kind: 'photo' as const,
          uri: '/persistent/evidence.photo.wall.jpg',
        },
      },
    },
  };
  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.deepEqual(restored?.inspection.findings['finding.external-wall.1'], {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall',
    observation: 'Stepped cracking.',
    condition: 'Localised movement.',
    defect: 'Masonry cracking.',
    recommendation: 'Obtain advice.',
    limitation: 'Rear elevation obscured.',
    furtherInvestigation: 'Open up lintel.',
    risk: 'Movement may continue.',
    evidence: [{ id: 'evidence.photo.wall' }],
  });
});
