import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFindingHubItems,
  buildFindingFieldMenu,
  humanLabelForFinding,
  allocateProspectiveFindingId,
} from '../src/lib/finding-hub';
import { listFindingsForElement } from '../src/lib/inspection-findings';
import { createEmptyInspectionRecord } from '../src/lib/inspection-record';
import {
  commitInspectionFindingField,
  resolveFindingFieldValue,
} from '../src/lib/level-2-finding-capture';
import {
  EXTERNAL_WALL_FINDING_ID,
  EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
  EXTERNAL_WALL_FINDING_LEAVES,
} from '../src/lib/level-2-capture';
import { suffixForPath } from '../src/lib/pin-context';
import {
  entryDraftFindingPathKey,
  readFindingEntryDraft,
  stashFindingEntryDraft,
  suffixForDataEntryReentry,
  type SvyrEntryDraftsByPath,
} from '../src/lib/svyr-entry-drafts';
import { DEMO_EXTERNAL_WALL_FINDING } from '../src/lib/fixtures/demo-external-wall-finding';
import type { InspectionFinding, InspectionRecord } from '../src/types/workspace';

test('1. Empty hub behaviour: shows NEW FINDING only, creates no phantom record', () => {
  const inspection = createEmptyInspectionRecord();
  const hubItems = buildFindingHubItems(
    inspection,
    EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
  );

  assert.equal(hubItems.length, 1);
  assert.equal(hubItems[0].kind, 'new-finding');
  assert.deepEqual(inspection.findings, {});
});

test('2. Blank Observation creates nothing and returns required-value error', () => {
  const inspection = createEmptyInspectionRecord();
  const prospectiveId = allocateProspectiveFindingId(
    inspection,
    EXTERNAL_WALL_FINDING_ID,
  );
  assert.equal(prospectiveId, 'finding.external-wall.1');

  const result = commitInspectionFindingField(
    inspection,
    {
      findingId: prospectiveId,
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'observation',
    },
    '   ',
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.message, 'Value is required');
  }
  // Inspection record remains completely empty — no phantom finding
  assert.deepEqual(inspection.findings, {});
});

test('3. Two successful observations create two distinct findings under External Walls', () => {
  let inspection = createEmptyInspectionRecord();

  // Create finding 1
  const id1 = allocateProspectiveFindingId(
    inspection,
    EXTERNAL_WALL_FINDING_ID,
  );
  assert.equal(id1, 'finding.external-wall.1');

  const commit1 = commitInspectionFindingField(
    inspection,
    {
      findingId: id1,
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'observation',
    },
    'Stepped cracking above rear opening.',
  );
  assert.equal(commit1.ok, true);
  if (commit1.ok) {
    inspection = commit1.result.inspection;
  }

  // Create finding 2
  const id2 = allocateProspectiveFindingId(
    inspection,
    EXTERNAL_WALL_FINDING_ID,
  );
  assert.equal(id2, 'finding.external-wall.2');

  const commit2 = commitInspectionFindingField(
    inspection,
    {
      findingId: id2,
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'observation',
    },
    'Spalling brickwork at front gable.',
  );
  assert.equal(commit2.ok, true);
  if (commit2.ok) {
    inspection = commit2.result.inspection;
  }

  // Verify both findings exist in the inspection record with distinct IDs
  const findings = listFindingsForElement(
    inspection,
    EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
  );
  assert.equal(findings.length, 2);
  assert.equal(findings[0].id, 'finding.external-wall.1');
  assert.equal(findings[0].observation, 'Stepped cracking above rear opening.');
  assert.equal(findings[1].id, 'finding.external-wall.2');
  assert.equal(findings[1].observation, 'Spalling brickwork at front gable.');

  // Hub items contain NEW FINDING + both findings
  const hubItems = buildFindingHubItems(
    inspection,
    EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
  );
  assert.equal(hubItems.length, 3);
  assert.equal(hubItems[0].kind, 'new-finding');
  assert.equal(hubItems[1].kind, 'existing-finding');
  if (hubItems[1].kind === 'existing-finding') {
    assert.equal(hubItems[1].findingId, 'finding.external-wall.1');
    assert.ok(hubItems[1].humanLabel.includes('Stepped cracking'));
  }
  assert.equal(hubItems[2].kind, 'existing-finding');
  if (hubItems[2].kind === 'existing-finding') {
    assert.equal(hubItems[2].findingId, 'finding.external-wall.2');
    assert.ok(hubItems[2].humanLabel.includes('Spalling brickwork'));
  }
});

test('4. Selecting and reopening each finding loads only its own values', () => {
  let inspection = createEmptyInspectionRecord();

  // Create finding 1 with condition
  const commit1 = commitInspectionFindingField(
    inspection,
    {
      findingId: 'finding.external-wall.1',
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'observation',
    },
    'First wall observation',
  );
  assert.ok(commit1.ok);
  if (commit1.ok) {
    inspection = commit1.result.inspection;
  }

  const cond1 = commitInspectionFindingField(
    inspection,
    {
      findingId: 'finding.external-wall.1',
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'condition',
    },
    'Condition 1',
  );
  assert.ok(cond1.ok);
  if (cond1.ok) {
    inspection = cond1.result.inspection;
  }

  // Create finding 2 with different condition
  const commit2 = commitInspectionFindingField(
    inspection,
    {
      findingId: 'finding.external-wall.2',
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'observation',
    },
    'Second wall observation',
  );
  assert.ok(commit2.ok);
  if (commit2.ok) {
    inspection = commit2.result.inspection;
  }

  const cond2 = commitInspectionFindingField(
    inspection,
    {
      findingId: 'finding.external-wall.2',
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'condition',
    },
    'Condition 2',
  );
  assert.ok(cond2.ok);
  if (cond2.ok) {
    inspection = cond2.result.inspection;
  }

  // Read finding 1 fields
  const obs1Val = resolveFindingFieldValue(inspection, {
    findingId: 'finding.external-wall.1',
    elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
    field: 'observation',
  });
  const cond1Val = resolveFindingFieldValue(inspection, {
    findingId: 'finding.external-wall.1',
    elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
    field: 'condition',
  });
  assert.equal(obs1Val, 'First wall observation');
  assert.equal(cond1Val, 'Condition 1');

  // Read finding 2 fields
  const obs2Val = resolveFindingFieldValue(inspection, {
    findingId: 'finding.external-wall.2',
    elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
    field: 'observation',
  });
  const cond2Val = resolveFindingFieldValue(inspection, {
    findingId: 'finding.external-wall.2',
    elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
    field: 'condition',
  });
  assert.equal(obs2Val, 'Second wall observation');
  assert.equal(cond2Val, 'Condition 2');
});

test('5. Editing one finding does not modify or duplicate another', () => {
  let inspection: InspectionRecord = {
    findings: {
      'finding.external-wall.1': {
        id: 'finding.external-wall.1',
        elementConceptId: 'building_element.external_wall',
        observation: 'Original obs 1',
        defect: 'Defect 1',
      },
      'finding.external-wall.2': {
        id: 'finding.external-wall.2',
        elementConceptId: 'building_element.external_wall',
        observation: 'Original obs 2',
        defect: 'Defect 2',
      },
    },
  };

  // Edit defect on finding 2
  const editResult = commitInspectionFindingField(
    inspection,
    {
      findingId: 'finding.external-wall.2',
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'defect',
    },
    'Updated defect 2',
  );
  assert.ok(editResult.ok);
  if (editResult.ok) {
    inspection = editResult.result.inspection;
  }

  // Finding 1 is completely untouched
  assert.equal(
    inspection.findings['finding.external-wall.1'].observation,
    'Original obs 1',
  );
  assert.equal(
    inspection.findings['finding.external-wall.1'].defect,
    'Defect 1',
  );

  // Finding 2 has updated defect and untouched observation
  assert.equal(
    inspection.findings['finding.external-wall.2'].observation,
    'Original obs 2',
  );
  assert.equal(
    inspection.findings['finding.external-wall.2'].defect,
    'Updated defect 2',
  );

  // Still exactly 2 findings — no duplicate created
  assert.equal(Object.keys(inspection.findings).length, 2);
});

test('6. Location creation, editing, and re-entry work correctly', () => {
  let inspection = createEmptyInspectionRecord();

  // Create finding with observation first
  const obsCommit = commitInspectionFindingField(
    inspection,
    {
      findingId: 'finding.external-wall.1',
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'observation',
    },
    'Cracking near chimney',
  );
  assert.ok(obsCommit.ok);
  if (obsCommit.ok) {
    inspection = obsCommit.result.inspection;
  }

  // Location not yet recorded: human label indicates this
  const labelBefore = humanLabelForFinding(
    inspection.findings['finding.external-wall.1'],
  );
  assert.ok(labelBefore.startsWith('Location not recorded ·'));
  assert.ok(labelBefore.includes('Cracking near chimney'));

  // Record location
  const locCommit = commitInspectionFindingField(
    inspection,
    {
      findingId: 'finding.external-wall.1',
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'location',
    },
    'Rear elevation',
  );
  assert.ok(locCommit.ok);
  if (locCommit.ok) {
    inspection = locCommit.result.inspection;
  }

  // Value resolves correctly
  const locVal = resolveFindingFieldValue(inspection, {
    findingId: 'finding.external-wall.1',
    elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
    field: 'location',
  });
  assert.equal(locVal, 'Rear elevation');

  // Human label now shows the location
  const labelAfter = humanLabelForFinding(
    inspection.findings['finding.external-wall.1'],
  );
  assert.ok(labelAfter.startsWith('Rear elevation ·'));
  assert.ok(labelAfter.includes('Cracking near chimney'));

  // Edit location
  const editLoc = commitInspectionFindingField(
    inspection,
    {
      findingId: 'finding.external-wall.1',
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'location',
    },
    'South-facing flank wall',
  );
  assert.ok(editLoc.ok);
  if (editLoc.ok) {
    inspection = editLoc.result.inspection;
  }

  const locValUpdated = resolveFindingFieldValue(inspection, {
    findingId: 'finding.external-wall.1',
    elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
    field: 'location',
  });
  assert.equal(locValUpdated, 'South-facing flank wall');
});

test('7. Location cannot independently create a finding without observation', () => {
  const inspection = createEmptyInspectionRecord();

  const result = commitInspectionFindingField(
    inspection,
    {
      findingId: 'finding.external-wall.1',
      elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
      field: 'location',
    },
    'Front elevation',
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.message, 'Record observation first');
  }
  assert.deepEqual(inspection.findings, {});
});

test('8. Optional fields (defect, recommendation, condition) require existing observation', () => {
  const inspection = createEmptyInspectionRecord();

  for (const field of ['condition', 'defect', 'recommendation'] as const) {
    const result = commitInspectionFindingField(
      inspection,
      {
        findingId: 'finding.external-wall.1',
        elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
        field,
      },
      'Some value',
    );
    assert.equal(result.ok, false, `Field ${field} should require observation`);
    if (!result.ok) {
      assert.equal(result.message, 'Record observation first');
    }
  }
});

test('9. Drafts are isolated by finding ID and do not leak between findings', () => {
  const path = ['external', 'walls', 'condition'];
  let drafts: SvyrEntryDraftsByPath = {};

  drafts = stashFindingEntryDraft(
    drafts,
    path,
    'finding.external-wall.1',
    'Draft condition for finding 1',
  );
  drafts = stashFindingEntryDraft(
    drafts,
    path,
    'finding.external-wall.2',
    'Draft condition for finding 2',
  );

  assert.equal(
    entryDraftFindingPathKey(path, 'finding.external-wall.1'),
    'external/walls/condition@finding.external-wall.1',
  );
  assert.equal(
    readFindingEntryDraft(drafts, path, 'finding.external-wall.1'),
    'Draft condition for finding 1',
  );
  assert.equal(
    readFindingEntryDraft(drafts, path, 'finding.external-wall.2'),
    'Draft condition for finding 2',
  );

  drafts = stashFindingEntryDraft(drafts, path, 'finding.external-wall.1', '');
  assert.equal(
    readFindingEntryDraft(drafts, path, 'finding.external-wall.1'),
    undefined,
  );
  assert.equal(
    readFindingEntryDraft(drafts, path, 'finding.external-wall.2'),
    'Draft condition for finding 2',
  );
});

test('10. Legacy .1 finding is treated as an ordinary first finding', () => {
  const inspection: InspectionRecord = {
    findings: {
      [DEMO_EXTERNAL_WALL_FINDING.id]: DEMO_EXTERNAL_WALL_FINDING,
    },
  };

  const hubItems = buildFindingHubItems(
    inspection,
    EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
  );

  // NEW FINDING + the legacy .1 finding
  assert.equal(hubItems.length, 2);
  assert.equal(hubItems[0].kind, 'new-finding');
  assert.equal(hubItems[1].kind, 'existing-finding');
  if (hubItems[1].kind === 'existing-finding') {
    assert.equal(hubItems[1].findingId, 'finding.external-wall.1');
    assert.ok(hubItems[1].humanLabel.includes('Stepped cracking'));
  }

  // Allocating next finding ID allocates .2
  const nextId = allocateProspectiveFindingId(
    inspection,
    EXTERNAL_WALL_FINDING_ID,
  );
  assert.equal(nextId, 'finding.external-wall.2');
});

test('11. Dynamic field menu resolves all findingTargets to the selected finding ID', () => {
  const findingId = 'finding.external-wall.2';
  const menu = buildFindingFieldMenu(
    findingId,
    EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
    'External wall',
    EXTERNAL_WALL_FINDING_LEAVES,
  );

  const findingLeaves = menu.filter((node) => node.findingTarget);
  assert.ok(findingLeaves.length > 0);

  for (const leaf of findingLeaves) {
    assert.equal(
      leaf.findingTarget?.findingId,
      findingId,
      `Leaf ${leaf.token} target findingId should be ${findingId}`,
    );
    assert.equal(
      leaf.findingTarget?.elementConceptId,
      EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
    );
  }
});

test('12. Human label never displays internal finding IDs and truncates gracefully', () => {
  const findingWithLocation: InspectionFinding = {
    id: 'finding.external-wall.1',
    elementConceptId: 'building_element.external_wall',
    location: 'Rear elevation above ground floor lintel',
    observation:
      'Extensive diagonal cracking propagating through brickwork and bed joints near corner of property',
  };

  const label = humanLabelForFinding(findingWithLocation);
  assert.ok(!label.includes('finding.external-wall.1'));
  assert.ok(!label.includes('building_element'));
  assert.ok(label.includes('Rear elevation'));
  assert.ok(label.length <= 48, `Label length ${label.length} exceeds 48`);
});

test('13. New finding observation does not prefill another finding\'s committed value', () => {
  const inspection: InspectionRecord = {
    findings: {
      'finding.external-wall.1': {
        id: 'finding.external-wall.1',
        elementConceptId: 'building_element.external_wall',
        observation: 'Committed first observation',
      },
    },
  };

  const existing = resolveFindingFieldValue(inspection, {
    findingId: 'finding.external-wall.1',
    elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
    field: 'observation',
  });
  const prospectiveId = allocateProspectiveFindingId(
    inspection,
    EXTERNAL_WALL_FINDING_ID,
  );
  const prospective = resolveFindingFieldValue(inspection, {
    findingId: prospectiveId,
    elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
    field: 'observation',
  });

  assert.equal(existing, 'Committed first observation');
  assert.equal(prospectiveId, 'finding.external-wall.2');
  assert.equal(prospective, null);

  const path = ['external', 'walls', 'observe'];
  const reopened = suffixForDataEntryReentry({
    path,
    draft: prospective ?? undefined,
    defaultInsertion: suffixForPath(path),
    suffixForPath,
  });
  assert.equal(reopened, suffixForPath(path));
  assert.doesNotMatch(reopened, /Committed first observation/);
});
