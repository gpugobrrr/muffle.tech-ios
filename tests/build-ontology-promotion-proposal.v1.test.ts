import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOntologyPromotionProposalV1,
  formatOntologyPromotionProposalMarkdown,
  serializeOntologyPromotionProposalJson,
} from '@/domain/ontology/review/build-ontology-promotion-proposal.v1';
import { parseOntologyPromotionProposalCliArguments } from '@/domain/ontology/review/ontology-promotion-proposal-cli.v1';
import {
  type InterpretedOntologyReviewItem,
  type OntologyReviewInterpretationResult,
} from '@/domain/ontology/review/interpret-ontology-review-results.v1';
import {
  MUFFLE_ONTOLOGY_CANDIDATES_V1,
  type OntologyCandidateProposal,
} from '@/domain/ontology/review/muffle-ontology-candidates.v1';
import { serializeMuffleOntologyV1 } from '@/domain/ontology/muffle-ontology.v1';

function item(
  candidateId: string,
  disposition: InterpretedOntologyReviewItem['disposition'],
  usableAsOntologyEvidence: boolean,
): InterpretedOntologyReviewItem {
  const candidate = MUFFLE_ONTOLOGY_CANDIDATES_V1.find(({ id }) => id === candidateId);
  if (!candidate) throw new Error(`Missing fixture candidate: ${candidateId}`);
  return {
    questionSetVersion: 'ontology-review-v1',
    questionId: `question.${candidateId}`,
    candidateId,
    auditIssueCodes: [],
    currentAuditIssueCodes: [],
    questionText: `Review ${candidate.sourceTerm}`,
    answer: disposition === 'approve-for-canonical-review' ? 'yes' : 'no',
    reviewerId: 'reviewer-test',
    sourceTerm: candidate.sourceTerm,
    proposedTerm: candidate.label,
    proposedConceptId: candidate.proposedConceptId,
    mapsToExistingConceptId: candidate.mapsToExistingConceptId,
    disposition,
    reasonCode: 'fixture',
    usableAsOntologyEvidence,
    furtherExpertReviewRequired: !usableAsOntologyEvidence,
  };
}

function interpretation(
  items: readonly InterpretedOntologyReviewItem[],
): OntologyReviewInterpretationResult {
  const usableEvidence = items.filter(({ usableAsOntologyEvidence }) => usableAsOntologyEvidence)
    .length;
  return {
    interpreterVersion: 'ontology-review-interpreter-v1',
    questionSetVersion: 'ontology-review-v1',
    sourceDescriptor: 'external-fixture.json',
    reviewers: ['reviewer-test'],
    counts: {
      generatedQuestions: items.length,
      answersReceived: items.length,
      matchedAnswers: items.length,
      yes: items.filter(({ answer }) => answer === 'yes').length,
      no: items.filter(({ answer }) => answer === 'no').length,
      notSure: 0,
      usableEvidence,
      invalidQuestions: items.filter(({ disposition }) => disposition === 'invalid-question')
        .length,
      reaskRequired: items.filter(({ disposition }) => disposition === 'reask-required')
        .length,
      manualReviewRequired: 0,
      unknownAnswers: 0,
      missingAnswers: 0,
    },
    dispositionTotals: {},
    validationIssues: [],
    interpretedItems: items,
    manualReviewItems: [],
  };
}

test('CLI accepts an external interpretation path and optional output directory', () => {
  assert.deepEqual(
    parseOntologyPromotionProposalCliArguments([
      '--interpretation',
      'C:/external/interpretation.json',
      '--out-dir',
      'C:/external/output',
    ]),
    {
      interpretationPath: 'C:/external/interpretation.json',
      outDir: 'C:/external/output',
    },
  );
  assert.throws(
    () => parseOntologyPromotionProposalCliArguments(['--out-dir', 'output']),
    /Usage/,
  );
});

test('builds proposals only from usable candidate evidence and preserves constraints', () => {
  const result = buildOntologyPromotionProposalV1({
    interpretation: interpretation([
      item(
        'candidate.building_element.window',
        'approve-for-canonical-review',
        true,
      ),
      item('candidate.building_element.drainage', 'keep-distinct', true),
      item(
        'candidate.building_element.external_drainage',
        'invalid-question',
        false,
      ),
      item('candidate.building_element.internal_wall', 'reask-required', false),
      item('candidate.building_element.balcony', 'keep-uncertain', false),
    ]),
  });
  const byCandidate = new Map(result.proposalItems.map((proposal) => [proposal.candidateId, proposal]));

  assert.equal(byCandidate.get('candidate.building_element.window')?.proposedAction, 'add-canonical-concept');
  assert.equal(byCandidate.get('candidate.building_element.drainage')?.proposedAction, 'no-promotion-proposed');
  assert.equal(byCandidate.has('candidate.building_element.external_drainage'), false);
  assert.equal(byCandidate.has('candidate.building_element.internal_wall'), false);
  assert.equal(result.keepDistinctConstraints.length, 1);
  assert.equal(result.invalidHistoricalItems.length, 1);
  assert.equal(result.reaskRequiredItems.length, 1);
  assert.equal(result.keepUncertainItems.length, 1);
  assert.equal(
    result.proposalItems.every(
      ({ requiresHumanApproval, safeToAutoPromote }) =>
        requiresHumanApproval && !safeToAutoPromote,
    ),
    true,
  );
});

test('publication evidence cannot add a canonical concept and manual review remains unresolved', () => {
  const publication = item(
    'candidate.publication.rics-d4-main-walls',
    'publication-boundary-supported',
    true,
  );
  const manual = {
    questionSetVersion: 'ontology-review-v1',
    candidateId: 'candidate.value.condition-rating',
    auditIssueCodes: ['EXPERT_REVIEW_REQUIRED'],
    currentAuditIssueCodes: ['EXPERT_REVIEW_REQUIRED'],
    sourceTerm: 'Condition Rating 2',
    reason: 'Manual review is required.',
    disposition: 'manual-review-required' as const,
    usableAsOntologyEvidence: false as const,
    furtherExpertReviewRequired: true as const,
  };
  const source = interpretation([publication]);
  const result = buildOntologyPromotionProposalV1({
    interpretation: { ...source, manualReviewItems: [manual] },
  });

  assert.equal(result.proposalItems[0]?.proposedAction, 'treat-as-publication');
  assert.equal(result.proposalItems[0]?.recommendedCanonical, false);
  assert.equal(result.manualReviewItems.length, 1);
  assert.equal(result.manualReviewItems[0]?.safeToAutoPromote, false);
});

test('exact canonical collisions, explicit mappings, and aliases are surfaced', () => {
  const collisionCandidate: OntologyCandidateProposal = {
    ...MUFFLE_ONTOLOGY_CANDIDATES_V1.find(
      ({ id }) => id === 'candidate.building_element.window',
    )!,
    id: 'candidate.test.existing-wall',
    sourceTerm: 'External wall',
    label: 'External wall',
    proposedConceptId: 'building_element.external_wall',
  };
  const collisionEvidence: InterpretedOntologyReviewItem = {
    ...item(
      'candidate.building_element.window',
      'approve-for-canonical-review',
      true,
    ),
    candidateId: collisionCandidate.id,
    sourceTerm: collisionCandidate.sourceTerm,
    proposedTerm: collisionCandidate.label,
    proposedConceptId: collisionCandidate.proposedConceptId,
  };
  const aliasEvidence = item('candidate.alias.main-walls', 'keep-distinct', true);
  const result = buildOntologyPromotionProposalV1({
    interpretation: interpretation([collisionEvidence, aliasEvidence]),
    candidates: [...MUFFLE_ONTOLOGY_CANDIDATES_V1, collisionCandidate],
  });
  const collision = result.proposalItems.find(
    ({ candidateId }) => candidateId === collisionCandidate.id,
  );
  const alias = result.proposalItems.find(
    ({ candidateId }) => candidateId === 'candidate.alias.main-walls',
  );

  assert.equal(
    collision?.existingCanonicalMatches.some(
      ({ conceptId, matchType }) =>
        conceptId === 'building_element.external_wall' && matchType === 'exact-id',
    ),
    true,
  );
  assert.equal(
    alias?.existingCanonicalMatches.some(
      ({ conceptId, matchType }) =>
        conceptId === 'building_element.external_wall' && matchType === 'explicit-mapping',
    ),
    true,
  );
  assert.equal(alias?.proposedAction, 'treat-as-publication');
});

test('incompatible interpretation counts fail without changing ontology sources', () => {
  const ontologyBefore = serializeMuffleOntologyV1();
  const candidatesBefore = structuredClone(MUFFLE_ONTOLOGY_CANDIDATES_V1);
  const source = interpretation([
    item('candidate.building_element.window', 'approve-for-canonical-review', true),
  ]);
  assert.throws(
    () =>
      buildOntologyPromotionProposalV1({
        interpretation: {
          ...source,
          counts: { ...source.counts, usableEvidence: 9 },
        },
      }),
    /usable-evidence count/,
  );
  assert.equal(serializeMuffleOntologyV1(), ontologyBefore);
  assert.deepEqual(MUFFLE_ONTOLOGY_CANDIDATES_V1, candidatesBefore);
});

test('complete interpretation-shaped input produces deterministic proposal output', () => {
  const source = interpretation([
    item('candidate.building_element.window', 'approve-for-canonical-review', true),
    item('candidate.building_element.drainage', 'keep-distinct', true),
    item('candidate.building_element.balcony', 'keep-uncertain', false),
  ]);
  const first = buildOntologyPromotionProposalV1({ interpretation: source });
  const second = buildOntologyPromotionProposalV1({
    interpretation: structuredClone(source),
  });

  assert.equal(serializeOntologyPromotionProposalJson(first), serializeOntologyPromotionProposalJson(second));
  assert.equal(
    formatOntologyPromotionProposalMarkdown(first),
    formatOntologyPromotionProposalMarkdown(second),
  );
  assert.equal(first.proposalCounts.usableEvidenceCandidatesEvaluated, 2);
});
