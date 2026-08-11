import type { LookupResult } from '@/types/lookup';
import type { InspectionBrief } from '@/types/workspace';

export type LookupResolution =
  | { type: 'result'; result: NonNullable<LookupResult> }
  | { type: 'empty'; expected: string }
  | { type: 'unknown' };

/**
 * Resolve a global lookup command against existing workspace data.
 * Does not mutate survey state.
 */
export function resolveLookup(
  rawCommand: string,
  brief: InspectionBrief,
): LookupResolution {
  const trimmed = rawCommand.trim();
  const match = trimmed.match(/^lookup(?:\s+(.+))?$/i);
  if (!match) return { type: 'unknown' };

  const path = (match[1] ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

  if (!path) {
    return { type: 'empty', expected: 'lookup <path>' };
  }

  if (path === 'instr party' || path === 'party') {
    const value = brief.instruction.instructingParty;
    if (!value) {
      return {
        type: 'result',
        result: { label: 'INSTRUCTING PARTY', value: 'Not set' },
      };
    }
    return {
      type: 'result',
      result: { label: 'INSTRUCTING PARTY', value },
    };
  }

  if (path === 'brief') {
    const party = brief.instruction.instructingParty;
    return {
      type: 'result',
      result: {
        label: 'BRIEF',
        value: party ? `Instructing party · ${party}` : 'No brief data',
      },
    };
  }

  if (path === 'recent') {
    return {
      type: 'result',
      result: { label: 'RECENT', value: 'No recent lookups' },
    };
  }

  if (path === 'history') {
    return {
      type: 'result',
      result: { label: 'HISTORY', value: 'No history' },
    };
  }

  return { type: 'unknown' };
}

export function isLookupCommand(raw: string): boolean {
  return /^lookup(?:\s|$)/i.test(raw.trim());
}
