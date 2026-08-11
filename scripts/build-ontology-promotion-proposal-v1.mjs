import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  buildOntologyPromotionProposalV1,
  formatOntologyPromotionProposalMarkdown,
  serializeOntologyPromotionProposalJson,
} from '@/domain/ontology/review/build-ontology-promotion-proposal.v1';
import { parseOntologyPromotionProposalCliArguments } from '@/domain/ontology/review/ontology-promotion-proposal-cli.v1';

const options = parseOntologyPromotionProposalCliArguments(process.argv.slice(2));
const interpretationPath = resolve(options.interpretationPath);
const interpretation = JSON.parse(await readFile(interpretationPath, 'utf8'));
const proposal = buildOntologyPromotionProposalV1({ interpretation });
const json = serializeOntologyPromotionProposalJson(proposal);
const markdown = formatOntologyPromotionProposalMarkdown(proposal);

if (options.outDir) {
  const outDir = resolve(options.outDir);
  const jsonOutputPath = resolve(outDir, 'ontology-promotion-proposal-v1.json');
  const markdownOutputPath = resolve(outDir, 'ontology-promotion-proposal-v1.md');
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(jsonOutputPath, json, 'utf8'),
    writeFile(markdownOutputPath, markdown, 'utf8'),
  ]);
  console.log(
    JSON.stringify(
      {
        interpretationPath,
        jsonOutputPath,
        markdownOutputPath,
        proposalCounts: proposal.proposalCounts,
      },
      null,
      2,
    ),
  );
} else {
  process.stderr.write(markdown);
  process.stdout.write(json);
}
