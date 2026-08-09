import type { MuffleOntologyV1 } from '@/domain/ontology/muffle-ontology.v1';
import {
  MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1,
  MUFFLE_ONTOLOGY_CANDIDATES_V1,
  type OntologyCandidateConfidence,
  type OntologyCandidateProposal,
  type OntologyCandidateRelationship,
  type OntologyCandidateReviewStatus,
} from '@/domain/ontology/review/muffle-ontology-candidates.v1';
import { MUFFLE_ONTOLOGY_V1 } from '@/domain/ontology/muffle-ontology.v1';

export type OntologyCandidateAuditSeverity = 'error' | 'warning';

export type OntologyCandidateAuditIssue = {
  severity: OntologyCandidateAuditSeverity;
  code: string;
  candidateId?: string;
  relatedCandidateIds?: string[];
  conceptId?: string;
  message: string;
};

export type OntologyCandidateAuditResult = {
  candidateCount: number;
  errorCount: number;
  warningCount: number;
  errors: OntologyCandidateAuditIssue[];
  warnings: OntologyCandidateAuditIssue[];
  summary: {
    duplicateCandidateIds: number;
    duplicateProposedConceptIds: number;
    brokenReferences: number;
    potentialDuplicates: number;
    aliasConflicts: number;
    expertReviewRequired: number;
  };
};

export type OntologyCandidateAuditInput = {
  candidates?: readonly OntologyCandidateProposal[];
  relationships?: readonly OntologyCandidateRelationship[];
  ontology?: MuffleOntologyV1;
};

const CONCEPT_ID_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;
const REVIEW_STATUSES: readonly OntologyCandidateReviewStatus[] = [
  'unreviewed',
  'approved',
  'rejected',
  'needs-revision',
];
const CONFIDENCES: readonly OntologyCandidateConfidence[] = [
  'high',
  'medium',
  'low',
];

function text(value: string | undefined): string {
  return value?.trim() ?? '';
}

function normalized(value: string | undefined): string {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(\w{4,})s\b/g, '$1')
    .trim();
}

function tokens(value: string | undefined): Set<string> {
  return new Set(normalized(value).split(' ').filter(Boolean));
}

function tokenOverlap(left: string | undefined, right: string | undefined): number {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / Math.max(Math.min(leftTokens.size, rightTokens.size), 1);
}

function targetId(candidate: OntologyCandidateProposal): string | undefined {
  return candidate.proposedConceptId ?? candidate.mapsToExistingConceptId;
}

function issue(
  severity: OntologyCandidateAuditSeverity,
  code: string,
  message: string,
  details: Omit<OntologyCandidateAuditIssue, 'severity' | 'code' | 'message'> = {},
): OntologyCandidateAuditIssue {
  return { severity, code, message, ...details };
}

function sortIssues(
  issues: readonly OntologyCandidateAuditIssue[],
): OntologyCandidateAuditIssue[] {
  return [...issues].sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      (left.candidateId ?? '').localeCompare(right.candidateId ?? '') ||
      (left.conceptId ?? '').localeCompare(right.conceptId ?? '') ||
      (left.relatedCandidateIds?.join('\u0000') ?? '').localeCompare(
        right.relatedCandidateIds?.join('\u0000') ?? '',
      ) ||
      left.message.localeCompare(right.message),
  );
}

function duplicateGroups<T>(
  values: readonly T[],
  keyFor: (value: T) => string | undefined,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return new Map([...groups].filter(([, group]) => group.length > 1));
}

export function auditMuffleOntologyCandidatesV1(
  input: OntologyCandidateAuditInput = {},
): OntologyCandidateAuditResult {
  const candidates = input.candidates ?? MUFFLE_ONTOLOGY_CANDIDATES_V1;
  const relationships =
    input.relationships ?? MUFFLE_ONTOLOGY_CANDIDATE_RELATIONSHIPS_V1;
  const ontology = input.ontology ?? MUFFLE_ONTOLOGY_V1;
  const existingIds = new Set(ontology.concepts.map(({ id }) => id));
  const proposedIds = new Set(
    candidates.flatMap(({ proposedConceptId }) =>
      proposedConceptId ? [proposedConceptId] : [],
    ),
  );
  const knownIds = new Set([...existingIds, ...proposedIds]);
  const errors: OntologyCandidateAuditIssue[] = [];
  const warnings: OntologyCandidateAuditIssue[] = [];
  let brokenReferences = 0;

  const duplicateCandidateIds = duplicateGroups(candidates, ({ id }) => id);
  for (const [id, group] of duplicateCandidateIds) {
    errors.push(
      issue('error', 'DUPLICATE_CANDIDATE_ID', 'Candidate record ID is duplicated.', {
        candidateId: id,
        relatedCandidateIds: group.map(({ id: candidateId }) => candidateId),
      }),
    );
  }

  const duplicateProposedIds = duplicateGroups(
    candidates,
    ({ proposedConceptId }) => proposedConceptId,
  );
  for (const [conceptId, group] of duplicateProposedIds) {
    errors.push(
      issue(
        'error',
        'DUPLICATE_PROPOSED_CONCEPT_ID',
        'More than one candidate proposes the same canonical concept ID.',
        {
          conceptId,
          relatedCandidateIds: group.map(({ id }) => id).sort(),
        },
      ),
    );
  }

  for (const candidate of candidates) {
    const candidateId = candidate.id;
    if (!text(candidateId)) {
      errors.push(
        issue('error', 'EMPTY_CANDIDATE_ID', 'Candidate ID is required.'),
      );
    }
    if (!text(candidate.sourceTerm)) {
      errors.push(
        issue('error', 'EMPTY_SOURCE_TERM', 'Source term is required.', {
          candidateId,
        }),
      );
    }
    if (!text(candidate.rationale)) {
      errors.push(
        issue('error', 'EMPTY_RATIONALE', 'Rationale is required.', {
          candidateId,
        }),
      );
    }
    if (!REVIEW_STATUSES.includes(candidate.reviewStatus)) {
      errors.push(
        issue('error', 'INVALID_REVIEW_STATUS', 'Review status is invalid.', {
          candidateId,
        }),
      );
    }
    if (!CONFIDENCES.includes(candidate.confidence)) {
      errors.push(
        issue('error', 'INVALID_CONFIDENCE', 'Confidence is invalid.', {
          candidateId,
        }),
      );
    }
    if (
      candidate.proposedConceptId &&
      !CONCEPT_ID_PATTERN.test(candidate.proposedConceptId)
    ) {
      errors.push(
        issue('error', 'MALFORMED_PROPOSED_CONCEPT_ID', 'Proposed concept ID is malformed.', {
          candidateId,
          conceptId: candidate.proposedConceptId,
        }),
      );
    }
    if (
      candidate.classification === 'proposed-canonical-concept' &&
      (!text(candidate.proposedConceptId) ||
        !text(candidate.label) ||
        !text(candidate.description))
    ) {
      errors.push(
        issue(
          'error',
          'INCOMPLETE_NEW_CANONICAL_PROPOSAL',
          'New canonical proposals require an ID, label, and description.',
          { candidateId },
        ),
      );
    }
    if (
      candidate.classification === 'proposed-canonical-concept' &&
      candidate.proposedConceptId &&
      existingIds.has(candidate.proposedConceptId)
    ) {
      errors.push(
        issue(
          'error',
          'PROPOSED_ID_ALREADY_CANONICAL',
          'New canonical proposal uses an ID already present in the canonical ontology.',
          { candidateId, conceptId: candidate.proposedConceptId },
        ),
      );
    }
    if (
      candidate.mapsToExistingConceptId &&
      !existingIds.has(candidate.mapsToExistingConceptId)
    ) {
      brokenReferences += 1;
      errors.push(
        issue(
          'error',
          'BROKEN_EXISTING_CONCEPT_REFERENCE',
          'mapsToExistingConceptId does not resolve in the canonical ontology.',
          {
            candidateId,
            conceptId: candidate.mapsToExistingConceptId,
          },
        ),
      );
    }
    if (
      candidate.parentId &&
      candidate.proposedConceptId &&
      candidate.parentId === candidate.proposedConceptId
    ) {
      errors.push(
        issue('error', 'SELF_REFERENCING_PARENT', 'Candidate cannot parent itself.', {
          candidateId,
          conceptId: candidate.parentId,
        }),
      );
    } else if (candidate.parentId && !knownIds.has(candidate.parentId)) {
      brokenReferences += 1;
      errors.push(
        issue('error', 'BROKEN_PARENT_REFERENCE', 'Candidate parent does not resolve.', {
          candidateId,
          conceptId: candidate.parentId,
        }),
      );
    }
    if (
      candidate.classification === 'publication' &&
      (candidate.canonical || candidate.ownership === 'engine-record')
    ) {
      errors.push(
        issue(
          'error',
          'INVALID_PUBLICATION_CANONICAL_COMBINATION',
          'Publication candidates cannot claim canonical engine-record truth.',
          { candidateId },
        ),
      );
    }
    if (
      candidate.classification === 'workflow' &&
      (candidate.canonical || candidate.ownership === 'engine-record')
    ) {
      errors.push(
        issue(
          'error',
          'INVALID_WORKFLOW_DOMAIN_COMBINATION',
          'Workflow candidates cannot claim canonical engine-record truth.',
          { candidateId },
        ),
      );
    }
    if (
      candidate.classification === 'attribute-or-value' &&
      candidate.kind === 'entity'
    ) {
      warnings.push(
        issue(
          'warning',
          'ATTRIBUTE_ENTITY_SUSPICION',
          'Attribute-or-value candidate is modelled as an entity and requires review.',
          { candidateId },
        ),
      );
    }
    if (
      candidate.classification === 'proposed-canonical-concept' &&
      candidate.confidence === 'low'
    ) {
      warnings.push(
        issue(
          'warning',
          'LOW_CONFIDENCE_NEW_CANONICAL',
          'Low-confidence new canonical proposal requires expert review.',
          { candidateId, conceptId: candidate.proposedConceptId },
        ),
      );
    }
    if (candidate.expertReviewRequired) {
      warnings.push(
        issue(
          'warning',
          'EXPERT_REVIEW_REQUIRED',
          'Candidate is marked for expert surveyor review.',
          { candidateId },
        ),
      );
    }
    if (
      candidate.classification === 'proposed-canonical-concept' &&
      /^[A-Z]\d+\b/.test(text(candidate.sourceTerm))
    ) {
      warnings.push(
        issue(
          'warning',
          'REPORT_TERMINOLOGY_AS_CANONICAL',
          'Coded report terminology is proposed as canonical and requires review.',
          { candidateId },
        ),
      );
    }
    if (
      /\bnote\b/i.test(candidate.sourceTerm) &&
      targetId(candidate) === 'evidence'
    ) {
      warnings.push(
        issue(
          'warning',
          'NOTE_EVIDENCE_CONFUSION',
          'Candidate appears to map note terminology to evidence.',
          { candidateId, conceptId: 'evidence' },
        ),
      );
    }
  }

  for (const relationship of relationships) {
    if (!text(relationship.id) || !text(relationship.rationale)) {
      errors.push(
        issue(
          'error',
          'EMPTY_RELATIONSHIP_FIELD',
          'Relationship ID and rationale are required.',
          { candidateId: relationship.id },
        ),
      );
    }
    if (!REVIEW_STATUSES.includes(relationship.reviewStatus)) {
      errors.push(
        issue(
          'error',
          'INVALID_RELATIONSHIP_REVIEW_STATUS',
          'Relationship review status is invalid.',
          { candidateId: relationship.id },
        ),
      );
    }
    if (!CONFIDENCES.includes(relationship.confidence)) {
      errors.push(
        issue(
          'error',
          'INVALID_RELATIONSHIP_CONFIDENCE',
          'Relationship confidence is invalid.',
          { candidateId: relationship.id },
        ),
      );
    }
    if (!knownIds.has(relationship.subjectId)) {
      brokenReferences += 1;
      errors.push(
        issue(
          'error',
          'BROKEN_RELATIONSHIP_SUBJECT',
          'Relationship subject does not resolve.',
          { candidateId: relationship.id, conceptId: relationship.subjectId },
        ),
      );
    }
    if (!knownIds.has(relationship.objectId)) {
      brokenReferences += 1;
      errors.push(
        issue(
          'error',
          'BROKEN_RELATIONSHIP_OBJECT',
          'Relationship object does not resolve.',
          { candidateId: relationship.id, conceptId: relationship.objectId },
        ),
      );
    }
    if (relationship.subjectId === relationship.objectId) {
      errors.push(
        issue(
          'error',
          'SELF_REFERENCING_RELATIONSHIP',
          'Current candidate relationship predicates cannot relate a concept to itself.',
          { candidateId: relationship.id, conceptId: relationship.subjectId },
        ),
      );
    }
  }

  const proposed = candidates.filter(
    ({ classification }) => classification === 'proposed-canonical-concept',
  );
  for (const [index, left] of proposed.entries()) {
    for (const right of proposed.slice(index + 1)) {
      const overlap = tokenOverlap(
        left.label ?? left.sourceTerm,
        right.label ?? right.sourceTerm,
      );
      if (overlap >= 0.5) {
        warnings.push(
          issue(
            'warning',
            'POTENTIAL_SEMANTIC_DUPLICATE',
            'Proposed canonical labels have substantial normalized token overlap.',
            {
              candidateId: left.id,
              relatedCandidateIds: [right.id],
            },
          ),
        );
      }
    }
  }

  for (const candidate of proposed) {
    const terms = [
      candidate.label,
      candidate.sourceTerm,
      ...(candidate.aliases ?? []),
    ];
    const match = ontology.concepts
      .filter(({ canonical }) => canonical)
      .find((concept) =>
        terms.some(
          (term) =>
            normalized(term) === normalized(concept.label) ||
            tokenOverlap(term, concept.label) >= 0.5 ||
            concept.aliases?.some(
              (alias) =>
                normalized(term) === normalized(alias) ||
                tokenOverlap(term, alias) >= 0.5,
            ),
        ),
      );
    if (match) {
      warnings.push(
        issue(
          'warning',
          'OVERLAPS_EXISTING_CANONICAL_CONCEPT',
          'Proposed canonical candidate overlaps an existing canonical concept.',
          {
            candidateId: candidate.id,
            conceptId: match.id,
          },
        ),
      );
    }
  }

  const aliases = new Map<string, { target: string; candidateId: string }[]>();
  for (const candidate of candidates) {
    const target = targetId(candidate);
    if (!target) continue;
    for (const alias of candidate.aliases ?? []) {
      const key = normalized(alias);
      if (!key) continue;
      aliases.set(key, [...(aliases.get(key) ?? []), { target, candidateId: candidate.id }]);
    }
  }
  for (const [alias, entries] of aliases) {
    if (new Set(entries.map(({ target }) => target)).size > 1) {
      warnings.push(
        issue(
          'warning',
          'ALIAS_CONFLICT',
          `Alias "${alias}" is associated with multiple concepts.`,
          {
            relatedCandidateIds: entries.map(({ candidateId }) => candidateId).sort(),
          },
        ),
      );
    }
  }

  const orderedErrors = sortIssues(errors);
  const orderedWarnings = sortIssues(warnings);
  return {
    candidateCount: candidates.length,
    errorCount: orderedErrors.length,
    warningCount: orderedWarnings.length,
    errors: orderedErrors,
    warnings: orderedWarnings,
    summary: {
      duplicateCandidateIds: duplicateCandidateIds.size,
      duplicateProposedConceptIds: duplicateProposedIds.size,
      brokenReferences,
      potentialDuplicates: orderedWarnings.filter(
        ({ code }) => code === 'POTENTIAL_SEMANTIC_DUPLICATE',
      ).length,
      aliasConflicts: orderedWarnings.filter(
        ({ code }) => code === 'ALIAS_CONFLICT',
      ).length,
      expertReviewRequired: candidates.filter(
        ({ expertReviewRequired }) => expertReviewRequired,
      ).length,
    },
  };
}
