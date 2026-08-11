import assert from 'node:assert/strict';
import test from 'node:test';

import {
  serializeMuffleOntologyV1,
} from '@/domain/ontology/muffle-ontology.v1';
import {
  auditMuffleOntologyCandidatesV1,
} from '@/domain/ontology/review/audit-muffle-ontology-candidates.v1';
import {
  MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1,
  MUFFLE_ONTOLOGY_CANDIDATES_V1,
  type OntologyCandidateProposal,
  type OntologyCandidateRelationship,
} from '@/domain/ontology/review/muffle-ontology-candidates.v1';

function candidate(
  overrides: Partial<OntologyCandidateProposal> = {},
): OntologyCandidateProposal {
  return {
    id: 'candidate.test.window',
    sourceTerm: 'Window',
    sources: [
      {
        type: 'general-domain-inference',
        id: 'audit-test',
      },
    ],
    classification: 'proposed-canonical-concept',
    proposedConceptId: 'building_element.window',
    label: 'Window',
    description: 'An inspectable window.',
    parentId: 'building_element',
    canonical: true,
    ownership: 'engine-record',
    maturity: 'type-only',
    kind: 'value',
    valueType: { kind: 'text' },
    rationale: 'Stable property meaning.',
    confidence: 'medium',
    expertReviewRequired: false,
    reviewStatus: 'unreviewed',
    ...overrides,
  };
}

function relationship(
  overrides: Partial<OntologyCandidateRelationship> = {},
): OntologyCandidateRelationship {
  return {
    id: 'candidate-relation.test',
    subjectId: 'building_element.window',
    predicate: 'concerns',
    objectId: 'building_element',
    rationale: 'Test relationship.',
    confidence: 'medium',
    expertReviewRequired: false,
    reviewStatus: 'unreviewed',
    sources: [{ type: 'general-domain-inference', id: 'audit-test' }],
    ...overrides,
  };
}

function codes(result: ReturnType<typeof auditMuffleOntologyCandidatesV1>): string[] {
  return [...result.errors, ...result.warnings].map(({ code }) => code);
}

test('default register has no hard errors and audit does not mutate inputs', () => {
  const ontologyBefore = serializeMuffleOntologyV1();
  const candidatesBefore = structuredClone(MUFFLE_ONTOLOGY_CANDIDATES_V1);
  const relationshipsBefore = structuredClone(
    MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1,
  );
  const result = auditMuffleOntologyCandidatesV1();

  assert.equal(result.errorCount, 0);
  assert.equal(serializeMuffleOntologyV1(), ontologyBefore);
  assert.deepEqual(MUFFLE_ONTOLOGY_CANDIDATES_V1, candidatesBefore);
  assert.deepEqual(
    MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1,
    relationshipsBefore,
  );
});

test('detects duplicate record and proposed IDs', () => {
  const first = candidate();
  const second = candidate({ id: first.id });
  const third = candidate({
    id: 'candidate.test.window-second',
    proposedConceptId: first.proposedConceptId,
  });
  const result = auditMuffleOntologyCandidatesV1({
    candidates: [first, second, third],
    relationships: [],
  });

  assert.equal(codes(result).includes('DUPLICATE_CANDIDATE_ID'), true);
  assert.equal(codes(result).includes('DUPLICATE_PROPOSED_CONCEPT_ID'), true);
  assert.equal(result.summary.duplicateCandidateIds, 1);
  assert.equal(result.summary.duplicateProposedConceptIds, 1);
});

test('detects broken canonical, parent, and relationship references', () => {
  const result = auditMuffleOntologyCandidatesV1({
    candidates: [
      candidate({
        mapsToExistingConceptId: 'missing.concept',
        parentId: 'missing.parent',
      }),
    ],
    relationships: [
      relationship({
        subjectId: 'missing.subject',
        objectId: 'missing.object',
      }),
    ],
  });

  assert.equal(codes(result).includes('BROKEN_EXISTING_CONCEPT_REFERENCE'), true);
  assert.equal(codes(result).includes('BROKEN_PARENT_REFERENCE'), true);
  assert.equal(codes(result).includes('BROKEN_RELATIONSHIP_SUBJECT'), true);
  assert.equal(codes(result).includes('BROKEN_RELATIONSHIP_OBJECT'), true);
  assert.equal(result.summary.brokenReferences, 4);
});

test('allows valid proposed-parent forward references', () => {
  const child = candidate({
    id: 'candidate.test.child',
    proposedConceptId: 'building_element.child',
    parentId: 'building_element.parent',
  });
  const parent = candidate({
    id: 'candidate.test.parent',
    proposedConceptId: 'building_element.parent',
    label: 'Parent',
    sourceTerm: 'Parent',
  });
  const result = auditMuffleOntologyCandidatesV1({
    candidates: [child, parent],
    relationships: [],
  });

  assert.equal(codes(result).includes('BROKEN_PARENT_REFERENCE'), false);
});

test('detects invalid classification combinations and malformed required data', () => {
  const result = auditMuffleOntologyCandidatesV1({
    candidates: [
      candidate({
        id: '',
        sourceTerm: ' ',
        rationale: ' ',
        proposedConceptId: 'Bad ID',
        label: ' ',
        description: ' ',
        reviewStatus: 'invalid' as OntologyCandidateProposal['reviewStatus'],
        confidence: 'invalid' as OntologyCandidateProposal['confidence'],
      }),
      candidate({
        id: 'candidate.test.publication',
        classification: 'publication',
        canonical: true,
        ownership: 'engine-record',
      }),
      candidate({
        id: 'candidate.test.workflow',
        classification: 'workflow',
        canonical: true,
        ownership: 'engine-record',
      }),
      candidate({
        id: 'candidate.test.self-parent',
        proposedConceptId: 'building_element.self_parent',
        parentId: 'building_element.self_parent',
      }),
    ],
    relationships: [
      relationship({
        subjectId: 'building_element.window',
        objectId: 'building_element.window',
      }),
    ],
  });
  const resultCodes = codes(result);

  for (const code of [
    'EMPTY_CANDIDATE_ID',
    'EMPTY_SOURCE_TERM',
    'EMPTY_RATIONALE',
    'INVALID_REVIEW_STATUS',
    'INVALID_CONFIDENCE',
    'MALFORMED_PROPOSED_CONCEPT_ID',
    'INCOMPLETE_NEW_CANONICAL_PROPOSAL',
    'INVALID_PUBLICATION_CANONICAL_COMBINATION',
    'INVALID_WORKFLOW_DOMAIN_COMBINATION',
    'SELF_REFERENCING_PARENT',
    'SELF_REFERENCING_RELATIONSHIP',
  ]) {
    assert.equal(resultCodes.includes(code), true, code);
  }
});

test('detects a proposed ID that already exists canonically', () => {
  const result = auditMuffleOntologyCandidatesV1({
    candidates: [
      candidate({
        proposedConceptId: 'building_element.external_wall',
        label: 'External wall',
      }),
    ],
    relationships: [],
  });

  assert.equal(codes(result).includes('PROPOSED_ID_ALREADY_CANONICAL'), true);
});

test('recognizes review-promoted candidates as historical overlaps, not new hard errors', () => {
  const result = auditMuffleOntologyCandidatesV1();
  const promotedWindow = result.warnings.find(
    ({ code, candidateId, conceptId }) =>
      code === 'PROMOTED_CANDIDATE_OVERLAPS_CANONICAL' &&
      candidateId === 'candidate.building_element.window' &&
      conceptId === 'building_element.window',
  );

  assert.ok(promotedWindow);
  assert.equal(result.errorCount, 0);
});

test('surfaces deterministic human-review warnings without auto-fixing', () => {
  const result = auditMuffleOntologyCandidatesV1({
    candidates: [
      candidate({
        id: 'candidate.test.windows',
        label: 'Windows',
        sourceTerm: 'Windows',
        proposedConceptId: 'building_element.windows',
        aliases: ['Main Walls'],
        confidence: 'low',
        expertReviewRequired: true,
      }),
      candidate({
        id: 'candidate.test.window',
        label: 'Window',
        sourceTerm: 'Window',
        proposedConceptId: 'building_element.window',
        aliases: ['Main Walls'],
        confidence: 'medium',
      }),
      candidate({
        id: 'candidate.test.condition-state',
        label: 'Condition state',
        sourceTerm: 'Condition state',
        proposedConceptId: 'condition_state',
      }),
      candidate({
        id: 'candidate.test.note-evidence',
        sourceTerm: 'Inspection note',
        proposedConceptId: undefined,
        mapsToExistingConceptId: 'evidence',
        classification: 'alias',
        canonical: false,
      }),
      candidate({
        id: 'candidate.test.attribute-entity',
        classification: 'attribute-or-value',
        proposedConceptId: 'building_element.attribute_entity',
        kind: 'entity',
      }),
    ],
    relationships: [],
  });
  const resultCodes = codes(result);

  for (const code of [
    'POTENTIAL_SEMANTIC_DUPLICATE',
    'OVERLAPS_EXISTING_CANONICAL_CONCEPT',
    'ALIAS_CONFLICT',
    'LOW_CONFIDENCE_NEW_CANONICAL',
    'EXPERT_REVIEW_REQUIRED',
    'NOTE_EVIDENCE_CONFUSION',
    'ATTRIBUTE_ENTITY_SUSPICION',
  ]) {
    assert.equal(resultCodes.includes(code), true, code);
  }
  assert.equal(result.errorCount, 0);
});

test('sorts audit issues deterministically', () => {
  const input = {
    candidates: [
      candidate({
        id: 'candidate.test.zeta',
        proposedConceptId: 'building_element.zeta',
        confidence: 'low',
        expertReviewRequired: true,
      }),
      candidate({
        id: 'candidate.test.alpha',
        proposedConceptId: 'building_element.alpha',
        confidence: 'low',
        expertReviewRequired: true,
      }),
    ],
    relationships: [],
  };
  const first = auditMuffleOntologyCandidatesV1(input);
  const second = auditMuffleOntologyCandidatesV1(input);

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.warnings.map(({ code, candidateId }) => `${code}:${candidateId}`),
    [...first.warnings]
      .sort(
        (left, right) =>
          left.code.localeCompare(right.code) ||
          (left.candidateId ?? '').localeCompare(right.candidateId ?? ''),
      )
      .map(({ code, candidateId }) => `${code}:${candidateId}`),
  );
});
