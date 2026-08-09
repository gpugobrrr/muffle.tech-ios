import {
  auditMuffleOntologyCandidatesV1,
} from '@/domain/ontology/review/audit-muffle-ontology-candidates.v1';

const args = process.argv.slice(2);
if (args.some((argument) => argument !== '--json')) {
  throw new Error('Usage: npm run ontology:candidates:audit [-- --json]');
}

const result = auditMuffleOntologyCandidatesV1();

if (args.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const { summary } = result;
  console.log('Ontology Candidate Audit');
  console.log('========================');
  console.log('');
  console.log(`Candidates: ${result.candidateCount}`);
  console.log(`Errors: ${result.errorCount}`);
  console.log(`Warnings: ${result.warningCount}`);
  console.log('');
  console.log('Integrity');
  console.log('---------');
  console.log(`Duplicate candidate IDs: ${summary.duplicateCandidateIds}`);
  console.log(`Duplicate proposed IDs: ${summary.duplicateProposedConceptIds}`);
  console.log(`Broken references: ${summary.brokenReferences}`);
  console.log('');
  console.log('Review');
  console.log('------');
  console.log(`Potential duplicates: ${summary.potentialDuplicates}`);
  console.log(`Alias conflicts: ${summary.aliasConflicts}`);
  console.log(
    `Low-confidence canonical proposals: ${
      result.warnings.filter(({ code }) => code === 'LOW_CONFIDENCE_NEW_CANONICAL')
        .length
    }`,
  );
  console.log(`Expert review required: ${summary.expertReviewRequired}`);

  for (const [heading, issues] of [
    ['Errors', result.errors],
    [
      'Warnings',
      result.warnings.filter(({ code }) => code !== 'EXPERT_REVIEW_REQUIRED'),
    ],
  ]) {
    if (issues.length === 0) continue;
    console.log('');
    console.log(heading);
    console.log('-'.repeat(heading.length));
    for (const auditIssue of issues) {
      const references = [
        auditIssue.candidateId,
        ...(auditIssue.relatedCandidateIds ?? []),
        auditIssue.conceptId,
      ].filter(Boolean);
      console.log(
        `[${auditIssue.code}]${references.length > 0 ? ` ${references.join(' / ')}` : ''}`,
      );
      console.log(`  ${auditIssue.message}`);
    }
  }
  if (summary.expertReviewRequired > 0) {
    console.log('');
    console.log(
      `[EXPERT_REVIEW_REQUIRED] ${summary.expertReviewRequired} candidates require expert review; use --json or the CSV export for the complete list.`,
    );
  }
}

process.exitCode = result.errorCount > 0 ? 1 : 0;
