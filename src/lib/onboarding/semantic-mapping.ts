import type { MuffleOntologyV1 } from '@/domain/ontology/muffle-ontology.v1';

export type FirmSemanticFragment = {
  firmTerm: string;
  nearbyHeading?: string;
  representativeText?: string;
};

export type CandidateConcept = {
  conceptId: string;
  label: string;
  aliases: readonly string[];
  description: string;
  score: number;
  matchedTerms: readonly string[];
};

export type CandidateRetriever = {
  retrieve(
    fragment: FirmSemanticFragment,
    ontology: MuffleOntologyV1,
  ): CandidateConcept[];
};

export type SemanticMappingInput = {
  fragment: FirmSemanticFragment;
  candidates: CandidateConcept[];
};

export type MappingProposal = {
  firmTerm: string;
  selectedConceptId: string | null;
  confidence: number;
  alternatives: string[];
  rationale: string;
};

export type SemanticMapper = {
  proposeMapping(input: SemanticMappingInput): Promise<MappingProposal>;
};
