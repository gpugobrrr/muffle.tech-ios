const args = process.argv.slice(2);
if (args.length > 0) {
  throw new Error('Usage: node scripts/generate-ontology-review-questions-v1.mjs');
}

throw new Error(
  'ontology-review-v1 is frozen historical evidence and cannot be regenerated. Generate ontology-review-v2 instead.',
);
