import type {
  CandidateConcept,
  SemanticMappingInput,
} from '@/lib/onboarding/semantic-mapping';

export type SemanticMapperPromptVersion = 'v1' | 'v2';

function optionalContext(value: string | undefined): string {
  return value?.trim() || 'Not provided';
}

function candidateDetails(candidate: CandidateConcept): string {
  return [
    `ID: ${candidate.conceptId}`,
    `Label: ${candidate.label}`,
    `Aliases: ${candidate.aliases.length > 0 ? candidate.aliases.join(', ') : 'None'}`,
    `Description: ${candidate.description}`,
  ].join('\n');
}

function buildPromptV1(input: SemanticMappingInput): string {
  const candidates = input.candidates.map((candidate) => ({
    conceptId: candidate.conceptId,
    label: candidate.label,
    aliases: candidate.aliases,
    description: candidate.description,
  }));

  return [
    'You are a semantic ontology mapper for muffle.tech.',
    'Choose ONLY from the supplied candidate ontology concepts.',
    'Rules:',
    '- Never invent a concept ID.',
    '- selectedConceptId must exactly match one supplied candidate ID or be null.',
    '- Return null if none are reliable.',
    '- Return JSON only.',
    '- Return every required field, even when selectedConceptId is null.',
    '- Do not add extra fields.',
    '',
    'Use exactly this JSON shape:',
    '{"firmTerm":"<supplied firm term>","selectedConceptId":null,"confidence":0,"alternatives":[],"rationale":"<short reason>"}',
    '',
    JSON.stringify({
      firmTerm: input.fragment.firmTerm,
      nearbyHeading: input.fragment.nearbyHeading ?? null,
      representativeText: input.fragment.representativeText ?? null,
      candidates,
    }),
  ].join('\n');
}

function buildPromptV2(input: SemanticMappingInput): string {
  const candidateText = input.candidates
    .map(
      (candidate, index) =>
        `Candidate ${index + 1}\n${candidateDetails(candidate)}`,
    )
    .join('\n\n');

  return [
    'You are a bounded semantic ontology classifier for muffle.tech onboarding.',
    'Identify the canonical ontology meaning represented by the firm fragment.',
    'Firm terminology is presentation terminology; it is not itself the canonical meaning.',
    '',
    'Firm term',
    `- ${input.fragment.firmTerm}`,
    'Nearby heading',
    `- ${optionalContext(input.fragment.nearbyHeading)}`,
    'Representative text',
    `- ${optionalContext(input.fragment.representativeText)}`,
    '',
    'Candidate concepts',
    candidateText,
    '',
    'Decision rules',
    '- Choose only a supplied candidate ontology concept or null.',
    '- Use the firm term, nearby heading, and representative text together.',
    '- Candidate descriptions define the available semantic meanings.',
    '- Prefer the most specific supported candidate over a broader or adjacent candidate.',
    '- Do not choose a candidate only because one word overlaps superficially.',
    '- Return null when no supplied candidate is sufficiently supported.',
    '- Never invent an ontology ID.',
    '',
    'Required output',
    '- Return JSON only with exactly the five required fields.',
    '- selectedConceptId must exactly match a supplied candidate ID or be null.',
    '- alternatives must contain only supplied candidate IDs.',
    '- confidence must be a number from 0 to 1.',
    '',
    '{"firmTerm":"<supplied firm term>","selectedConceptId":null,"confidence":0,"alternatives":[],"rationale":"<short reason>"}',
  ].join('\n');
}

export function buildSemanticMappingPrompt(
  input: SemanticMappingInput,
  version: SemanticMapperPromptVersion = 'v1',
): string {
  return version === 'v2' ? buildPromptV2(input) : buildPromptV1(input);
}
