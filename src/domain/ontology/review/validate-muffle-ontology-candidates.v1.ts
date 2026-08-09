import { MUFFLE_ONTOLOGY_V1 } from '@/domain/ontology/muffle-ontology.v1';
import {
  MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1,
  MUFFLE_ONTOLOGY_CANDIDATES_V1,
  type OntologyCandidateProposal,
  type OntologyCandidateRelationship,
} from '@/domain/ontology/review/muffle-ontology-candidates.v1';

const CONCEPT_ID_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;

function uniqueFailures(
  values: readonly { id: string }[],
  label: string,
): string[] {
  const seen = new Set<string>();
  const failures: string[] = [];
  for (const { id } of values) {
    if (seen.has(id)) failures.push(`duplicate ${label} ID: ${id}`);
    seen.add(id);
  }
  return failures;
}

function validateCandidate(
  candidate: OntologyCandidateProposal,
  existingIds: ReadonlySet<string>,
): string[] {
  const failures: string[] = [];
  if (!candidate.id.startsWith('candidate.')) {
    failures.push(`${candidate.id}: review IDs must start with candidate.`);
  }
  if (
    candidate.proposedConceptId &&
    !CONCEPT_ID_PATTERN.test(candidate.proposedConceptId)
  ) {
    failures.push(`${candidate.id}: invalid proposed concept ID.`);
  }
  if (
    candidate.mapsToExistingConceptId &&
    !existingIds.has(candidate.mapsToExistingConceptId)
  ) {
    failures.push(`${candidate.id}: existing concept mapping does not resolve.`);
  }
  if (candidate.aliases?.some((alias) => alias.trim().length === 0)) {
    failures.push(`${candidate.id}: aliases must be non-empty.`);
  }
  if (candidate.classification === 'publication' && candidate.canonical) {
    failures.push(`${candidate.id}: publication candidates cannot be canonical.`);
  }
  if (
    candidate.classification === 'workflow' &&
    (candidate.canonical || candidate.ownership === 'engine-record')
  ) {
    failures.push(
      `${candidate.id}: workflow candidates cannot be engine-record canonical truth.`,
    );
  }
  if (
    candidate.classification === 'adjunct' &&
    (candidate.canonical || candidate.ownership !== 'adjunct-state')
  ) {
    failures.push(`${candidate.id}: adjunct candidates must remain noncanonical.`);
  }
  if (candidate.reviewStatus !== 'unreviewed') {
    failures.push(`${candidate.id}: v1 review entries must start unreviewed.`);
  }
  return failures;
}

function validateRelationship(
  relationship: OntologyCandidateRelationship,
  knownIds: ReadonlySet<string>,
): string[] {
  const failures: string[] = [];
  if (!relationship.id.startsWith('candidate-relation.')) {
    failures.push(`${relationship.id}: relationship review ID is invalid.`);
  }
  if (!knownIds.has(relationship.subjectId)) {
    failures.push(`${relationship.id}: subject does not resolve.`);
  }
  if (!knownIds.has(relationship.objectId)) {
    failures.push(`${relationship.id}: object does not resolve.`);
  }
  if (relationship.reviewStatus !== 'unreviewed') {
    failures.push(`${relationship.id}: v1 relationship must start unreviewed.`);
  }
  return failures;
}

export function validateMuffleOntologyCandidatesV1(): string[] {
  const existingIds = new Set(MUFFLE_ONTOLOGY_V1.concepts.map(({ id }) => id));
  const proposedIds = new Set(
    MUFFLE_ONTOLOGY_CANDIDATES_V1.flatMap(({ proposedConceptId }) =>
      proposedConceptId ? [proposedConceptId] : [],
    ),
  );
  const knownIds = new Set([...existingIds, ...proposedIds]);
  return [
    ...uniqueFailures(MUFFLE_ONTOLOGY_CANDIDATES_V1, 'candidate'),
    ...uniqueFailures(
      MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1,
      'relationship',
    ),
    ...MUFFLE_ONTOLOGY_CANDIDATES_V1.flatMap((candidate) =>
      validateCandidate(candidate, existingIds),
    ),
    ...MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1.flatMap((relationship) =>
      validateRelationship(relationship, knownIds),
    ),
  ];
}
