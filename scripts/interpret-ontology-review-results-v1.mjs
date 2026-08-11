import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  formatOntologyReviewInterpretationMarkdown,
  interpretOntologyReviewResultsV1,
  serializeOntologyReviewInterpretationJson,
} from '@/domain/ontology/review/interpret-ontology-review-results.v1';

function parseArguments(args) {
  let answersPath;
  let jsonOutputPath;
  let markdownOutputPath;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === '--answers' && value) {
      answersPath = value;
      index += 1;
    } else if (argument === '--json-output' && value) {
      jsonOutputPath = value;
      index += 1;
    } else if (argument === '--markdown-output' && value) {
      markdownOutputPath = value;
      index += 1;
    } else {
      throw new Error(
        'Usage: npm run ontology:review:interpret -- --answers <path> [--json-output <path> --markdown-output <path>]',
      );
    }
  }
  if (!answersPath || Boolean(jsonOutputPath) !== Boolean(markdownOutputPath)) {
    throw new Error(
      'Usage: npm run ontology:review:interpret -- --answers <path> [--json-output <path> --markdown-output <path>]',
    );
  }
  return { answersPath, jsonOutputPath, markdownOutputPath };
}

const options = parseArguments(process.argv.slice(2));
const answersPath = resolve(options.answersPath);
const questionSetPath = resolve(
  'apps',
  'ontology-review',
  'data',
  'ontology-review-v1.json',
);
const [answerText, questionSetText] = await Promise.all([
  readFile(answersPath, 'utf8'),
  readFile(questionSetPath, 'utf8'),
]);
const result = interpretOntologyReviewResultsV1({
  questionSet: JSON.parse(questionSetText),
  answerPayload: JSON.parse(answerText),
  sourceDescriptor: answersPath,
});
const json = serializeOntologyReviewInterpretationJson(result);
const markdown = formatOntologyReviewInterpretationMarkdown(result);

if (options.jsonOutputPath && options.markdownOutputPath) {
  const jsonOutputPath = resolve(options.jsonOutputPath);
  const markdownOutputPath = resolve(options.markdownOutputPath);
  await Promise.all([
    mkdir(dirname(jsonOutputPath), { recursive: true }),
    mkdir(dirname(markdownOutputPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(jsonOutputPath, json, 'utf8'),
    writeFile(markdownOutputPath, markdown, 'utf8'),
  ]);
  console.log(
    JSON.stringify(
      {
        jsonOutputPath,
        markdownOutputPath,
        questionSetVersion: result.questionSetVersion,
        counts: result.counts,
        dispositionTotals: result.dispositionTotals,
      },
      null,
      2,
    ),
  );
} else {
  process.stderr.write(markdown);
  process.stdout.write(json);
}

if (result.validationIssues.some(({ severity }) => severity === 'error')) {
  process.exitCode = 1;
}
