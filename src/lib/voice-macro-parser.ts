import {
  buildCanonicalClause,
  getCanonicalDefect,
  getCanonicalMissingSlots,
  type CanonicalDefectId,
  type ConditionRating,
  type RICSClause,
  type RoomContext,
} from '@/domain/ontology/canonical-defects';
import {
  extractConditionRating,
  extractSlots,
  filterSlotsForDefect,
  matchDeterministic,
  normalizePhrase,
} from '@/domain/normalization/deterministic-matcher';
import { getFirmAliasTrie } from '@/domain/normalization/dynamic-alias-store';
import {
  matchSemantic,
  SEMANTIC_CONFIDENCE_THRESHOLD,
} from '@/domain/normalization/semantic-fallback-matcher';

export type MatchTier = 'deterministic' | 'semantic' | 'unclassified';

export type ParsedVoiceFinding = {
  conditionRating: ConditionRating;
  defectId: CanonicalDefectId;
  clause: RICSClause;
  slots: Record<string, string>;
  missingSlots: string[];
  matchTier: MatchTier;
  confidence: number;
  rawTranscript: string;
  roomContext: RoomContext;
};

export type VoiceMacroParseOptions = {
  firmId?: string;
};

export const DEFAULT_VOICE_FIRM_ID = 'default';

const UNCLASSIFIED_ROOM: RoomContext = 'roof_void';

function resolveDefect(
  text: string,
  firmId: string,
): {
  defectId: CanonicalDefectId;
  matchTier: MatchTier;
  confidence: number;
} {
  const firmTrie = getFirmAliasTrie(firmId);
  const deterministic = matchDeterministic(text, firmTrie);
  if (deterministic) {
    return {
      defectId: deterministic.defectId,
      matchTier: 'deterministic',
      confidence: 1,
    };
  }

  const semantic = matchSemantic(text);
  if (semantic && semantic.confidence >= SEMANTIC_CONFIDENCE_THRESHOLD) {
    return {
      defectId: semantic.defectId,
      matchTier: 'semantic',
      confidence: semantic.confidence,
    };
  }

  return {
    defectId: 'unclassified',
    matchTier: 'unclassified',
    confidence: semantic?.confidence ?? 0,
  };
}

function buildSlots(
  defectId: CanonicalDefectId,
  text: string,
  rawInput: string,
): Record<string, string> {
  const extracted = extractSlots(text);
  if (defectId === 'unclassified') {
    return {
      ...extracted,
      raw_transcript: rawInput.trim(),
    };
  }
  return filterSlotsForDefect(defectId, extracted);
}

/** Partial voice patch used when updating an existing finding in place. */
export type VoiceMacroPatch = {
  conditionRating: ConditionRating | null;
  defectId: CanonicalDefectId | null;
  slots: Record<string, string>;
};

export function parseVoiceMacroPatch(
  input: string,
  options: VoiceMacroParseOptions = {},
): VoiceMacroPatch {
  const firmId = options.firmId ?? DEFAULT_VOICE_FIRM_ID;
  const normalized = normalizePhrase(input);
  const resolved = resolveDefect(normalized, firmId);
  const slots = extractSlots(normalized);

  return {
    conditionRating: extractConditionRating(normalized),
    defectId:
      resolved.matchTier === 'unclassified' ? null : resolved.defectId,
    slots,
  };
}

export function parseVoiceMacro(
  input: string,
  options: VoiceMacroParseOptions = {},
): ParsedVoiceFinding {
  const firmId = options.firmId ?? DEFAULT_VOICE_FIRM_ID;
  const normalized = normalizePhrase(input);
  const resolved = resolveDefect(normalized, firmId);
  const slots = buildSlots(resolved.defectId, normalized, input);
  const definition = getCanonicalDefect(resolved.defectId);
  const conditionRating =
    extractConditionRating(normalized) ??
    definition?.defaultRating ??
    'CR2';
  const clause = buildCanonicalClause(resolved.defectId, slots);
  const missingSlots = getCanonicalMissingSlots(resolved.defectId, slots);

  return {
    conditionRating,
    defectId: resolved.defectId,
    clause,
    slots,
    missingSlots,
    matchTier: resolved.matchTier,
    confidence: resolved.confidence,
    rawTranscript: input.trim(),
    roomContext: definition?.roomContext ?? UNCLASSIFIED_ROOM,
  };
}
