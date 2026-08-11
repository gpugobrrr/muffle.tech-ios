import {
  MUFFLE_ONTOLOGY_CANDIDATES_V1,
  type OntologyCandidateProposal,
} from '@/domain/ontology/review/muffle-ontology-candidates.v1';
import {
  auditMuffleOntologyCandidatesV1,
  type OntologyCandidateAuditResult,
} from '@/domain/ontology/review/audit-muffle-ontology-candidates.v1';

export type OntologyCandidateReviewSummary = {
  total: number;
  byClassification: Record<string, number>;
  byConfidence: Record<string, number>;
  expertReviewRequired: number;
};

export function summarizeOntologyCandidates(
  candidates: readonly OntologyCandidateProposal[] =
    MUFFLE_ONTOLOGY_CANDIDATES_V1,
): OntologyCandidateReviewSummary {
  return {
    total: candidates.length,
    byClassification: Object.fromEntries(
      [...new Set(candidates.map(({ classification }) => classification))]
        .sort()
        .map((classification) => [
          classification,
          candidates.filter(
            (candidate) => candidate.classification === classification,
          ).length,
        ]),
    ),
    byConfidence: Object.fromEntries(
      [...new Set(candidates.map(({ confidence }) => confidence))]
        .sort()
        .map((confidence) => [
          confidence,
          candidates.filter((candidate) => candidate.confidence === confidence)
            .length,
        ]),
    ),
    expertReviewRequired: candidates.filter(
      ({ expertReviewRequired }) => expertReviewRequired,
    ).length,
  };
}

function csvField(value: string | number | boolean | undefined): string {
  const text = value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeOntologyCandidatesCsv(
  candidates: readonly OntologyCandidateProposal[] =
    MUFFLE_ONTOLOGY_CANDIDATES_V1,
  audit: OntologyCandidateAuditResult =
    candidates === MUFFLE_ONTOLOGY_CANDIDATES_V1
      ? auditMuffleOntologyCandidatesV1()
      : auditMuffleOntologyCandidatesV1({ candidates }),
): string {
  const headers = [
    'id',
    'sourceTerm',
    'classification',
    'proposedConceptId',
    'mapsToExistingConceptId',
    'label',
    'parentId',
    'canonical',
    'ownership',
    'maturity',
    'kind',
    'confidence',
    'expertReviewRequired',
    'reviewStatus',
    'auditSeverity',
    'auditIssueCodes',
    'aliases',
    'sourceTypes',
    'sourceIds',
    'rationale',
    'notes',
  ];
  const rows = candidates.map((candidate) => {
    const issues = [...audit.errors, ...audit.warnings].filter(
      ({ candidateId, relatedCandidateIds }) =>
        candidateId === candidate.id ||
        relatedCandidateIds?.includes(candidate.id),
    );
    return [
      candidate.id,
      candidate.sourceTerm,
      candidate.classification,
      candidate.proposedConceptId,
      candidate.mapsToExistingConceptId,
      candidate.label,
      candidate.parentId,
      candidate.canonical,
      candidate.ownership,
      candidate.maturity,
      candidate.kind,
      candidate.confidence,
      candidate.expertReviewRequired,
      candidate.reviewStatus,
      issues.some(({ severity }) => severity === 'error')
        ? 'error'
        : issues.length > 0
          ? 'warning'
          : '',
      issues.map(({ code }) => code).join('; '),
      candidate.aliases?.join('; '),
      candidate.sources.map(({ type }) => type).join('; '),
      candidate.sources.map(({ id }) => id).join('; '),
      candidate.rationale,
      candidate.notes,
    ]
      .map(csvField)
      .join(',');
  });
  return [headers.map(csvField).join(','), ...rows].join('\n');
}
