import type { InspectionBrief } from '@/types/workspace';

/**
 * Canonical Muffle operation. The visible SVYR path (including `prep`)
 * is discovery only — it is never encoded into the operation.
 */
export type SurveyOperation = {
  operationId: string;
  arguments: {
    value?: string;
  };
};

export const SURVEY_OPERATIONS = {
  setInstructingParty: 'survey.brief.instruction.party.set',
  readInstructingParty: 'survey.brief.instruction.party.read',
} as const;

/** Successful execution payload shared by both SVYR renderers. */
export type SurveyOperationResult = {
  operationId: string;
  brief: InspectionBrief;
  label: string;
  /** Display value — never empty; uses "Not recorded" when unset. */
  value: string;
};

const NOT_RECORDED = 'Not recorded';

function recordedOrPlaceholder(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : NOT_RECORDED;
}

/**
 * Execute a canonical survey operation against the live brief.
 * Returns null when the operation is unrecognised or a write has no value.
 */
export function executeSurveyOperation(
  brief: InspectionBrief,
  operation: SurveyOperation,
): SurveyOperationResult | null {
  switch (operation.operationId) {
    case SURVEY_OPERATIONS.readInstructingParty:
      return {
        operationId: operation.operationId,
        brief,
        label: 'Instructing party',
        value: recordedOrPlaceholder(brief.instruction.instructingParty),
      };

    case SURVEY_OPERATIONS.setInstructingParty: {
      const value = operation.arguments.value?.trim() ?? '';
      if (!value) return null;
      return {
        operationId: operation.operationId,
        brief: {
          ...brief,
          instruction: {
            ...brief.instruction,
            instructingParty: value,
          },
        },
        label: 'Instructing party',
        value,
      };
    }

    default:
      return null;
  }
}
