import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  serializeOntologyCandidatesCsv,
  summarizeOntologyCandidates,
} from '@/domain/ontology/review/ontology-candidate-review-export';
import { validateMuffleOntologyCandidatesV1 } from '@/domain/ontology/review/validate-muffle-ontology-candidates.v1';

const failures = validateMuffleOntologyCandidatesV1();
if (failures.length > 0) {
  throw new Error(
    `Ontology candidate register validation failed:\n${failures.join('\n')}`,
  );
}

const outputPath = resolve('dist', 'ontology', 'muffle-ontology-candidates.v1.csv');
await mkdir(resolve('dist', 'ontology'), { recursive: true });
await writeFile(outputPath, `${serializeOntologyCandidatesCsv()}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, ...summarizeOntologyCandidates() }, null, 2));
