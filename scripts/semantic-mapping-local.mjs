import {
  getOntologyConcept,
  MUFFLE_ONTOLOGY_V1,
} from '@/domain/ontology/muffle-ontology.v1';
import { LexicalCandidateRetriever } from '@/lib/onboarding/lexical-candidate-retriever';
import { LlamaCppSemanticMapper } from '@/lib/onboarding/llama-cpp-semantic-mapper';
import { SEMANTIC_MAPPING_FIXTURES } from '@/lib/onboarding/semantic-mapping-fixtures';

const retriever = new LexicalCandidateRetriever(5);
const mapper = new LlamaCppSemanticMapper();

const positiveCandidates = retriever.retrieve(
  SEMANTIC_MAPPING_FIXTURES.obviousPositive,
  MUFFLE_ONTOLOGY_V1,
);
const positive = await mapper.proposeMapping({
  fragment: SEMANTIC_MAPPING_FIXTURES.obviousPositive,
  candidates: positiveCandidates,
});

const parentCandidate = getOntologyConcept('building_element');
if (!parentCandidate) {
  throw new Error('Expected building_element ontology concept is missing.');
}
const negativeCandidates = [
  {
    conceptId: parentCandidate.id,
    label: parentCandidate.label,
    aliases: parentCandidate.aliases ?? [],
    description: parentCandidate.description,
    score: 0,
    matchedTerms: [],
  },
];
const negative = await mapper.proposeMapping({
  fragment: SEMANTIC_MAPPING_FIXTURES.unresolvedNegative,
  candidates: negativeCandidates,
});

if (negative.selectedConceptId !== null) {
  throw new Error(
    `Expected unresolved Tenure proposal, got ${negative.selectedConceptId}.`,
  );
}

console.log(
  JSON.stringify(
    {
      prerequisite: 'llama-server must already be running at http://127.0.0.1:8080',
      positive: {
        candidates: positiveCandidates,
        proposal: positive,
      },
      negative: {
        candidates: negativeCandidates,
        proposal: negative,
      },
    },
    null,
    2,
  ),
);
