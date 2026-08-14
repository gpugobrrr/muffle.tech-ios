import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getConceptByCanonicalField } from '../src/domain/ontology/muffle-ontology.v1';
import { parseEditableCommand } from '../src/lib/command-edit';
import { parseCommand } from '../src/lib/command-parser';
import { findCommandNode } from '../src/lib/command-registry';
import {
  resolveSvyrDataEntryType,
  SVYR_DATA_ENTRY_TYPES,
} from '../src/lib/data-entry-types';
import {
  applyFieldValue,
  findFieldDefinition,
  resolveFieldValue,
} from '../src/lib/field-schema';
import { commitInspectionFindingField } from '../src/lib/finding-capture';
import {
  createInitialActiveJob,
  deserializeActiveJob,
  serializeActiveJob,
  withInspectionBrief,
} from '../src/lib/job-persistence';
import { buildSurveyReport } from '../src/lib/report/build-survey-report';
import {
  SECTION_LIMITATION_FIELD_DEFINITIONS,
  SECTION_LIMITATION_FIELD_IDS,
} from '../src/lib/section-limitations';
import {
  BLOCKED_ROUTE_REASONS,
  capabilityForRoute,
  surveyCapabilityCensus,
  SURVEY_BLOCKED_REASONS,
  SURVEY_CAPABILITY_KINDS,
} from '../src/lib/survey-capability';
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
import { suffixForPath } from '../src/lib/pin-context';
import type { InspectionBrief } from '../src/types/workspace';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../src');

const SECTION_LIMITATION_ROUTES = [
  {
    section: 'external',
    path: ['external', 'limitation'] as const,
    fieldId: SECTION_LIMITATION_FIELD_IDS.external,
    value: 'Rear elevation obscured by vegetation.',
  },
  {
    section: 'internal',
    path: ['internal', 'limitation'] as const,
    fieldId: SECTION_LIMITATION_FIELD_IDS.internal,
    value: 'Loft hatch sealed; no roof-space access.',
  },
  {
    section: 'services',
    path: ['services', 'limitation'] as const,
    fieldId: SECTION_LIMITATION_FIELD_IDS.services,
    value: 'Gas meter cupboard locked; no supply test.',
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

function reopenSectionLimitationValue(
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

test('section limitation routes are schema-backed controlled text capture', () => {
  for (const route of SECTION_LIMITATION_ROUTES) {
    const node = findCommandNode([...route.path]);
    const field = findFieldDefinition([...route.path]);
    const capability = capabilityForRoute(route.path);
    assert.ok(node, route.section);
    assert.ok(field, route.section);
    assert.equal(node?.workflowOnly, undefined, route.section);
    assert.equal(node?.findingTarget, undefined, route.section);
    assert.equal(node?.fieldId, route.fieldId, route.section);
    assert.equal(field?.fieldId, route.fieldId, route.section);
    assert.equal(field?.valueType, 'text', route.section);
    assert.equal(field?.optional, true, route.section);
    assert.equal(field?.operationId, SURVEY_OPERATIONS.setControlledFact, route.section);
    assert.equal(field?.readOperationId, SURVEY_OPERATIONS.readControlledFact, route.section);
    assert.equal(resolveSvyrDataEntryType(field!), SVYR_DATA_ENTRY_TYPES.controlledFact, route.section);
    assert.equal(capability?.kind, SURVEY_CAPABILITY_KINDS.capture, route.section);
    assert.equal(capability?.captureType, SVYR_DATA_ENTRY_TYPES.controlledFact, route.section);
    assert.equal(capability?.operationId, SURVEY_OPERATIONS.setControlledFact, route.section);
    assert.equal(capability?.fieldId, route.fieldId, route.section);
    assert.equal(getConceptByCanonicalField(route.fieldId)?.id, route.fieldId, route.section);
  }
});

test('section limitation commands parse as controlled_fact operations', () => {
  for (const route of SECTION_LIMITATION_ROUTES) {
    const parsed = parseCommand(`${route.path.join('/')} ${route.value}`);
    assert.equal(parsed.type, 'operation', route.section);
    if (parsed.type !== 'operation') continue;
    assert.equal(parsed.operation.operationId, SURVEY_OPERATIONS.setControlledFact, route.section);
    assert.equal(parsed.operation.arguments.fieldId, route.fieldId, route.section);
    assert.equal(parsed.operation.arguments.value, route.value, route.section);
  }
});

test('section limitation drafts and cancel do not write canonical brief state', () => {
  for (const route of SECTION_LIMITATION_ROUTES) {
    let drafts = stashEntryDraft({}, [...route.path], route.value);
    assert.equal(readEntryDraft(drafts, [...route.path]), route.value, route.section);
    assert.equal(resolveFieldValue(emptyBrief(), route.fieldId), null, route.section);
    drafts = clearEntryDraft(drafts, [...route.path]);
    assert.equal(readEntryDraft(drafts, [...route.path]), undefined, route.section);
    assert.equal(resolveFieldValue(emptyBrief(), route.fieldId), null, route.section);
  }
});

test('section limitation commit stores text under the correct controlledFacts field ID', () => {
  for (const route of SECTION_LIMITATION_ROUTES) {
    const parsed = parseCommand(`${route.path.join('/')} ${route.value}`);
    assert.equal(parsed.type, 'operation');
    if (parsed.type !== 'operation') continue;
    const committed = executeSurveyOperation(emptyBrief(), parsed.operation);
    assert.ok(committed, route.section);
    assert.equal(
      committed!.brief.controlledFacts?.[route.fieldId],
      route.value,
      route.section,
    );
    assert.equal(resolveFieldValue(committed!.brief, route.fieldId), route.value, route.section);
  }
});

test('section limitation fields are independent and distinct from brief limitation', () => {
  let brief = emptyBrief();
  brief = executeSurveyOperation(brief, {
    operationId: SURVEY_OPERATIONS.setLimitation,
    arguments: { value: 'Brief-wide PREP limitation.' },
  })!.brief;

  for (const route of SECTION_LIMITATION_ROUTES) {
    const committed = executeSurveyOperation(brief, {
      operationId: SURVEY_OPERATIONS.setControlledFact,
      arguments: {
        fieldId: route.fieldId,
        value: route.value,
      },
    });
    assert.ok(committed, route.section);
    brief = committed!.brief;
  }

  assert.equal(brief.limitation, 'Brief-wide PREP limitation.');
  assert.equal(
    resolveFieldValue(brief, SECTION_LIMITATION_FIELD_IDS.external),
    SECTION_LIMITATION_ROUTES[0].value,
  );
  assert.equal(
    resolveFieldValue(brief, SECTION_LIMITATION_FIELD_IDS.internal),
    SECTION_LIMITATION_ROUTES[1].value,
  );
  assert.equal(
    resolveFieldValue(brief, SECTION_LIMITATION_FIELD_IDS.services),
    SECTION_LIMITATION_ROUTES[2].value,
  );
});

test('section limitation values stay distinct from InspectionFinding.limitation', () => {
  const observe = findCommandNode(['external', 'walls', 'observe']);
  const findingLimit = findCommandNode(['external', 'walls', 'limit']);
  assert.ok(observe?.findingTarget);
  assert.ok(findingLimit?.findingTarget);
  const observed = commitInspectionFindingField(
    createInitialActiveJob().inspection,
    observe.findingTarget!,
    'Wall observation.',
  );
  assert.equal(observed.ok, true);
  if (!observed.ok) return;
  const limited = commitInspectionFindingField(
    observed.result.inspection,
    findingLimit.findingTarget!,
    'Rear elevation not fully visible.',
  );
  assert.equal(limited.ok, true);
  if (!limited.ok) return;

  let brief = emptyBrief();
  brief = executeSurveyOperation(brief, {
    operationId: SURVEY_OPERATIONS.setControlledFact,
    arguments: {
      fieldId: SECTION_LIMITATION_FIELD_IDS.external,
      value: 'Section-wide external access limitation.',
    },
  })!.brief;
  brief = executeSurveyOperation(brief, {
    operationId: SURVEY_OPERATIONS.setLimitation,
    arguments: { value: 'Brief limitation.' },
  })!.brief;

  const finding = limited.result.inspection.findings['finding.external-wall.1'];
  assert.equal(finding?.limitation, 'Rear elevation not fully visible.');
  assert.equal(
    resolveFieldValue(brief, SECTION_LIMITATION_FIELD_IDS.external),
    'Section-wide external access limitation.',
  );
  assert.equal(brief.limitation, 'Brief limitation.');
});

test('section limitation leave and re-enter reads canonical controlledFacts text', () => {
  let brief = emptyBrief();
  for (const route of SECTION_LIMITATION_ROUTES) {
    brief = executeSurveyOperation(brief, {
      operationId: SURVEY_OPERATIONS.setControlledFact,
      arguments: {
        fieldId: route.fieldId,
        value: route.value,
      },
    })!.brief;
    assert.equal(reopenSectionLimitationValue(brief, [...route.path]), route.value, route.section);
  }
});

test('section limitation serialize and hydrate restore all three values', () => {
  let brief = emptyBrief();
  for (const route of SECTION_LIMITATION_ROUTES) {
    brief = applyFieldValue(brief, route.fieldId, route.value);
  }
  const job = withInspectionBrief(createInitialActiveJob(), brief);
  const restored = deserializeActiveJob(serializeActiveJob(job));
  assert.ok(restored?.brief);
  const restoredBrief = restored.brief;
  for (const route of SECTION_LIMITATION_ROUTES) {
    assert.equal(
      resolveFieldValue(restoredBrief, route.fieldId),
      route.value,
      route.section,
    );
  }
});

test('buildSurveyReport projects sectionLimitations without persisting them', () => {
  let brief = emptyBrief();
  for (const route of SECTION_LIMITATION_ROUTES) {
    brief = applyFieldValue(brief, route.fieldId, route.value);
  }
  const job = withInspectionBrief(createInitialActiveJob(), brief);
  const before = structuredClone(job);
  const report = buildSurveyReport(job);
  assert.deepEqual(report.sectionLimitations, {
    external: SECTION_LIMITATION_ROUTES[0].value,
    internal: SECTION_LIMITATION_ROUTES[1].value,
    services: SECTION_LIMITATION_ROUTES[2].value,
  });
  assert.deepEqual(job, before);
  assert.equal(
    SECTION_LIMITATION_FIELD_DEFINITIONS.length,
    Object.keys(report.sectionLimitations).filter((key) => report.sectionLimitations[key as keyof typeof report.sectionLimitations]).length,
  );
});

test('derived survey view renders each section limitation before its findings section', () => {
  const view = readFileSync(join(SRC_ROOT, 'components/derived-survey-view.tsx'), 'utf8');
  const externalIndex = view.indexOf('report.sectionLimitations.external');
  const externalFindingsIndex = view.indexOf('External findings');
  const internalIndex = view.indexOf('report.sectionLimitations.internal');
  const internalFindingsIndex = view.indexOf('Internal findings');
  const servicesIndex = view.indexOf('report.sectionLimitations.services');
  const servicesFindingsIndex = view.indexOf('Services findings');
  assert.ok(externalIndex > -1);
  assert.ok(internalIndex > -1);
  assert.ok(servicesIndex > -1);
  assert.ok(externalFindingsIndex > -1);
  assert.ok(internalFindingsIndex > -1);
  assert.ok(servicesFindingsIndex > -1);
  assert.ok(externalIndex < externalFindingsIndex);
  assert.ok(internalIndex < internalFindingsIndex);
  assert.ok(servicesIndex < servicesFindingsIndex);
});

test('grounds limitation remains blocked and census stays aligned', () => {
  const grounds = capabilityForRoute('grounds/limitation');
  assert.equal(grounds?.kind, SURVEY_CAPABILITY_KINDS.blocked);
  assert.equal(grounds?.blockedReason, SURVEY_BLOCKED_REASONS.workflowModelUndefined);
  assert.equal(
    BLOCKED_ROUTE_REASONS['grounds/limitation'],
    SURVEY_BLOCKED_REASONS.workflowModelUndefined,
  );
  const node = findCommandNode(['grounds', 'limitation']);
  assert.equal(node?.workflowOnly, true);
  assert.equal(node?.operationId, undefined);
  assert.equal(parseCommand('grounds/limitation').type, 'placeholder');

  const census = surveyCapabilityCensus();
  assert.equal(census.unclassified, 0);
  assert.equal(census.capture, 128);
  assert.equal(census.blocked, 26);
  assert.equal(
    Object.keys(BLOCKED_ROUTE_REASONS).length,
    census.blocked,
  );
});
