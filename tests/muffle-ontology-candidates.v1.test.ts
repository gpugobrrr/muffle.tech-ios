import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MUFFLE_ONTOLOGY_V1,
  serializeMuffleOntologyV1,
} from '@/domain/ontology/muffle-ontology.v1';
import {
  findPotentialOntologyCandidateDuplicates,
  getOntologyCandidatesByClassification,
  getOntologyCandidatesByConfidence,
  getOntologyCandidatesRequiringExpertReview,
  MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1,
  MUFFLE_ONTOLOGY_CANDIDATES_V1,
} from '@/domain/ontology/review/muffle-ontology-candidates.v1';
import {
  serializeOntologyCandidatesCsv,
  summarizeOntologyCandidates,
} from '@/domain/ontology/review/ontology-candidate-review-export';
import { validateMuffleOntologyCandidatesV1 } from '@/domain/ontology/review/validate-muffle-ontology-candidates.v1';

test('candidate ontology register validates without changing canonical ontology', () => {
  const ontologyBefore = serializeMuffleOntologyV1();

  assert.deepEqual(validateMuffleOntologyCandidatesV1(), []);
  assert.equal(serializeMuffleOntologyV1(), ontologyBefore);
});

test('review candidate IDs and proposed canonical IDs are unique', () => {
  const candidateIds = MUFFLE_ONTOLOGY_CANDIDATES_V1.map(({ id }) => id);
  const proposedIds = MUFFLE_ONTOLOGY_CANDIDATES_V1.flatMap(
    ({ proposedConceptId }) => (proposedConceptId ? [proposedConceptId] : []),
  );

  assert.equal(new Set(candidateIds).size, candidateIds.length);
  assert.equal(new Set(proposedIds).size, proposedIds.length);
  assert.equal(
    new Set(MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1.map(({ id }) => id))
      .size,
    MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1.length,
  );
  assert.deepEqual(findPotentialOntologyCandidateDuplicates(), []);
});

test('publication, workflow, and adjunct candidates preserve canonical boundaries', () => {
  const publications = getOntologyCandidatesByClassification('publication');
  const workflows = getOntologyCandidatesByClassification('workflow');
  const adjuncts = getOntologyCandidatesByClassification('adjunct');

  assert.equal(publications.every(({ canonical }) => canonical === false), true);
  assert.equal(
    workflows.every(
      ({ canonical, ownership }) =>
        canonical === false && ownership !== 'engine-record',
    ),
    true,
  );
  assert.equal(
    adjuncts.every(
      ({ canonical, ownership }) =>
        canonical === false && ownership === 'adjunct-state',
    ),
    true,
  );
  assert.equal(
    publications.some(
      ({ sourceTerm, mapsToExistingConceptId }) =>
        sourceTerm === 'D4 Main Walls' &&
        mapsToExistingConceptId === 'building_element.external_wall',
    ),
    true,
  );
});

test('existing mappings resolve and aliases are review metadata rather than concepts', () => {
  const existingIds = new Set(MUFFLE_ONTOLOGY_V1.concepts.map(({ id }) => id));
  const aliases = getOntologyCandidatesByClassification('alias');

  for (const candidate of MUFFLE_ONTOLOGY_CANDIDATES_V1) {
    if (candidate.mapsToExistingConceptId) {
      assert.equal(existingIds.has(candidate.mapsToExistingConceptId), true);
    }
  }
  assert.equal(aliases.length > 0, true);
  assert.equal(
    aliases.every(
      ({ canonical, proposedConceptId, aliases: terms }) =>
        canonical === false &&
        proposedConceptId === undefined &&
        terms?.every((term) => term.trim().length > 0) === true,
    ),
    true,
  );
});

test('expert-review helpers and CSV export are deterministic', () => {
  const first = serializeOntologyCandidatesCsv();
  const second = serializeOntologyCandidatesCsv();
  const summary = summarizeOntologyCandidates();

  assert.equal(first, second);
  assert.equal(first.startsWith('"id","sourceTerm","classification"'), true);
  assert.equal(first.includes('"D4 Main Walls"'), true);
  assert.equal(first.includes('"Main Walls; External Walls; Main External Walls'), true);
  assert.equal(getOntologyCandidatesRequiringExpertReview().length > 0, true);
  assert.equal(getOntologyCandidatesByConfidence('low').length > 0, true);
  assert.equal(summary.total, MUFFLE_ONTOLOGY_CANDIDATES_V1.length);
  assert.equal(
    summary.expertReviewRequired,
    getOntologyCandidatesRequiringExpertReview().length,
  );
});

test('candidate relationships refer to known existing or proposed semantics', () => {
  const knownIds = new Set([
    ...MUFFLE_ONTOLOGY_V1.concepts.map(({ id }) => id),
    ...MUFFLE_ONTOLOGY_CANDIDATES_V1.flatMap(({ proposedConceptId }) =>
      proposedConceptId ? [proposedConceptId] : [],
    ),
  ]);
  for (const relationship of MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1) {
    assert.equal(knownIds.has(relationship.subjectId), true, relationship.id);
    assert.equal(knownIds.has(relationship.objectId), true, relationship.id);
    assert.equal(relationship.reviewStatus, 'unreviewed');
  }
});
