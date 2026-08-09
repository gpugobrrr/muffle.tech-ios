import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  generateOntologyReviewQuestionsV1,
} from '@/domain/ontology/review/generate-ontology-review-questions.v1';

const args = process.argv.slice(2);
if (args.length > 0) {
  throw new Error('Usage: npm run ontology:review:generate');
}

const questionSet = generateOntologyReviewQuestionsV1();
const outputPath = resolve(
  'apps',
  'ontology-review',
  'data',
  `${questionSet.version}.json`,
);

await mkdir(resolve('apps', 'ontology-review', 'data'), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(questionSet, null, 2)}\n`, 'utf8');
console.log(
  JSON.stringify(
    {
      outputPath,
      version: questionSet.version,
      questionCount: questionSet.questions.length,
      manualQuestionReviewCount: questionSet.manualQuestionReview.length,
    },
    null,
    2,
  ),
);
