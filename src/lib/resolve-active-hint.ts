import { canRemoveLastEditableCommandSegment } from '@/lib/command-edit';
import {
  findCommandNode,
  isBranchNode,
} from '@/lib/command-registry';
import {
  SVYR_HINT_PRIORITY,
  type SvyrHintId,
} from '@/lib/hint-repository';
import { isPartyNotesPath } from '@/lib/svyr-notes';
import type { CommandSuggestion } from '@/lib/command-parser';
import type { SvyrInputMode } from '@/hooks/use-workspace';

export type HintContext = {
  inputMode: SvyrInputMode;
  fullCommandPath: string[];
  editablePath: string[];
  commandSuffix: string;
  suggestions: CommandSuggestion[];
  temporaryAutocompleteContent: string | null;
  /** Party notes editor is open. */
  notesOpen: boolean;
  isHintIncomplete: (id: SvyrHintId) => boolean;
};

function hasBranchSuggestion(suggestions: CommandSuggestion[]): boolean {
  return suggestions.some(
    (suggestion) =>
      suggestion.type === 'token' &&
      !suggestion.isTerminal &&
      !suggestion.requiresValue,
  );
}

function isAtBranchDirectory(path: string[]): boolean {
  // Registry root behaves like a branch directory for suggestion browsing.
  if (path.length === 0) return true;
  const node = findCommandNode(path);
  return Boolean(node && isBranchNode(node));
}

function isEligible(id: SvyrHintId, ctx: HintContext): boolean {
  switch (id) {
    case 'selectBranch':
      return (
        ctx.inputMode === 'navigation' &&
        ctx.temporaryAutocompleteContent === null &&
        isAtBranchDirectory(ctx.fullCommandPath) &&
        hasBranchSuggestion(ctx.suggestions)
      );

    case 'executeValue':
      return ctx.inputMode === 'data-entry';

    case 'swipeBack':
      return (
        ctx.inputMode === 'navigation' &&
        ctx.editablePath.length >= 2 &&
        canRemoveLastEditableCommandSegment(ctx.commandSuffix)
      );

    case 'openNotes':
      return isPartyNotesPath(ctx.fullCommandPath) && !ctx.notesOpen;

    default:
      return false;
  }
}

/**
 * Exactly one hint at a time, in fixed product priority order.
 */
export function resolveActiveHint(ctx: HintContext): SvyrHintId | null {
  for (const id of SVYR_HINT_PRIORITY) {
    if (!ctx.isHintIncomplete(id)) continue;
    if (!isEligible(id, ctx)) continue;
    return id;
  }
  return null;
}

export function isBranchSuggestion(suggestion: CommandSuggestion): boolean {
  return (
    suggestion.type === 'token' &&
    !suggestion.isTerminal &&
    !suggestion.requiresValue
  );
}
