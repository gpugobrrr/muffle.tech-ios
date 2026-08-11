import {
  MUFFLE_ONTOLOGY_V1,
  type MuffleOntologyV1,
  type OntologyConcept,
  type OntologyConceptKind,
} from '@/domain/ontology/muffle-ontology.v1';
import {
  auditMuffleOntologyCandidatesV1,
  type OntologyCandidateAuditResult,
} from '@/domain/ontology/review/audit-muffle-ontology-candidates.v1';
import type {
  InterpretedOntologyManualReviewItem,
  InterpretedOntologyReviewItem,
  OntologyReviewInterpretationResult,
} from '@/domain/ontology/review/interpret-ontology-review-results.v1';
import {
  MUFFLE_ONTOLOGY_CANDIDATES_V1,
  type OntologyCandidateProposal,
} from '@/domain/ontology/review/muffle-ontology-candidates.v1';

export const ONTOLOGY_PROMOTION_PROPOSAL_VERSION =
  'ontology-promotion-proposal-v1' as const;

export type OntologyPromotionAction =
  | 'add-canonical-concept'
  | 'map-to-existing-canonical'
  | 'revise-kind'
  | 'revise-parent'
  | 'treat-as-attribute'
  | 'treat-as-value'
  | 'treat-as-relationship'
  | 'treat-as-publication'
  | 'retain-candidate'
  | 'requires-semantic-review'
  | 'no-promotion-proposed';

export type OntologyPromotionProposalItem = {
  candidateId: string;
  sourceTerm: string;
  proposedConceptId?: string;
  expertDisposition: string;
  usableAsOntologyEvidence: true;
  expertEvidence: {
    questionId: string;
    questionText: string;
    answer: string;
    reviewerId: string;
    reviewedAt?: string;
  };
  candidateClassification: OntologyCandidateProposal['classification'];
  candidateConfidence: OntologyCandidateProposal['confidence'];
  candidateSources: readonly OntologyCandidateProposal['sources'][number][];
  currentKind?: OntologyConceptKind;
  recommendedKind?: OntologyConceptKind;
  currentParentId?: string;
  recommendedParentId?: string;
  currentCanonicalIntent: boolean;
  recommendedCanonical: boolean;
  existingCanonicalMatches: readonly OntologyCanonicalMatch[];
  possibleAliasOrCollisionIds: readonly string[];
  proposedAction: OntologyPromotionAction;
  actionReasonCodes: readonly string[];
  rationale: string;
  unresolvedQuestions: readonly string[];
  requiresHumanApproval: true;
  safeToAutoPromote: false;
};

export type OntologyCanonicalMatch = {
  conceptId: string;
  matchType: 'exact-id' | 'explicit-mapping' | 'alias' | 'normalized-label' | 'audit-overlap';
  label: string;
  kind: OntologyConceptKind;
  parentId?: string;
  ownership: OntologyConcept['ownership'];
  maturity: OntologyConcept['maturity'];
  valueType?: OntologyConcept['valueType'];
};

export type OntologyPromotionUnresolvedItem = {
  candidateId?: string;
  relationshipId?: string;
  sourceTerm?: string;
  expertDisposition: string;
  reasonCodes: readonly string[];
  rationale: string;
  requiresHumanApproval: true;
  safeToAutoPromote: false;
};

export type OntologyPromotionDistinctConstraint = {
  candidateId: string;
  otherTerm?: string;
  questionId: string;
  rationale: string;
};

export type OntologyPromotionProposal = {
  proposalVersion: typeof ONTOLOGY_PROMOTION_PROPOSAL_VERSION;
  interpretation: {
    interpreterVersion: string;
    questionSetVersion: string;
    sourceDescriptor: string;
    counts: OntologyReviewInterpretationResult['counts'];
    dispositionTotals: Readonly<Record<string, number>>;
  };
  proposalCounts: {
    usableEvidenceCandidatesEvaluated: number;
    promotionProposalItems: number;
    keepDistinctConstraints: number;
    publicationOnlyItems: number;
    unresolvedKeepUncertainItems: number;
    unresolvedReaskItems: number;
    invalidHistoricalItems: number;
    manualReviewItems: number;
    actions: Readonly<Record<string, number>>;
  };
  proposalItems: readonly OntologyPromotionProposalItem[];
  keepDistinctConstraints: readonly OntologyPromotionDistinctConstraint[];
  publicationOnlyItems: readonly OntologyPromotionProposalItem[];
  keepUncertainItems: readonly OntologyPromotionUnresolvedItem[];
  reaskRequiredItems: readonly OntologyPromotionUnresolvedItem[];
  invalidHistoricalItems: readonly OntologyPromotionUnresolvedItem[];
  manualReviewItems: readonly OntologyPromotionUnresolvedItem[];
};

export type BuildOntologyPromotionProposalInput = {
  interpretation: OntologyReviewInterpretationResult;
  candidates?: readonly OntologyCandidateProposal[];
  ontology?: MuffleOntologyV1;
  audit?: OntologyCandidateAuditResult;
};

const CLEAR_ELEMENT_ADDS = new Set([
  'candidate.building_element.ceiling',
  'candidate.building_element.chimney',
  'candidate.building_element.damp_proof_course',
  'candidate.building_element.fireplace',
  'candidate.building_element.porch',
  'candidate.building_element.rainwater_goods',
  'candidate.building_element.staircase',
  'candidate.building_element.window',
]);

const CLEAR_FINDING_FIELD_ADDS = new Set([
  'candidate.cause',
  'candidate.further_investigation',
  'candidate.implication',
  'candidate.risk',
  'candidate.significance',
]);

const STRUCTURE_OR_SPACE_KIND_REVIEW = new Set([
  'candidate.building_element.cellar_basement',
  'candidate.building_element.conservatory',
  'candidate.building_element.garage',
  'candidate.building_element.outbuilding',
]);

const GROUNDS_PARENT_REVIEW = new Set([
  'candidate.building_element.driveway',
  'candidate.building_element.path',
  'candidate.building_element.patio',
]);

const SEMANTIC_SHAPE_REVIEW = new Set([
  'candidate.building_element.floor',
  'candidate.building_element.foundation',
  'candidate.building_element.partition',
  'candidate.building_element.tree_vegetation',
  'candidate.building_element.ventilation',
  'candidate.measurement',
]);

const CANONICAL_MATCH_PRIORITY: Record<OntologyCanonicalMatch['matchType'], number> = {
  'exact-id': 0,
  'explicit-mapping': 1,
  alias: 2,
  'normalized-label': 3,
  'audit-overlap': 4,
};

function normalize(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(\w{4,})s\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function match(
  concept: OntologyConcept,
  matchType: OntologyCanonicalMatch['matchType'],
): OntologyCanonicalMatch {
  return {
    conceptId: concept.id,
    matchType,
    label: concept.label,
    kind: concept.kind,
    parentId: concept.parentId,
    ownership: concept.ownership,
    maturity: concept.maturity,
    valueType: concept.valueType,
  };
}

function canonicalMatches(
  candidate: OntologyCandidateProposal,
  ontology: MuffleOntologyV1,
  audit: OntologyCandidateAuditResult,
): OntologyCanonicalMatch[] {
  const matches = new Map<string, OntologyCanonicalMatch>();
  const add = (
    concept: OntologyConcept | undefined,
    matchType: OntologyCanonicalMatch['matchType'],
  ) => {
    if (!concept || !concept.canonical) return;
    const existing = matches.get(concept.id);
    if (
      !existing ||
      CANONICAL_MATCH_PRIORITY[matchType] <
        CANONICAL_MATCH_PRIORITY[existing.matchType]
    ) {
      matches.set(concept.id, match(concept, matchType));
    }
  };
  add(
    ontology.concepts.find(({ id }) => id === candidate.proposedConceptId),
    'exact-id',
  );
  add(
    ontology.concepts.find(({ id }) => id === candidate.mapsToExistingConceptId),
    'explicit-mapping',
  );
  const terms = [candidate.sourceTerm, candidate.label, ...(candidate.aliases ?? [])];
  for (const concept of ontology.concepts) {
    if (!concept.canonical) continue;
    const conceptTerms = [concept.label, ...(concept.aliases ?? [])].map(normalize);
    for (const term of terms) {
      const normalized = normalize(term);
      if (!normalized) continue;
      if (normalize(concept.label) === normalized) {
        add(concept, 'normalized-label');
      } else if (conceptTerms.includes(normalized)) {
        add(concept, 'alias');
      }
    }
  }
  for (const issue of audit.warnings) {
    if (
      issue.code === 'OVERLAPS_EXISTING_CANONICAL_CONCEPT' &&
      issue.candidateId === candidate.id
    ) {
      add(
        ontology.concepts.find(({ id }) => id === issue.conceptId),
        'audit-overlap',
      );
    }
  }
  return [...matches.values()].sort(
    (left, right) =>
      left.conceptId.localeCompare(right.conceptId) ||
      left.matchType.localeCompare(right.matchType),
  );
}

function collisionIds(
  candidate: OntologyCandidateProposal,
  audit: OntologyCandidateAuditResult,
): string[] {
  return [
    ...new Set(
      audit.warnings
        .filter(
          ({ candidateId, relatedCandidateIds }) =>
            candidateId === candidate.id ||
            relatedCandidateIds?.includes(candidate.id) === true,
        )
        .flatMap(({ relatedCandidateIds }) => relatedCandidateIds ?? [])
        .filter((id) => id !== candidate.id),
    ),
  ].sort();
}

function recommendation(
  candidate: OntologyCandidateProposal,
  evidence: InterpretedOntologyReviewItem,
): Pick<
  OntologyPromotionProposalItem,
  | 'recommendedKind'
  | 'recommendedParentId'
  | 'recommendedCanonical'
  | 'proposedAction'
  | 'actionReasonCodes'
  | 'rationale'
  | 'unresolvedQuestions'
> {
  if (evidence.disposition === 'publication-boundary-supported') {
    return {
      recommendedKind: 'publication',
      recommendedParentId: undefined,
      recommendedCanonical: false,
      proposedAction: 'treat-as-publication',
      actionReasonCodes: [
        'expert-publication-boundary-supported',
        'candidate-maps-to-existing-canonical-concept',
      ],
      rationale:
        'The reviewed wording is supported as publication terminology. Retain it only as noncanonical report/adapter metadata.',
      unresolvedQuestions: [],
    };
  }
  if (evidence.disposition === 'keep-distinct') {
    if (candidate.id === 'candidate.alias.main-walls') {
      return {
        recommendedKind: 'publication',
        recommendedParentId: undefined,
        recommendedCanonical: false,
        proposedAction: 'treat-as-publication',
        actionReasonCodes: [
          'keep-distinct-from-existing-canonical',
          'firm-or-report-term-not-established-as-alias',
        ],
        rationale:
          'The evidence rejects treating Main Walls as the same as External wall. Do not add it as a canonical alias; retain it for publication/FirmAdapter review only.',
        unresolvedQuestions: [],
      };
    }
    if (candidate.id === 'candidate.limitation') {
      return {
        recommendedKind: candidate.kind,
        recommendedParentId: candidate.parentId,
        recommendedCanonical: false,
        proposedAction: 'requires-semantic-review',
        actionReasonCodes: [
          'keep-distinct-from-brief-limitation',
          'finding-level-scope-requires-adjudication',
        ],
        rationale:
          'The evidence supports a distinction from existing brief-level Limitations, but does not establish the exact finding-level field shape.',
        unresolvedQuestions: [
          'Should a finding-level limitation be a field, a structured inspection constraint, or a relationship to the inspection brief?',
        ],
      };
    }
    return {
      recommendedKind: candidate.kind,
      recommendedParentId: candidate.parentId,
      recommendedCanonical: false,
      proposedAction: 'no-promotion-proposed',
      actionReasonCodes: ['keep-distinct-constraint-only'],
      rationale:
        'The evidence supports distinction from the comparison term only. It does not independently establish a canonical shape or promotion action.',
      unresolvedQuestions: [],
    };
  }
  if (CLEAR_ELEMENT_ADDS.has(candidate.id) || CLEAR_FINDING_FIELD_ADDS.has(candidate.id)) {
    return {
      recommendedKind: candidate.kind,
      recommendedParentId: candidate.parentId,
      recommendedCanonical: true,
      proposedAction: 'add-canonical-concept',
      actionReasonCodes: [
        'expert-canonical-independence-supported',
        'candidate-shape-aligned-with-existing-canonical-pattern',
        ...(CLEAR_FINDING_FIELD_ADDS.has(candidate.id)
          ? ['relationship-edges-remain-unresolved']
          : []),
      ],
      rationale:
        'The expert evidence supports independent surveying meaning, and the current candidate shape aligns with an existing canonical hierarchy pattern. A separate approved implementation must still define bindings and engine support.',
      unresolvedQuestions: CLEAR_FINDING_FIELD_ADDS.has(candidate.id)
        ? ['No candidate relationship edge is proposed or approved by this artifact.']
        : [],
    };
  }
  if (STRUCTURE_OR_SPACE_KIND_REVIEW.has(candidate.id)) {
    return {
      recommendedKind: 'entity',
      recommendedParentId: 'property',
      recommendedCanonical: false,
      proposedAction: 'revise-kind',
      actionReasonCodes: [
        'expert-canonical-independence-supported',
        'structure-or-space-not-a-simple-building-element-value',
      ],
      rationale:
        'The evidence supports stable surveying meaning, but the current building-element value shape does not distinguish a property substructure or space from a component.',
      unresolvedQuestions: [
        'Confirm whether this belongs as a property substructure, inspectable space, or a different entity family.',
      ],
    };
  }
  if (GROUNDS_PARENT_REVIEW.has(candidate.id)) {
    return {
      recommendedKind: candidate.kind,
      recommendedParentId: undefined,
      recommendedCanonical: false,
      proposedAction: 'revise-parent',
      actionReasonCodes: [
        'expert-canonical-independence-supported',
        'grounds-or-site-subject-needs-parent-taxonomy',
      ],
      rationale:
        'The evidence supports the term as an independent inspection subject, but directly parenting it under generic building elements would blur site/grounds and building semantics.',
      unresolvedQuestions: [
        'Define and approve a site or grounds parent taxonomy before assigning a canonical parent.',
      ],
    };
  }
  if (SEMANTIC_SHAPE_REVIEW.has(candidate.id)) {
    return {
      recommendedKind: candidate.kind,
      recommendedParentId: candidate.parentId,
      recommendedCanonical: false,
      proposedAction: 'requires-semantic-review',
      actionReasonCodes: [
        'expert-canonical-independence-supported',
        'candidate-shape-not-determined-by-evidence',
      ],
      rationale:
        'The expert evidence establishes independent meaning only. Existing metadata does not determine whether this should be a component, system, attribute, measurement structure, subtype, or a differently-parented concept.',
      unresolvedQuestions: [
        'Approve the ontology kind and parent before proposing any canonical record.',
      ],
    };
  }
  return {
    recommendedKind: candidate.kind,
    recommendedParentId: candidate.parentId,
    recommendedCanonical: false,
    proposedAction: 'requires-semantic-review',
    actionReasonCodes: ['no-deterministic-promotion-policy-for-candidate'],
    rationale:
      'The evidence is usable, but existing metadata does not support a conservative deterministic ontology-shape recommendation.',
    unresolvedQuestions: ['Human semantic adjudication is required.'],
  };
}

function unresolved(
  item: InterpretedOntologyReviewItem | InterpretedOntologyManualReviewItem,
  reasonCode: string,
): OntologyPromotionUnresolvedItem {
  return {
    candidateId: item.candidateId,
    relationshipId: item.relationshipId,
    sourceTerm: item.sourceTerm,
    expertDisposition: item.disposition,
    reasonCodes: [reasonCode],
    rationale:
      item.disposition === 'manual-review-required'
        ? ('reason' in item ? item.reason : 'Manual expert review is required.')
        : 'This review item is not usable as promotion evidence and is retained for auditability.',
    requiresHumanApproval: true,
    safeToAutoPromote: false,
  };
}

function actionTotals(items: readonly OntologyPromotionProposalItem[]): Record<string, number> {
  const totals = new Map<string, number>();
  for (const { proposedAction } of items) {
    totals.set(proposedAction, (totals.get(proposedAction) ?? 0) + 1);
  }
  return Object.fromEntries([...totals].sort(([left], [right]) => left.localeCompare(right)));
}

function assertInterpretationCompatibility(
  interpretation: OntologyReviewInterpretationResult,
): void {
  if (
    !interpretation.interpreterVersion ||
    !interpretation.questionSetVersion ||
    !Array.isArray(interpretation.interpretedItems) ||
    !Array.isArray(interpretation.manualReviewItems)
  ) {
    throw new Error('Interpretation artifact is malformed or incompatible.');
  }
  const matchedItems = interpretation.interpretedItems.length;
  if (interpretation.counts.matchedAnswers !== matchedItems) {
    throw new Error('Interpretation matched-answer count does not match interpreted items.');
  }
  const usableEvidence = interpretation.interpretedItems.filter(
    ({ usableAsOntologyEvidence }) => usableAsOntologyEvidence,
  ).length;
  if (interpretation.counts.usableEvidence !== usableEvidence) {
    throw new Error('Interpretation usable-evidence count does not match interpreted items.');
  }
}

export function buildOntologyPromotionProposalV1(
  input: BuildOntologyPromotionProposalInput,
): OntologyPromotionProposal {
  assertInterpretationCompatibility(input.interpretation);
  const candidates = input.candidates ?? MUFFLE_ONTOLOGY_CANDIDATES_V1;
  const ontology = input.ontology ?? MUFFLE_ONTOLOGY_V1;
  const audit = input.audit ?? auditMuffleOntologyCandidatesV1({ candidates, ontology });
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const usableItems = input.interpretation.interpretedItems
    .filter(
      (item): item is InterpretedOntologyReviewItem & { candidateId: string } =>
        item.usableAsOntologyEvidence && Boolean(item.candidateId),
    )
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  const proposalItems = usableItems.map((evidence) => {
    const candidate = candidatesById.get(evidence.candidateId);
    if (!candidate) {
      throw new Error(`Interpretation candidate does not resolve: ${evidence.candidateId}.`);
    }
    const recommendationResult = recommendation(candidate, evidence);
    return {
      candidateId: candidate.id,
      sourceTerm: candidate.sourceTerm,
      proposedConceptId: candidate.proposedConceptId,
      expertDisposition: evidence.disposition,
      usableAsOntologyEvidence: true,
      expertEvidence: {
        questionId: evidence.questionId,
        questionText: evidence.questionText,
        answer: evidence.answer,
        reviewerId: evidence.reviewerId,
        reviewedAt: evidence.reviewedAt,
      },
      candidateClassification: candidate.classification,
      candidateConfidence: candidate.confidence,
      candidateSources: [...candidate.sources].sort(
        (left, right) =>
          left.type.localeCompare(right.type) || left.id.localeCompare(right.id),
      ),
      currentKind: candidate.kind,
      currentParentId: candidate.parentId,
      currentCanonicalIntent: candidate.canonical,
      existingCanonicalMatches: canonicalMatches(candidate, ontology, audit),
      possibleAliasOrCollisionIds: collisionIds(candidate, audit),
      ...recommendationResult,
      requiresHumanApproval: true,
      safeToAutoPromote: false,
    } satisfies OntologyPromotionProposalItem;
  });

  const keepDistinctConstraints = proposalItems
    .filter(({ expertDisposition }) => expertDisposition === 'keep-distinct')
    .map(({ candidateId, expertEvidence }) => ({
      candidateId,
      otherTerm: proposalItems.find((item) => item.candidateId === candidateId)
        ?.expertEvidence.questionText.match(/same thing as “([^”]+)”/)?.[1],
      questionId: expertEvidence.questionId,
      rationale:
        'The completed expert review rejected equivalence. Preserve this as a constraint; it does not establish a replacement canonical concept.',
    }))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));

  const unresolvedItems = input.interpretation.interpretedItems
    .filter(({ usableAsOntologyEvidence }) => !usableAsOntologyEvidence)
    .sort(
      (left, right) =>
        (left.candidateId ?? left.relationshipId ?? left.questionId).localeCompare(
          right.candidateId ?? right.relationshipId ?? right.questionId,
        ),
    );
  const keepUncertainItems = unresolvedItems
    .filter(({ disposition }) => disposition === 'keep-uncertain')
    .map((item) => unresolved(item, 'expert-evidence-remains-uncertain'));
  const reaskRequiredItems = unresolvedItems
    .filter(({ disposition }) => disposition === 'reask-required')
    .map((item) => unresolved(item, 'review-question-must-be-asked-again'));
  const invalidHistoricalItems = unresolvedItems
    .filter(({ disposition }) => disposition === 'invalid-question')
    .map((item) => unresolved(item, 'historical-question-invalid'));
  const manualReviewItems = [...input.interpretation.manualReviewItems]
    .sort(
      (left, right) =>
        (left.candidateId ?? left.relationshipId ?? '').localeCompare(
          right.candidateId ?? right.relationshipId ?? '',
        ),
    )
    .map((item) => unresolved(item, 'manual-expert-review-required'));
  const publicationOnlyItems = proposalItems.filter(
    ({ proposedAction }) => proposedAction === 'treat-as-publication',
  );

  return {
    proposalVersion: ONTOLOGY_PROMOTION_PROPOSAL_VERSION,
    interpretation: {
      interpreterVersion: input.interpretation.interpreterVersion,
      questionSetVersion: input.interpretation.questionSetVersion,
      sourceDescriptor: input.interpretation.sourceDescriptor,
      counts: input.interpretation.counts,
      dispositionTotals: input.interpretation.dispositionTotals,
    },
    proposalCounts: {
      usableEvidenceCandidatesEvaluated: usableItems.length,
      promotionProposalItems: proposalItems.length,
      keepDistinctConstraints: keepDistinctConstraints.length,
      publicationOnlyItems: publicationOnlyItems.length,
      unresolvedKeepUncertainItems: keepUncertainItems.length,
      unresolvedReaskItems: reaskRequiredItems.length,
      invalidHistoricalItems: invalidHistoricalItems.length,
      manualReviewItems: manualReviewItems.length,
      actions: actionTotals(proposalItems),
    },
    proposalItems,
    keepDistinctConstraints,
    publicationOnlyItems,
    keepUncertainItems,
    reaskRequiredItems,
    invalidHistoricalItems,
    manualReviewItems,
  };
}

export function serializeOntologyPromotionProposalJson(
  proposal: OntologyPromotionProposal,
): string {
  return `${JSON.stringify(proposal, null, 2)}\n`;
}

function itemLines(item: OntologyPromotionProposalItem): string[] {
  return [
    `### ${item.sourceTerm}`,
    '',
    `- Candidate: \`${item.candidateId}\``,
    `- Expert evidence: ${item.expertDisposition} (${item.expertEvidence.answer})`,
    `- Existing ontology overlap: ${
      item.existingCanonicalMatches.map(({ conceptId }) => `\`${conceptId}\``).join(', ') ||
      'none resolved'
    }`,
    `- Proposed action: \`${item.proposedAction}\``,
    `- Proposed ID: \`${item.proposedConceptId ?? 'none'}\``,
    `- Proposed kind / parent: \`${item.recommendedKind ?? 'undetermined'}\` / \`${item.recommendedParentId ?? 'undetermined'}\``,
    `- Rationale: ${item.rationale}`,
    `- Risks/questions: ${item.unresolvedQuestions.join(' ') || 'None beyond explicit human approval.'}`,
    '',
  ];
}

export function formatOntologyPromotionProposalMarkdown(
  proposal: OntologyPromotionProposal,
): string {
  const lines = [
    '# Ontology promotion proposal',
    '',
    `- Proposal version: \`${proposal.proposalVersion}\``,
    `- Question set: \`${proposal.interpretation.questionSetVersion}\``,
    `- Interpretation source: \`${proposal.interpretation.sourceDescriptor}\``,
    `- Usable evidence candidates evaluated: ${proposal.proposalCounts.usableEvidenceCandidatesEvaluated}`,
    '',
    '## Action totals',
    '',
    ...Object.entries(proposal.proposalCounts.actions).map(
      ([action, count]) => `- ${action}: ${count}`,
    ),
  ];
  const ready = proposal.proposalItems.filter(
    ({ proposedAction }) => proposedAction === 'add-canonical-concept',
  );
  if (ready.length) {
    lines.push('', '## Ready for human canonical decision', '', ...ready.flatMap(itemLines));
  }
  const existing = proposal.proposalItems.filter(({ proposedAction }) =>
    ['map-to-existing-canonical', 'no-promotion-proposed'].includes(proposedAction),
  );
  if (existing.length) {
    lines.push('', '## Existing concept / alias / mapping review', '', ...existing.flatMap(itemLines));
  }
  const shape = proposal.proposalItems.filter(({ proposedAction }) =>
    ['revise-kind', 'revise-parent', 'requires-semantic-review'].includes(proposedAction),
  );
  if (shape.length) {
    lines.push('', '## Requires semantic review', '', ...shape.flatMap(itemLines));
  }
  if (proposal.keepDistinctConstraints.length) {
    lines.push(
      '',
      '## Keep distinct constraints',
      '',
      ...proposal.keepDistinctConstraints.map(
        ({ candidateId, otherTerm, rationale }) =>
          `- \`${candidateId}\` ≠ ${otherTerm ?? 'comparison term'} — ${rationale}`,
      ),
    );
  }
  if (proposal.publicationOnlyItems.length) {
    lines.push('', '## Publication-only', '', ...proposal.publicationOnlyItems.flatMap(itemLines));
  }
  const unresolvedSections: [string, readonly OntologyPromotionUnresolvedItem[]][] = [
    ['Keep uncertain', proposal.keepUncertainItems],
    ['Re-ask required', proposal.reaskRequiredItems],
    ['Invalid historical questions', proposal.invalidHistoricalItems],
    ['Manual expert review required', proposal.manualReviewItems],
  ];
  for (const [heading, items] of unresolvedSections) {
    if (!items.length) continue;
    lines.push(
      '',
      `## ${heading}`,
      '',
      ...items.map(
        ({ candidateId, relationshipId, sourceTerm, rationale }) =>
          `- \`${candidateId ?? relationshipId ?? 'unresolved'}\`${sourceTerm ? ` (${sourceTerm})` : ''}: ${rationale}`,
      ),
    );
  }
  lines.push(
    '',
    '> This proposal is non-authoritative. Every action requires explicit human approval, and no relationship is promoted.',
    '',
  );
  return lines.join('\n');
}
